// server.js

// ✅ dotenv はローカルでは便利だが、prod/EC2で未インストールでも落ちないようにする
try {
  require('dotenv').config();
} catch (e) {
  console.warn('[WARN] dotenv not available (this is OK on production if env vars are set).');
}

const nodemailer = require('nodemailer');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');
const bcrypt = require('bcrypt');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const { BollingerBands, EMA } = require('technicalindicators');

let transporter;
let gmailUserForFrom = null;

const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true'; // ✅ http運用なら false のままでOK

// ✅ 追加：サイトURL（環境変数があればそれを優先）
const SITE_URL = process.env.SITE_URL || 'http://13.192.112.191:3000/';

// ✅ 追加：メール末尾にサイト情報を付ける（text/html両対応）
function appendSiteBlockToMail(text, html) {
  const siteText = `\n\n【サイト】\n${SITE_URL}\n`;
  const siteHtml = `<hr><p><strong>【サイト】</strong><br><a href="${SITE_URL}">${SITE_URL}</a></p>`;

  return {
    text: (text || '') + siteText,
    html: (html || '') + siteHtml,
  };
}

// ===== 表示名変換（DBキーは維持して、表示だけ変える） =====
function getIndicatorDisplayName(indicatorName) {
  const bbMap = {
    upper2: '+2σ',
    upper1: '+1σ',
    middle: '0σ',
    lower1: '-1σ',
    lower2: '-2σ',
  };
  if (bbMap[indicatorName]) return bbMap[indicatorName];

  // EMA はそのまま "EMA10" などに揃える（メール/通知用）
  if (indicatorName?.startsWith('ema')) return `EMA${indicatorName.slice(3)}`;

  // それ以外はフォールバック
  return String(indicatorName ?? '');
}

// ===== crossHistory v2 helpers（interval別） =====
function isCrossEventObject(v) {
  return !!v && typeof v === 'object' && typeof v.price === 'number' && !Number.isNaN(v.price);
}

// crossHistory を nested に正規化：
// v2: { "5m": { upper2:{...}, ema10:{...} }, "1h": {...} }
// legacy(flat): { upper2:{...}, ema10:{...} }
function normalizeCrossHistoryToNested(crossHistory, fallbackInterval) {
  const nested = {};
  if (!crossHistory || typeof crossHistory !== 'object') return nested;

  const values = Object.values(crossHistory);

  const looksNested = values.some(
    (v) =>
      v &&
      typeof v === 'object' &&
      !isCrossEventObject(v) &&
      Object.values(v).some((x) => x === null || isCrossEventObject(x) || typeof x === 'number')
  );

  const looksFlat = values.some((v) => v === null || isCrossEventObject(v) || typeof v === 'number');

  // nested
  if (looksNested && !looksFlat) {
    for (const [iv, map] of Object.entries(crossHistory)) {
      if (!map || typeof map !== 'object') continue;
      nested[iv] = {};
      for (const [name, ev] of Object.entries(map)) {
        if (ev === null) nested[iv][String(name)] = null;
        else if (typeof ev === 'number' && !Number.isNaN(ev))
          nested[iv][String(name)] = { price: ev, interval: String(iv), timestamp: null };
        else if (isCrossEventObject(ev))
          nested[iv][String(name)] = {
            price: ev.price,
            interval: ev.interval || String(iv),
            timestamp: typeof ev.timestamp === 'string' ? ev.timestamp : null,
          };
      }
    }
    return nested;
  }

  // flat legacy
  const fb = fallbackInterval || 'unknown';
  for (const [name, ev] of Object.entries(crossHistory)) {
    if (ev === null) {
      if (!nested[fb]) nested[fb] = {};
      nested[fb][String(name)] = null;
      continue;
    }

    if (typeof ev === 'number' && !Number.isNaN(ev)) {
      if (!nested[fb]) nested[fb] = {};
      nested[fb][String(name)] = { price: ev, interval: fb, timestamp: null };
      continue;
    }

    if (!isCrossEventObject(ev)) continue;

    const iv = ev.interval || fb;
    if (!nested[iv]) nested[iv] = {};
    nested[iv][String(name)] = {
      price: ev.price,
      interval: iv,
      timestamp: typeof ev.timestamp === 'string' ? ev.timestamp : null,
    };
  }
  return nested;
}

// This function fetches credentials from AWS Parameter Store and configures Nodemailer
async function configureNodemailer() {
  try {
    const ssmClient = new SSMClient({
      region: process.env.AWS_REGION || 'ap-northeast-1',
    });
    const command = new GetParametersCommand({
      Names: ['/parabolic/gmail/user', '/parabolic/gmail/pass'],
      WithDecryption: true,
    });

    const { Parameters } = await ssmClient.send(command);

    const gmailUser = Parameters.find((p) => p.Name === '/parabolic/gmail/user')?.Value;
    const gmailPass = Parameters.find((p) => p.Name === '/parabolic/gmail/pass')?.Value;

    if (!gmailUser || !gmailPass) {
      throw new Error('Gmail credentials not found in Parameter Store.');
    }

    gmailUserForFrom = gmailUser;

    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    console.log('Nodemailer configured successfully with credentials from Parameter Store.');
  } catch (error) {
    console.error('Failed to configure Nodemailer from Parameter Store:', error);
  }
}

const app = express();
const port = 3000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

// --- Database Setup ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createUsersTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('"users" table checked/created successfully.');
  } catch (err) {
    console.error('Error creating "users" table:', err);
  } finally {
    client.release();
  }
}

async function createEmailsTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS emails (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('"emails" table checked/created successfully.');
  } catch (err) {
    console.error('Error creating "emails" table:', err);
  } finally {
    client.release();
  }
}

async function createUserSettingsTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        settings JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('"user_settings" table checked/created successfully.');
  } catch (err) {
    console.error('Error creating "user_settings" table:', err);
  } finally {
    client.release();
  }
}

// --- Middleware ---
app.use(cors());
app.use(express.json());

// behind reverse proxy (nginx) の場合も考慮
app.set('trust proxy', 1);

// --- Session Middleware for Authentication ---
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});
app.use(sessionMiddleware);

// Share session with socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

app.use(express.static('dist'));
app.use(express.static(__dirname));

// --- Real-time Price Watcher for USD/JPY ---
io.on('connection', (socket) => {
  const sess = socket.request.session;
  if (sess && sess.userId) {
    socket.userId = sess.userId;
    console.log(`User connected: ${socket.id}, userId: ${socket.userId}`);
  } else {
    console.log(`Anonymous user connected: ${socket.id}`);
  }

  // ✅ ログイン直後など、handshake時に userId が無い socket に後から紐付ける
  socket.on('auth_sync', () => {
    const s = socket.request.session;
    if (!s || typeof s.reload !== 'function') return;
    s.reload((err) => {
      if (err) return;
      if (s.userId) {
        socket.userId = s.userId;
        console.log(`Socket auth synced: ${socket.id}, userId: ${socket.userId}`);
      }
    });
  });

  socket.on('disconnect', () => {
    console.log(`user disconnected: ${socket.id}`);
  });
});

// A simple caching mechanism
const cache = {};
const CACHE_TTL = 30 * 1000; // 30 seconds

// watcher/endpoint 共通の interval 許可リスト
const VALID_INTERVALS = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '4h', '8h', '1d', '5d', '1wk', '1mo', '3mo'];
function isValidInterval(iv) {
  return VALID_INTERVALS.includes(iv);
}

function getDaysToFetchForInterval(interval) {
  switch (interval) {
    case '1m':
      return 7;
    case '2m':
    case '5m':
    case '15m':
    case '30m':
      return 30;
    case '60m':
    case '1h':
      return 60;
    case '4h':
      return 120;
    case '8h':
      return 180;
    case '1d':
      return 365;
    case '5d':
    case '1wk':
      return 365 * 5;
    case '1mo':
      return 365 * 30;
    case '3mo':
      return 365 * 90;
    default:
      return 365;
  }
}

// ユーザーごとの「監視対象 interval」を決定
// ✅ x_values に設定がある interval は全て監視
// ✅ 互換のため currentInterval も含める（UIで見ている足は従来通りクロス通知したい）
function getUserMonitoredIntervals(settings) {
  const out = new Set();
  const currentInterval = settings?.currentInterval;
  if (typeof currentInterval === 'string' && currentInterval) out.add(currentInterval);

  const x_values = settings?.x_values || {};
  if (x_values && typeof x_values === 'object') {
    for (const [iv, x] of Object.entries(x_values)) {
      const n = Number(x);
      if (Number.isFinite(n) && n > 0 && typeof iv === 'string' && iv) out.add(iv);
    }
  }

  return [...out].filter((iv) => isValidInterval(iv));
}

// ===== Yahoo Chart API (fetch) helper =====
async function fetchYahooChartQuotes(symbol, interval, period1Date, period2Date) {
  const p1 = Math.floor(period1Date.getTime() / 1000);
  const p2 = Math.floor(period2Date.getTime() / 1000);

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${encodeURIComponent(interval)}&period1=${p1}&period2=${p2}`;

  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const text = await r.text();

  if (!r.ok) {
    throw new Error(`Yahoo chart HTTP ${r.status}: ${text.slice(0, 200)}`);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Yahoo chart JSON parse failed: ${text.slice(0, 200)}`);
  }

  const result = json?.chart?.result?.[0];
  if (!result) {
    throw new Error(`Yahoo chart missing result: ${text.slice(0, 200)}`);
  }

  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose || null;

  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const close = q.close?.[i];
    if (close == null) continue;

    out.push({
      date: new Date(ts[i] * 1000),
      open: q.open?.[i],
      high: q.high?.[i],
      low: q.low?.[i],
      close: close,
      volume: q.volume?.[i],
      adjclose: adj?.[i] ?? close,
    });
  }

  return out;
}

// ===== FIX: Yahooは4h/8h interval非対応なので、1hを取得して4h/8hに集約する =====
function aggregateQuotesToHours(quotes, intervalInHours) {
  if (!Array.isArray(quotes) || quotes.length === 0) return [];

  const aggregated = [];
  let current = null;
  let periodStartMs = null;

  for (const q of quotes) {
    const t = new Date(q.date);
    const hour = t.getUTCHours();
    const startHour = Math.floor(hour / intervalInHours) * intervalInHours;

    const start = new Date(t);
    start.setUTCHours(startHour, 0, 0, 0);
    const startMs = start.getTime();

    if (current === null || startMs !== periodStartMs) {
      if (current !== null) aggregated.push(current);

      current = {
        date: new Date(startMs),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume ?? null,
        adjclose: q.adjclose ?? q.close,
      };
      periodStartMs = startMs;
    } else {
      current.high = Math.max(current.high, q.high);
      current.low = Math.min(current.low, q.low);
      current.close = q.close;

      if (current.volume != null || q.volume != null) {
        current.volume = (current.volume ?? 0) + (q.volume ?? 0);
      }
      current.adjclose = q.adjclose ?? q.close;
    }
  }

  if (current !== null) aggregated.push(current);
  return aggregated;
}

/**
 * ✅ watcher用：USDJPYの指定intervalのローソク足を取得（4h/8hは集約）
 * ✅ intervalごとにキャッシュ（CACHE_TTL）して無駄なYahoo呼び出しを減らす
 */
async function fetchUsdJpyQuotesForWatcher(interval) {
  const iv = String(interval || '');
  if (!isValidInterval(iv)) return null;

  const cacheKey = `watcher-usdjpy-${iv}`;
  const now = Date.now();
  if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_TTL) {
    return cache[cacheKey].data;
  }

  const ticker = 'USDJPY=X';
  const daysToFetch = getDaysToFetchForInterval(iv);
  const period2 = new Date();
  const period1 = new Date(period2.getTime() - daysToFetch * 24 * 60 * 60 * 1000);

  let fetchInterval = iv;
  let aggregateHours = null;

  if (iv === '4h') {
    fetchInterval = '1h';
    aggregateHours = 4;
  } else if (iv === '8h') {
    fetchInterval = '1h';
    aggregateHours = 8;
  }

  const rawQuotes = await fetchYahooChartQuotes(ticker, fetchInterval, period1, period2);
  const quotes = aggregateHours ? aggregateQuotesToHours(rawQuotes, aggregateHours) : rawQuotes;

  cache[cacheKey] = { timestamp: Date.now(), data: quotes };
  return quotes;
}

/**
 * ✅ 追加：USD/JPY現在値を「quote → ダメなら chart」で取得
 * quote が 403/429 で落ちても watcher を止めないための仕組み
 */
async function fetchUsdJpyCurrentPrice() {
  const ticker = 'USDJPY=X';

  // ① quote（速いが弾かれやすい）
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    const text = await resp.text();

    if (!resp.ok) {
      console.error(`Yahoo quote HTTP ${resp.status}: ${text.slice(0, 200)}`);
    } else {
      const json = JSON.parse(text);
      const p = json?.quoteResponse?.result?.[0]?.regularMarketPrice;
      if (typeof p === 'number') return p;
      console.error(`Yahoo quote OK but price missing: ${text.slice(0, 200)}`);
    }
  } catch (e) {
    console.error('Yahoo quote fetch error:', e);
  }

  // ② fallback：chart の最新 close を現在値扱い（通りやすい）
  try {
    const period2 = new Date();
    const period1 = new Date(period2.getTime() - 2 * 24 * 60 * 60 * 1000);
    const quotes = await fetchYahooChartQuotes(ticker, '1m', period1, period2);
    const last = quotes[quotes.length - 1];
    if (last?.close != null) return last.close;
    console.error('Yahoo chart fallback OK but last.close missing');
  } catch (e) {
    console.error('Yahoo chart fallback fetch error:', e);
  }

  return null;
}

// --- API Endpoints for Authentication ---
app.post('/api/auth/register', async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, username, and password are required.' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username',
      [email, username, hashedPassword]
    );
    const user = result.rows[0];
    req.session.userId = user.id;
    res.status(201).json({
      message: 'Registration successful!',
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') {
      if (error.detail?.includes('email')) return res.status(409).json({ error: 'Email already in use.' });
      if (error.detail?.includes('username')) return res.status(409).json({ error: 'Username already taken.' });
    }
    res.status(500).json({ error: 'An internal server error occurred during registration.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { emailOrUsername, password } = req.body;

  if (!emailOrUsername || !password) {
    return res.status(400).json({ error: 'Email/username and password are required.' });
  }

  try {
    const result = await pool.query('SELECT id, email, username, password_hash FROM users WHERE email = $1 OR username = $1', [
      emailOrUsername,
    ]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) return res.status(401).json({ error: 'Invalid credentials.' });

    req.session.userId = user.id;
    res.status(200).json({
      message: 'Login successful!',
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'An internal server error occurred during login.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Failed to log out.' });
    }
    res.clearCookie('connect.sid');
    res.status(200).json({ message: 'Logout successful!' });
  });
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const result = await pool.query('SELECT id, email, username FROM users WHERE id = $1', [req.session.userId]);
    const user = result.rows[0];

    if (!user) {
      req.session.destroy();
      return res.status(401).json({ error: 'User not found or session invalid.' });
    }
    res.status(200).json({ user: { id: user.id, email: user.email, username: user.username } });
  } catch (error) {
    console.error('Fetch user error:', error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// API to get user settings
app.get('/api/user/settings', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const result = await pool.query('SELECT settings FROM user_settings WHERE user_id = $1', [req.session.userId]);
    if (result.rows.length > 0) return res.status(200).json(result.rows[0].settings);
    return res.status(200).json({});
  } catch (error) {
    console.error('Fetch user settings error:', error);
    res.status(500).json({ error: 'An internal server error occurred while fetching settings.' });
  }
});

// ✅ 修正：ユーザー設定保存は「JSONBマージ」ではなく、
//   - 基本は currentSettings と incoming をアプリ側でマージ
//   - x_values は incoming が来た時だけ「置き換え」(削除を反映するため)
//   - realTimeState は原則保持（incomingにある時だけ上書き）
app.post('/api/user/settings', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated.' });

  // ✅ 旧形式 { settings: {...} } も受ける（client側移行中の互換）
  const incoming =
    req.body && req.body.settings && typeof req.body.settings === 'object' ? req.body.settings : req.body;

  try {
    const currentRes = await pool.query('SELECT settings FROM user_settings WHERE user_id = $1', [req.session.userId]);
    const current = currentRes.rows?.[0]?.settings || {};

    // --- FIX: Flatten the object structure to remove nesting ---
    const cleanCurrent = { ...(current.settings || {}), ...current };
    delete cleanCurrent.settings;

    const merged = {
      ...cleanCurrent,
      ...incoming,
    };
    // --- END FIX ---

    const result = await pool.query(
      `
      INSERT INTO user_settings (user_id, settings)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET
        settings = $2,
        updated_at = CURRENT_TIMESTAMP
      RETURNING settings
      `,
      [req.session.userId, merged]
    );

    res.status(200).json(result.rows[0].settings);
  } catch (error) {
    console.error('Save user settings error:', error);
    res.status(500).json({ error: 'An internal server error occurred while saving settings.' });
  }
});

// ✅ 追加：client側でクロス履歴をクリアしたら server(DB)側もクリアして整合を取る
// v2: interval省略時は「全intervalに対して」クリア
// ✅ 追加：dedup用 lastCrossTimestamps も一緒に消す（手動リセット時に同ローソクで再通知できるように）
app.post('/api/user/cross_history/clear', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated.' });

  const { indicatorNames, interval } = req.body;
  if (!Array.isArray(indicatorNames) || indicatorNames.length === 0) {
    return res.status(400).json({ error: 'indicatorNames must be a non-empty array.' });
  }

  try {
    const r = await pool.query('SELECT settings FROM user_settings WHERE user_id = $1', [req.session.userId]);
    const settings = r.rows?.[0]?.settings || {};

    const realTimeState = settings.realTimeState || {};
    const nested = normalizeCrossHistoryToNested(realTimeState.crossHistory || {}, settings.currentInterval || '5m');

    // dedup map
    const lastCrossTimestamps =
      realTimeState.lastCrossTimestamps && typeof realTimeState.lastCrossTimestamps === 'object'
        ? realTimeState.lastCrossTimestamps
        : {};

    if (interval) {
      const iv = String(interval);
      if (!nested[iv]) nested[iv] = {};
      for (const name of indicatorNames) nested[iv][String(name)] = null;

      if (lastCrossTimestamps[iv] && typeof lastCrossTimestamps[iv] === 'object') {
        for (const name of indicatorNames) delete lastCrossTimestamps[iv][String(name)];
        if (Object.keys(lastCrossTimestamps[iv]).length === 0) delete lastCrossTimestamps[iv];
      }
    } else {
      const keys = Object.keys(nested);
      if (keys.length === 0) nested[settings.currentInterval || '5m'] = {};

      for (const iv of Object.keys(nested)) {
        for (const name of indicatorNames) nested[iv][String(name)] = null;

        if (lastCrossTimestamps[iv] && typeof lastCrossTimestamps[iv] === 'object') {
          for (const name of indicatorNames) delete lastCrossTimestamps[iv][String(name)];
          if (Object.keys(lastCrossTimestamps[iv]).length === 0) delete lastCrossTimestamps[iv];
        }
      }
    }

    const newSettings = {
      ...settings,
      realTimeState: {
        ...realTimeState,
        crossHistory: nested,
        lastCrossTimestamps,
      },
    };

    await pool.query(
      `
      INSERT INTO user_settings (user_id, settings)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET settings = $2, updated_at = CURRENT_TIMESTAMP
      `,
      [req.session.userId, newSettings]
    );

    return res.status(200).json({ message: 'crossHistory cleared.', crossHistory: nested });
  } catch (e) {
    console.error('Clear cross_history error:', e);
    return res.status(500).json({ error: 'An internal server error occurred while clearing cross history.' });
  }
});

// Subscribe email
app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  try {
    const result = await pool.query('INSERT INTO emails (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING *', [
      email,
    ]);

    if (result.rows.length > 0) return res.status(201).json({ message: 'Thank you for subscribing!', email: result.rows[0] });
    return res.status(200).json({ message: 'You are already subscribed.' });
  } catch (error) {
    console.error('Database insertion error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

app.get('/api/emails', async (req, res) => {
  try {
    const result = await pool.query('SELECT email FROM emails ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Database query error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

app.delete('/api/emails/:email', async (req, res) => {
  const { email } = req.params;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  try {
    const result = await pool.query('DELETE FROM emails WHERE email = $1 RETURNING email', [email]);
    if (result.rowCount > 0) return res.status(200).json({ message: `Email ${email} deleted successfully.` });
    return res.status(404).json({ error: `Email ${email} not found.` });
  } catch (error) {
    console.error('Database deletion error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

app.post('/api/send-emails', async (req, res) => {
  if (!transporter) {
    return res.status(500).json({ error: 'Email service is not configured. Please check the server logs.' });
  }

  try {
    const result = await pool.query('SELECT email FROM emails');
    const emails = result.rows.map((row) => row.email);

    if (emails.length === 0) {
      return res.status(404).json({ message: 'No emails found to send.' });
    }

    let mailOptions = {
      from: `"Parabolic" <${gmailUserForFrom || process.env.GMAIL_USER}>`,
      subject: '条件達成',
      text: 'おめでとうございます。条件達成です。',
      html: '<p>おめでとうございます。条件達成です。</p>',
    };

    // ✅ 追加：サイト追記
    mailOptions = { ...mailOptions, ...appendSiteBlockToMail(mailOptions.text, mailOptions.html) };

    for (const email of emails) {
      await transporter.sendMail({ ...mailOptions, to: email });
      console.log(`Email sent to ${email}`);
    }

    res.status(200).json({ message: 'Emails sent successfully.' });
  } catch (error) {
    console.error('Error sending emails:', error);
    res.status(500).json({ error: 'An internal server error occurred while sending emails.' });
  }
});

// =====================
//   Price Data APIs
// =====================
app.get('/api/data', async (req, res) => {
  const { ticker, interval } = req.query;

  if (!ticker || !interval) {
    return res.status(400).json({ error: 'Ticker and interval are required' });
  }

  const cacheKey = `stock-${ticker}-${interval}`;
  const now = Date.now();

  if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_TTL) {
    return res.json(cache[cacheKey].data);
  }

  if (!isValidInterval(interval)) {
    return res.status(400).json({ error: `Invalid interval. Valid intervals are: ${VALID_INTERVALS.join(', ')}` });
  }

  let daysToFetch = getDaysToFetchForInterval(interval);
  let actualInterval = interval;

  // Yahooが4h/8hを受けないので、endpointでは従来通り1h取得（client側集約もあるが、ここは互換）
  if (interval === '4h' || interval === '8h') {
    actualInterval = '1h';
  }

  try {
    const period2 = new Date();
    const period1 = new Date(period2.getTime() - daysToFetch * 24 * 60 * 60 * 1000);

    const quotes = await fetchYahooChartQuotes(ticker, actualInterval, period1, period2);

    if (!quotes || quotes.length === 0) {
      return res.status(404).json({ error: `No data found for ticker: ${ticker}` });
    }

    cache[cacheKey] = { timestamp: Date.now(), data: quotes };
    res.json(quotes);
  } catch (error) {
    console.error('api/data error:', error);
    res.status(500).json({ error: 'Failed to fetch data from Yahoo Finance' });
  }
});

// USD/JPY endpoint
app.get('/api/usd_jpy_data', async (req, res) => {
  const ticker = 'USDJPY=X';
  let { interval } = req.query;

  if (!interval) interval = '1d';

  if (!isValidInterval(interval)) {
    return res.status(400).json({ error: `Invalid interval. Valid intervals are: ${VALID_INTERVALS.join(', ')}` });
  }

  const cacheKey = `usd_jpy-${ticker}-${interval}`;
  const now = Date.now();

  if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_TTL) {
    return res.json(cache[cacheKey].data);
  }

  let daysToFetch = getDaysToFetchForInterval(interval);
  let actualInterval = interval;

  if (interval === '4h' || interval === '8h') {
    actualInterval = '1h';
  }

  try {
    const period2 = new Date();
    const period1 = new Date(period2.getTime() - daysToFetch * 24 * 60 * 60 * 1000);

    const quotes = await fetchYahooChartQuotes(ticker, actualInterval, period1, period2);

    if (!quotes || quotes.length === 0) {
      return res.status(404).json({ error: `No data found for USD/JPY with interval ${interval}.` });
    }

    cache[cacheKey] = { timestamp: Date.now(), data: quotes };
    res.json(quotes);
  } catch (error) {
    console.error('api/usd_jpy_data error:', error);
    res.status(500).json({ error: 'Failed to fetch USD/JPY data from Yahoo Finance' });
  }
});

/**
 * ★ interval を引数で受け取り、メールに表示する
 */
async function sendThresholdEmail(user, indicatorName, crossedPrice, currentPrice, crossedTimestamp, intervalForEmail, userThreshold) {
  // ✅ 追加：ユーザーがメール受信OFFなら送らない
  try {
    const settings = user?.settings || {};
    if (settings.emailAlertsEnabled === false) {
      console.log(`Email suppressed (emailAlertsEnabled=false) for user ${user?.id} (${user?.email})`);
      return;
    }
  } catch {}

  if (!transporter) {
    console.error(`Email not sent for user ${user.email}: Email service is not configured.`);
    return;
  }

  const priceDifference = Math.abs(currentPrice - crossedPrice);
  const now = new Date();

  const intervalLabel = intervalForEmail || 'unknown';
  const indicatorLabel = getIndicatorDisplayName(indicatorName);

  const subject = `【Parabolic】【${intervalLabel}】ドル円価格アラート: ${indicatorLabel} のしきい値達成`;
  const baseText = `
こんにちは、${user.username}さん

設定された価格アラートの条件が達成されましたのでお知らせします。

---
詳細
---
- 監視対象: USD/JPY
- 時間足(間隔): ${intervalLabel}
- トリガー指標: ${indicatorLabel}
- クロス発生時刻: ${new Date(crossedTimestamp).toLocaleString('ja-JP')}
- クロス時価格: ${crossedPrice.toFixed(3)} 円
- 設定しきい値: ±${userThreshold.toFixed(3)} 円
- 現在時刻: ${now.toLocaleString('ja-JP')}
- 現在価格: ${currentPrice.toFixed(3)} 円
- クロス時からの変動幅: ${priceDifference.toFixed(3)} 円

---

Parabolic Chart
`;

  const baseHtml = `
    <p>こんにちは、${user.username}さん</p>
    <p>設定された価格アラートの条件が達成されましたのでお知らせします。</p>
    <hr>
    <h3>詳細</h3>
    <ul>
      <li><b>監視対象:</b> USD/JPY</li>
      <li><b>時間足(間隔):</b> ${intervalLabel}</li>
      <li><b>トリガー指標:</b> ${indicatorLabel}</li>
      <li><b>クロス発生時刻:</b> ${new Date(crossedTimestamp).toLocaleString('ja-JP')}</li>
      <li><b>クロス時価格:</b> ${crossedPrice.toFixed(3)} 円</li>
      <li><b>設定しきい値:</b> ±${userThreshold.toFixed(3)} 円</li>
      <li><b>現在時刻:</b> ${now.toLocaleString('ja-JP')}</li>
      <li><b>現在価格:</b> ${currentPrice.toFixed(3)} 円</li>
      <li><b>クロス時からの変動幅:</b> ${priceDifference.toFixed(3)} 円</li>
    </ul>
    <hr>
    <p>Parabolic Chart</p>
  `;

  // ✅ 追加：末尾にサイトを付ける
  const { text, html } = appendSiteBlockToMail(baseText, baseHtml);

  const mailOptions = {
    from: `"Parabolic" <${gmailUserForFrom || process.env.GMAIL_USER}>`,
    to: user.email,
    subject,
    text,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Threshold alert email sent to ${user.email} for ${indicatorName}.`);
  } catch (error) {
    console.error(`Failed to send threshold alert email to ${user.email}:`, error);
  }
}

/**
 * ✅ クロス判定（終値＝SMA(1) と BB/EMA のクロス）
 * intervalLabel（=どの時間足で検知したか）を明示引数で受ける
 *
 * ✅ FIX: 同一ローソク（timestamp）での重複検知を防ぐ（15秒ループでのスパム対策）
 *   realTimeState.lastCrossTimestamps[interval][indicatorName] に最後に「検知したローソク足のtimestamp」を保存して、
 *   同じtimestampならスキップする
 */
async function monitorSma1Value(user, quotes, realTimeState, socketMap, io, intervalLabel) {
  let stateChanged = false;
  const settings = user.settings || {};
  const userInterval = intervalLabel || settings.currentInterval || '5m';

  try {
    const minDataPoints = 55;
    if (!Array.isArray(quotes) || quotes.length < minDataPoints) return false;

    const closePrices = quotes.map((q) => q.close);
    const lastCandle = quotes[quotes.length - 1];
    const secondLastCandle = quotes[quotes.length - 2];

    const bbPeriod = parseInt(settings.bbPeriod, 10) || 20;
    const bbStdDev = parseFloat(settings.bbStdDev) || 2;

    // ===== FIX: EMA periodをユーザー設定と同期 =====
    const emaPeriods = [
      parseInt(settings.ema1Period, 10) || 10,
      parseInt(settings.ema2Period, 10) || 25,
      parseInt(settings.ema3Period, 10) || 50,
    ];

    const indicatorValues = {};

    // Calculate BB
    const bbResult1 = BollingerBands.calculate({ period: bbPeriod, values: closePrices, stdDev: 1 });
    const bbResult2 = BollingerBands.calculate({ period: bbPeriod, values: closePrices, stdDev: bbStdDev });

    if (bbResult1.length >= 2 && bbResult2.length >= 2) {
      indicatorValues['middle'] = { last: bbResult1[bbResult1.length - 1].middle, secondLast: bbResult1[bbResult1.length - 2].middle };
      indicatorValues['upper1'] = { last: bbResult1[bbResult1.length - 1].upper, secondLast: bbResult1[bbResult1.length - 2].upper };
      indicatorValues['lower1'] = { last: bbResult1[bbResult1.length - 1].lower, secondLast: bbResult1[bbResult1.length - 2].lower };
      indicatorValues['upper2'] = { last: bbResult2[bbResult2.length - 1].upper, secondLast: bbResult2[bbResult2.length - 2].upper };
      indicatorValues['lower2'] = { last: bbResult2[bbResult2.length - 1].lower, secondLast: bbResult2[bbResult2.length - 2].lower };
    }

    // Calculate EMA
    emaPeriods.forEach((p) => {
      const emaResult = EMA.calculate({ period: p, values: closePrices });
      if (emaResult.length >= 2) {
        indicatorValues['ema' + p] = { last: emaResult[emaResult.length - 1], secondLast: emaResult[emaResult.length - 2] };
      }
    });

    // Ensure state shape（v2: interval別）
    if (!realTimeState.crossHistory) realTimeState.crossHistory = {};
    if (!realTimeState.crossHistory[userInterval]) realTimeState.crossHistory[userInterval] = {};

    // ✅ dedup map
    if (!realTimeState.lastCrossTimestamps) realTimeState.lastCrossTimestamps = {};
    if (!realTimeState.lastCrossTimestamps[userInterval]) realTimeState.lastCrossTimestamps[userInterval] = {};

    // Check for crosses (終値 vs indicator)
    for (const indicatorName in indicatorValues) {
      const { last, secondLast } = indicatorValues[indicatorName];
      if (last === undefined || secondLast === undefined) continue;

      const lastRelPosition = lastCandle.close > last ? 'above' : 'below';
      const secondLastRelPosition = secondLastCandle.close > secondLast ? 'above' : 'below';

      if (lastRelPosition !== secondLastRelPosition) {
        const crossPrice = lastCandle.close;
        const crossTimestamp = lastCandle.date;
        const tsIso = crossTimestamp instanceof Date ? crossTimestamp.toISOString() : new Date(crossTimestamp).toISOString();

        // ✅ 同一ローソクの重複検知を防ぐ
        const lastSeenTs = realTimeState.lastCrossTimestamps[userInterval]?.[indicatorName];
        if (lastSeenTs === tsIso) {
          continue;
        }

        // 記録
        realTimeState.lastCrossTimestamps[userInterval][indicatorName] = tsIso;

        // v2: interval別に保存
        realTimeState.crossHistory[userInterval][indicatorName] = {
          price: crossPrice,
          timestamp: tsIso,
          interval: userInterval,
        };
        stateChanged = true;

        const indicatorLabel = getIndicatorDisplayName(indicatorName);

        console.log(
          `User ${user.id}: CLOSE(SMA1)-BASED cross detected for ${indicatorName}(${indicatorLabel}) at price ${crossPrice} on interval ${userInterval}`
        );

        const socketId = socketMap.get(user.id);
        if (socketId) {
          const eventName = indicatorName.startsWith('ema') ? 'ema_cross' : 'bb_cross';
          const eventPayload = {
            message: `ドル円が ${indicatorLabel} を終値で${lastRelPosition === 'above' ? '上抜け' : '下抜け'}しました！ (間隔: ${userInterval})`,
            price: crossPrice,
            crossDirection: lastRelPosition === 'above' ? 'up' : 'down',
            timestamp: tsIso,
            interval: userInterval,
            [eventName === 'ema_cross' ? 'emaName' : 'bandName']: indicatorName,
            [eventName === 'ema_cross' ? 'emaValue' : 'bandValue']: last,
            [eventName === 'ema_cross' ? 'emaLabel' : 'bandLabel']: indicatorLabel,
          };
          io.to(socketId).emit(eventName, eventPayload);
        }
      }
    }
  } catch (error) {
    console.error(`Error in monitorSma1Value for user ${user.id}:`, error);
  }
  return stateChanged;
}

async function startPriceWatcher() {
  console.log('Starting DB-centric, always-on USD/JPY price watcher...');

  let isTickRunning = false;

  setInterval(async () => {
    if (isTickRunning) return; // ✅ ループの重複実行を防ぐ
    isTickRunning = true;

    try {
      const userQuery = `
        SELECT u.id, u.username, u.email, s.settings
        FROM users u
        LEFT JOIN user_settings s ON u.id = s.user_id
        WHERE s.settings IS NOT NULL
      `;
      const { rows: users } = await pool.query(userQuery);
      if (users.length === 0) return;

      const activeSockets = await io.fetchSockets();
      const socketMap = new Map();
      for (const socket of activeSockets) {
        if (socket.userId) socketMap.set(socket.userId, socket.id);
      }

      const currentPrice = await fetchUsdJpyCurrentPrice();

      if (currentPrice == null) {
        console.error('Failed to fetch current USD/JPY price (quote & chart both failed). Continuing without live price...');
      } else {
        io.emit('usd_jpy_price_update', { price: currentPrice, timestamp: new Date() });
      }

      // ✅ ここが本題：ユーザーごとに「監視対象interval」を作り、必要なintervalのquotesをまとめて取る
      const perUserIntervals = new Map(); // userId -> [interval...]
      const allIntervals = new Set();

      for (const user of users) {
        const settings = user.settings || {};
        const intervals = getUserMonitoredIntervals(settings);
        // 何も無い場合の保険
        const fallback = settings.currentInterval || '5m';
        const finalIntervals = intervals.length > 0 ? intervals : [fallback];

        perUserIntervals.set(user.id, finalIntervals);
        for (const iv of finalIntervals) allIntervals.add(iv);
      }

      // intervalごとのquotesを一括取得（キャッシュも効く）
      const quotesByInterval = {};
      for (const iv of allIntervals) {
        try {
          const q = await fetchUsdJpyQuotesForWatcher(iv);
          if (Array.isArray(q) && q.length > 0) quotesByInterval[iv] = q;
        } catch (e) {
          console.error(`Watcher quotes fetch failed for interval ${iv}:`, e?.message || e);
        }
      }

      for (const user of users) {
        const settings = user.settings || {};
        const realTimeState = settings.realTimeState || {};
        // ✅ v2: crossHistory interval別に正規化（legacyも吸収）
        realTimeState.crossHistory = normalizeCrossHistoryToNested(realTimeState.crossHistory || {}, settings.currentInterval || '5m');

        let stateChanged = false;

        // Part 1: X-Value threshold using live price（live price がある時だけ）
        if (currentPrice != null) {
          const x_values = settings.x_values || {};
          const crossHistory = realTimeState.crossHistory || {};

          for (const [iv, indicatorMap] of Object.entries(crossHistory)) {
            if (!indicatorMap || typeof indicatorMap !== 'object') continue;

            const thresholdForInterval = Number(x_values[iv]);
            // thresholdが無いintervalはスキップ（独立運用）
            if (!Number.isFinite(thresholdForInterval) || thresholdForInterval <= 0) continue;

            for (const [indicatorName, crossEvent] of Object.entries(indicatorMap)) {
              if (!crossEvent || !isCrossEventObject(crossEvent)) continue;

              const crossedPrice = crossEvent.price;
              const priceDifference = Math.abs(currentPrice - crossedPrice);

              if (priceDifference >= thresholdForInterval) {
                const crossedTs = crossEvent.timestamp ? new Date(crossEvent.timestamp) : new Date();

                // ✅ 追加：メール受信ON/OFF（未設定はON扱い）
                const emailEnabled = settings.emailAlertsEnabled !== false;

                if (emailEnabled) {
                  await sendThresholdEmail(user, indicatorName, crossedPrice, currentPrice, crossedTs, iv, thresholdForInterval);
                } else {
                  console.log(
                    `Threshold reached but email suppressed (emailAlertsEnabled=false): user=${user.id}, interval=${iv}, indicator=${indicatorName}`
                  );
                }

                // ✅ 重要：OFFでも crossHistory はクリア（永遠に判定し続けるのを防ぐ）
                indicatorMap[indicatorName] = null;
                stateChanged = true;

                // ✅ clientに「消した」ことを通知してUI/LSも追従（OFFでも整合のため通知）
                const socketId = socketMap.get(user.id);
                if (socketId) {
                  io.to(socketId).emit('cross_history_cleared', {
                    indicatorName,
                    interval: iv,
                    timestamp: new Date().toISOString(),
                  });
                }
              }
            }
          }
        }

        // Part 2: Cross-detection for ALL monitored intervals (x_values の interval 全部 + currentInterval)
        const intervals = perUserIntervals.get(user.id) || [settings.currentInterval || '5m'];

        for (const iv of intervals) {
          const quotesForDetection = quotesByInterval[iv];
          if (!quotesForDetection) continue;

          const crossDetectionStateChanged = await monitorSma1Value(user, quotesForDetection, realTimeState, socketMap, io, iv);
          stateChanged = stateChanged || crossDetectionStateChanged;
        }

        if (stateChanged) {
          const newSettings = { ...settings, realTimeState };
          const upsertQuery = `
            INSERT INTO user_settings (user_id, settings) VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET settings = $2
          `;
          await pool.query(upsertQuery, [user.id, newSettings]);
        }
      }
    } catch (error) {
      console.error('Error in price watcher:', error);
    } finally {
      isTickRunning = false;
    }
  }, 15000);
}

// --- Server Startup ---
async function startServer() {
  await configureNodemailer();

  console.log('Initializing database...');
  // ✅ 外部キーの都合で users → emails → user_settings の順にしています
  await createUsersTable();
  await createEmailsTable();
  await createUserSettingsTable();
  console.log('Database initialized successfully.');

  server.listen(port, '0.0.0.0', () => {
    console.log(`Proxy server listening at http://0.0.0.0:${port}`);
    console.log('API endpoint for stocks: /api/data?ticker=7203.T&interval=1d');
    console.log('API endpoint for USD/JPY: /api/usd_jpy_data');
    startPriceWatcher();
  });
}

startServer();
