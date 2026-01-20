// server.js

// ✅ dotenv はローカルでは便利だが、prod/EC2で未インストールでも落ちないようにする
try {
  require('dotenv').config();
} catch (e) {
  console.warn('[WARN] dotenv not available (this is OK on production if env vars are set).');
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const session = require('express-session');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const { Server } = require('socket.io');
const { BollingerBands, EMA } = require('technicalindicators');
const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');

const app = express();
const server = http.createServer(app);

// =====================
// Config / Env
// =====================
const PORT = process.env.PORT || 3000;

const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true'; // https運用なら true
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret_change_me';

// フロント別オリジンの場合は CORS_ORIGIN="https://example.com,https://www.example.com"
const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

const corsOptions = {
  origin: CORS_ORIGIN || true,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
// ✅ フォーム送信でも req.body が入るように（400対策）
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ✅ 静的配信（注意：__dirname 公開はセキュリティ上リスクがある。可能なら public/ や dist/ のみに）
app.use(express.static(__dirname));

const sessionMiddleware = session({
  name: 'connect.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SECURE ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
  },
});

app.use(sessionMiddleware);

// =====================
// Socket.IO
// =====================
const io = new Server(server, {
  cors: { ...corsOptions, methods: ['GET', 'POST'] },
});

io.use((socket, next) => {
  // express-session を socket にも適用
  sessionMiddleware(socket.request, {}, next);
});

function userRoom(userId) {
  return `user:${userId}`;
}

io.on('connection', (socket) => {
  // クライアントが connect しただけでは room に入れない（auth_sync を待つ）
  socket.on('auth_sync', () => {
    const sess = socket.request.session;
    const uid = sess?.userId;
    if (uid) {
      socket.join(userRoom(uid));
    }
  });

  socket.on('disconnect', () => {});
});

// =====================
// DB
// =====================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL が必要な環境では env に合わせて調整
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS emails (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, email)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated.' });
  next();
}

// =====================
// Gmail / Email (SSM or ENV)
// =====================
let transporter = null;
let gmailUserForFrom = null;

async function initMailerIfNeeded() {
  if (transporter) return;

  // SSM を使う場合
  const region = process.env.AWS_REGION;
  const ssmUserParam = process.env.SSM_GMAIL_USER_PARAM;
  const ssmPassParam = process.env.SSM_GMAIL_PASS_PARAM;

  let gmailUser = process.env.GMAIL_USER || null;
  let gmailPass = process.env.GMAIL_APP_PASSWORD || null;

  if (region && ssmUserParam && ssmPassParam) {
    try {
      const client = new SSMClient({ region });
      const cmd = new GetParametersCommand({
        Names: [ssmUserParam, ssmPassParam],
        WithDecryption: true,
      });
      const out = await client.send(cmd);

      const params = new Map();
      for (const p of out.Parameters || []) params.set(p.Name, p.Value);

      gmailUser = params.get(ssmUserParam) || gmailUser;
      gmailPass = params.get(ssmPassParam) || gmailPass;
    } catch (e) {
      console.warn('[WARN] Failed to load Gmail creds from SSM. Falling back to env if present.');
    }
  }

  if (!gmailUser || !gmailPass) {
    console.warn('[WARN] Gmail credentials are not configured. Email sending will be disabled.');
    return;
  }

  gmailUserForFrom = gmailUser;

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });
}

async function sendMail({ to, subject, text }) {
  await initMailerIfNeeded();
  if (!transporter) return;

  await transporter.sendMail({
    from: gmailUserForFrom,
    to,
    subject,
    text,
  });
}

// =====================
// Yahoo Finance helpers
// =====================
function pickRangeByInterval(interval) {
  // Yahoo は interval によって取得できる期間が違うのでざっくり最適化
  if (interval.endsWith('m')) return '5d';
  if (interval.endsWith('h')) return '60d';
  if (interval === '1d') return '1y';
  if (interval === '1wk') return '5y';
  return '1y';
}

function normalizeInterval(interval) {
  return String(interval || '1d');
}

async function fetchYahooChart(ticker, interval) {
  const iv = normalizeInterval(interval);
  const range = pickRangeByInterval(iv);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?interval=${encodeURIComponent(iv)}&range=${encodeURIComponent(range)}`;

  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`Yahoo chart fetch failed: HTTP ${r.status}`);
  const j = await r.json();

  const result = j?.chart?.result?.[0];
  if (!result) throw new Error('Yahoo chart: empty result');

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];

  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    if (t == null || o == null || h == null || l == null || c == null) continue;
    candles.push({ time: t, open: o, high: h, low: l, close: c });
  }

  candles.sort((a, b) => a.time - b.time);
  return candles;
}

function aggregateCandles(candles, targetInterval) {
  if (!candles || candles.length === 0) return [];
  const hours = parseInt(String(targetInterval).replace('h', ''), 10);
  if (!Number.isFinite(hours) || hours <= 1) return candles;

  const out = [];
  let cur = null;
  let curStart = null;

  for (const c of candles) {
    const d = new Date(c.time * 1000);
    const hour = d.getUTCHours();
    const startHour = Math.floor(hour / hours) * hours;

    const startDate = new Date(d);
    startDate.setUTCHours(startHour, 0, 0, 0);
    const start = Math.floor(startDate.getTime() / 1000);

    if (!cur || start !== curStart) {
      if (cur) out.push(cur);
      cur = { time: start, open: c.open, high: c.high, low: c.low, close: c.close };
      curStart = start;
    } else {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
    }
  }
  if (cur) out.push(cur);
  return out;
}

// 簡易キャッシュ（同一ticker/intervalを短時間に多重取得しない）
const CANDLE_CACHE = new Map(); // key => { ts, candles }
const CACHE_TTL_MS = 15_000;

async function getCandlesWithCache(ticker, interval) {
  const key = `${ticker}|${interval}`;
  const now = Date.now();
  const hit = CANDLE_CACHE.get(key);
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.candles;

  let candles;
  if (interval === '4h' || interval === '8h') {
    const base = await fetchYahooChart(ticker, '1h');
    candles = aggregateCandles(base, interval);
  } else {
    candles = await fetchYahooChart(ticker, interval);
  }

  CANDLE_CACHE.set(key, { ts: now, candles });
  return candles;
}

// =====================
// Real-time State helpers
// =====================
function nowIso() {
  return new Date().toISOString();
}

function normalizeXValue(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

function ensureObj(o) {
  return o && typeof o === 'object' ? o : {};
}

function ensureRealTimeState(settings) {
  const s = ensureObj(settings);
  if (!s.realTimeState || typeof s.realTimeState !== 'object') s.realTimeState = {};
  if (!s.realTimeState.crossHistory || typeof s.realTimeState.crossHistory !== 'object') {
    s.realTimeState.crossHistory = {};
  }
  if (
    !s.realTimeState.cryptoCrossHistoryByTicker ||
    typeof s.realTimeState.cryptoCrossHistoryByTicker !== 'object'
  ) {
    s.realTimeState.cryptoCrossHistoryByTicker = {};
  }
  return s.realTimeState;
}

function ensureIntervalMap(root, interval) {
  const iv = String(interval || 'unknown');
  if (!root[iv] || typeof root[iv] !== 'object') root[iv] = {};
  return root[iv];
}

// --- USDJPY crossHistory clear helpers ---
function clearBbCrossHistory(realTimeState) {
  const ch = realTimeState?.crossHistory;
  if (!ch || typeof ch !== 'object') return;
  const bands = ['upper2', 'upper1', 'middle', 'lower1', 'lower2'];
  for (const [iv, map] of Object.entries(ch)) {
    if (!map || typeof map !== 'object') continue;
    for (const k of bands) map[k] = null;
  }
}

function clearEmaCrossHistory(realTimeState) {
  const ch = realTimeState?.crossHistory;
  if (!ch || typeof ch !== 'object') return;
  const emas = ['ema10', 'ema25', 'ema50'];
  for (const [iv, map] of Object.entries(ch)) {
    if (!map || typeof map !== 'object') continue;
    for (const k of emas) map[k] = null;
  }
}

// --- crypto crossHistory helpers ---
function ensureCryptoPerTickerState(realTimeState) {
  // cryptoCrossHistoryByTicker[ticker][interval][indicator]
  const root = realTimeState.cryptoCrossHistoryByTicker;
  if (!root || typeof root !== 'object') realTimeState.cryptoCrossHistoryByTicker = {};
  return realTimeState.cryptoCrossHistoryByTicker;
}

function clearCryptoBbHistory(realTimeState) {
  const root = realTimeState?.cryptoCrossHistoryByTicker;
  if (!root || typeof root !== 'object') return;
  const bands = ['upper2', 'upper1', 'middle', 'lower1', 'lower2'];

  for (const ticker of Object.keys(root)) {
    const byIv = root[ticker];
    if (!byIv || typeof byIv !== 'object') continue;
    for (const iv of Object.keys(byIv)) {
      const map = byIv[iv];
      if (!map || typeof map !== 'object') continue;
      for (const k of bands) {
        if (k in map) map[k] = null;
      }
    }
  }
}

function clearCryptoEmaHistory(realTimeState) {
  const root = realTimeState?.cryptoCrossHistoryByTicker;
  if (!root || typeof root !== 'object') return;

  for (const ticker of Object.keys(root)) {
    const byIv = root[ticker];
    if (!byIv || typeof byIv !== 'object') continue;
    for (const iv of Object.keys(byIv)) {
      const map = byIv[iv];
      if (!map || typeof map !== 'object') continue;

      for (const k of Object.keys(map)) {
        if (String(k).startsWith('ema')) map[k] = null;
      }
    }
  }
}

// =====================
// Settings DB helpers
// =====================
async function getUserSettings(userId) {
  const r = await pool.query('SELECT settings FROM user_settings WHERE user_id = $1', [userId]);
  return r.rows[0]?.settings || null;
}

async function upsertUserSettings(userId, settings) {
  await pool.query(
    `
    INSERT INTO user_settings (user_id, settings, updated_at)
    VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE
      SET settings = EXCLUDED.settings,
          updated_at = CURRENT_TIMESTAMP
    `,
    [userId, JSON.stringify(settings || {})]
  );
}

// =====================
// API: Auth
// =====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password } = req.body || {};
    if (!email || !username || !password) return res.status(400).json({ error: 'Missing fields.' });

    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      `INSERT INTO users (email, username, password_hash, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       RETURNING id, email, username`,
      [email, username, hash]
    );

    req.session.userId = r.rows[0].id;
    return res.json({ user: r.rows[0] });
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg.includes('duplicate key')) return res.status(409).json({ error: 'Email or username already exists.' });
    console.error(e);
    return res.status(500).json({ error: 'Server error.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const body = req.body || {};

    // ✅ 受け取りキーのズレ吸収（400対策）
    const identifier =
      body.identifier ||
      body.emailOrUsername ||
      body.email_or_username ||
      body.loginId ||
      body.login_id ||
      body.email ||
      body.username;

    const password = body.password;

    if (!identifier || !password) return res.status(400).json({ error: 'Missing fields.' });

    const r = await pool.query(
      `SELECT id, email, username, password_hash FROM users WHERE email = $1 OR username = $1 LIMIT 1`,
      [identifier]
    );
    const u = r.rows[0];
    if (!u) return res.status(401).json({ error: 'Invalid credentials.' });

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

    req.session.userId = u.id;
    return res.json({ user: { id: u.id, email: u.email, username: u.username } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out.' });
  });
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const uid = req.session?.userId;
    if (!uid) return res.status(401).json({ error: 'Not authenticated.' });

    const r = await pool.query('SELECT id, email, username FROM users WHERE id = $1', [uid]);
    const u = r.rows[0];
    if (!u) return res.status(401).json({ error: 'Not authenticated.' });

    return res.json({ user: u });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// =====================
// API: User Settings
// =====================
app.get('/api/user/settings', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userId;
    const settings = (await getUserSettings(uid)) || {};
    // client は {settings: {...}, ...raw} をマージして読むので両方返す
    return res.json({ settings, ...settings });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to load settings.' });
  }
});

app.post('/api/user/settings', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userId;
    const incoming = ensureObj(req.body);

    const existing = (await getUserSettings(uid)) || {};
    const merged = { ...existing, ...incoming };

    // ✅ realTimeState は既存を引き継ぐ（incoming に含まれても安全にマージ）
    const rtExisting = ensureRealTimeState(existing);
    const rtMerged = ensureRealTimeState(merged);

    rtMerged.crossHistory = rtMerged.crossHistory || rtExisting.crossHistory || {};
    rtMerged.cryptoCrossHistoryByTicker =
      rtMerged.cryptoCrossHistoryByTicker || rtExisting.cryptoCrossHistoryByTicker || {};

    // ✅ 非表示＝判定しない + OFFにした瞬間に該当履歴だけ消す（事故防止）
    const bbEnabled = merged.areBollingerBandsVisible !== false;
    const emaEnabled = merged.areEmaVisible !== false;

    if (!bbEnabled) {
      clearBbCrossHistory(rtMerged);
      clearCryptoBbHistory(rtMerged);
    }
    if (!emaEnabled) {
      clearEmaCrossHistory(rtMerged);
      clearCryptoEmaHistory(rtMerged);
    }

    merged.realTimeState = rtMerged;

    await upsertUserSettings(uid, merged);

    // ✅ クライアントUIも即反映できるようにクリアイベントを投げる（USDJPY）
    if (!bbEnabled) {
      const bands = ['upper2', 'upper1', 'middle', 'lower1', 'lower2'];
      for (const iv of Object.keys(rtMerged.crossHistory || {})) {
        for (const b of bands) {
          io.to(userRoom(uid)).emit('cross_history_cleared', { indicatorName: b, interval: iv });
        }
      }
    }
    if (!emaEnabled) {
      const emas = ['ema10', 'ema25', 'ema50'];
      for (const iv of Object.keys(rtMerged.crossHistory || {})) {
        for (const e of emas) {
          io.to(userRoom(uid)).emit('cross_history_cleared', { indicatorName: e, interval: iv });
        }
      }
    }

    // crypto 用（現状UIはログのみ）
    if (!bbEnabled) io.to(userRoom(uid)).emit('crypto_cross_history_cleared', { cleared: true, type: 'bb' });
    if (!emaEnabled) io.to(userRoom(uid)).emit('crypto_cross_history_cleared', { cleared: true, type: 'ema' });

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to save settings.' });
  }
});

// =====================
// API: Email subscriptions (user-scoped)
// =====================
app.post('/api/subscribe', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userId;
    const { email } = req.body || {};
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Invalid email.' });

    await pool.query(
      `INSERT INTO emails (user_id, email) VALUES ($1, $2)
       ON CONFLICT (user_id, email) DO NOTHING`,
      [uid, email]
    );

    return res.json({ message: '登録しました。' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to subscribe.' });
  }
});

app.get('/api/emails', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userId;
    const r = await pool.query(`SELECT email FROM emails WHERE user_id = $1 ORDER BY created_at DESC`, [uid]);
    return res.json(r.rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to fetch emails.' });
  }
});

app.delete('/api/emails/:email', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userId;
    const email = decodeURIComponent(req.params.email || '');
    await pool.query(`DELETE FROM emails WHERE user_id = $1 AND email = $2`, [uid, email]);
    return res.json({ message: '削除しました。' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to delete email.' });
  }
});

// 手動送信ボタン（必要なら）
app.post('/api/send-emails', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userId;
    const r = await pool.query(`SELECT email FROM emails WHERE user_id = $1`, [uid]);
    const list = r.rows.map((x) => x.email);

    if (list.length === 0) return res.json({ message: '送信先がありません。' });

    await sendMail({
      to: list.join(','),
      subject: 'Parabolic Notification',
      text: 'テスト送信です。',
    });

    return res.json({ message: 'メールを送信しました。' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to send emails.' });
  }
});

// =====================
// API: Market data (for client charts)
// =====================
app.get('/api/data', async (req, res) => {
  try {
    const ticker = req.query.ticker;
    const interval = req.query.interval || '1d';
    if (!ticker) return res.status(400).json({ error: 'ticker required' });

    const candles = await getCandlesWithCache(ticker, interval);
    const out = candles.map((c) => ({
      date: new Date(c.time * 1000).toISOString(),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    return res.json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to fetch data.' });
  }
});

app.get('/api/usd_jpy_data', async (req, res) => {
  try {
    const interval = req.query.interval || '1d';
    const candles = await getCandlesWithCache('USDJPY=X', interval);
    const out = candles.map((c) => ({
      date: new Date(c.time * 1000).toISOString(),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    return res.json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to fetch USDJPY data.' });
  }
});

// 例：プルダウン用
app.get('/api/crypto/tickers', async (req, res) => {
  return res.json(['BTC-USD', 'ETH-USD', 'BCH-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD']);
});

// =====================
// Cross detection helpers
// =====================
function crossed(prevClose, curClose, prevLine, curLine) {
  if (![prevClose, curClose, prevLine, curLine].every((x) => Number.isFinite(x))) return false;
  const wasBelow = prevClose < prevLine;
  const isAbove = curClose >= curLine;
  const wasAbove = prevClose > prevLine;
  const isBelow = curClose <= curLine;
  return (wasBelow && isAbove) || (wasAbove && isBelow);
}

function eventObj(price, interval) {
  return { price, interval, timestamp: nowIso() };
}

// =====================
// Watchers (USDJPY + Crypto)
// =====================
async function processUsdJpyForUser(userId, settings) {
  const iv = normalizeInterval(settings.currentInterval || '1d');

  const bbEnabled = settings.areBollingerBandsVisible !== false;
  const emaEnabled = settings.areEmaVisible !== false;
  const emailEnabled = settings.emailAlertsEnabled !== false;

  const rt = ensureRealTimeState(settings);
  const crossHistory = rt.crossHistory;
  const ivMap = ensureIntervalMap(crossHistory, iv);

  const candles = await getCandlesWithCache('USDJPY=X', iv);
  if (!candles || candles.length < 30) return;

  const closes = candles.map((c) => c.close);
  const prevClose = closes[closes.length - 2];
  const curClose = closes[closes.length - 1];

  // price update (UIの現在値更新用)
  io.to(userRoom(userId)).emit('usd_jpy_price_update', { price: curClose });

  // ---- BB cross ----
  const bbPeriod = parseInt(settings.bbPeriod, 10) || 20;
  const bbStdDev = Number(settings.bbStdDev) || 2;

  if (bbEnabled) {
    const bb1 = BollingerBands.calculate({ period: bbPeriod, values: closes, stdDev: 1 });
    const bb2 = BollingerBands.calculate({ period: bbPeriod, values: closes, stdDev: bbStdDev });

    if (bb1.length >= 2 && bb2.length >= 2) {
      const prevIdx = bb1.length - 2;
      const curIdx = bb1.length - 1;

      const prev1 = bb1[prevIdx];
      const cur1 = bb1[curIdx];
      const prev2 = bb2[prevIdx];
      const cur2 = bb2[curIdx];

      const checks = [
        { key: 'upper2', prev: prev2.upper, cur: cur2.upper, label: '+2σ' },
        { key: 'upper1', prev: prev1.upper, cur: cur1.upper, label: '+1σ' },
        { key: 'middle', prev: prev1.middle, cur: cur1.middle, label: '0σ' },
        { key: 'lower1', prev: prev1.lower, cur: cur1.lower, label: '-1σ' },
        { key: 'lower2', prev: prev2.lower, cur: cur2.lower, label: '-2σ' },
      ];

      for (const x of checks) {
        if (crossed(prevClose, curClose, x.prev, x.cur)) {
          ivMap[x.key] = eventObj(curClose, iv);
          io.to(userRoom(userId)).emit('bb_cross', {
            bandName: x.key,
            interval: iv,
            price: curClose,
            timestamp: ivMap[x.key].timestamp,
            message: `USD/JPY: 価格がBB ${x.label} をクロスしました (${iv})`,
          });
        }
      }
    }
  }

  // ---- EMA cross ----
  const emaPeriods = [
    parseInt(settings.ema1Period, 10) || 10,
    parseInt(settings.ema2Period, 10) || 25,
    parseInt(settings.ema3Period, 10) || 50,
  ];

  if (emaEnabled) {
    for (const p of emaPeriods) {
      const ema = EMA.calculate({ period: p, values: closes, exact: false });
      if (ema.length < 2) continue;

      const prevE = ema[ema.length - 2];
      const curE = ema[ema.length - 1];

      if (crossed(prevClose, curClose, prevE, curE)) {
        const key = `ema${p}`;
        ivMap[key] = eventObj(curClose, iv);
        io.to(userRoom(userId)).emit('ema_cross', {
          emaName: key,
          interval: iv,
          price: curClose,
          timestamp: ivMap[key].timestamp,
          message: `USD/JPY: 価格がEMA(${p})をクロスしました (${iv})`,
        });
      }
    }
  }

  // ---- Threshold email + clear (respect toggles) ----
  if (emailEnabled) {
    const x = normalizeXValue(settings.x_values?.[iv]);
    if (x != null) {
      const rMail = await pool.query(`SELECT email FROM users WHERE id = $1`, [userId]);
      const userEmail = rMail.rows[0]?.email || null;

      const rSubs = await pool.query(`SELECT email FROM emails WHERE user_id = $1`, [userId]);
      const extra = rSubs.rows.map((z) => z.email);
      const recipients = [userEmail, ...extra].filter(Boolean);

      if (recipients.length > 0) {
        for (const [name, ev] of Object.entries(ivMap || {})) {
          if (!ev || typeof ev !== 'object' || !Number.isFinite(ev.price)) continue;

          const isEma = String(name).startsWith('ema');
          if (isEma && !emaEnabled) continue;
          if (!isEma && !bbEnabled) continue;

          const diff = Math.abs(curClose - ev.price);
          if (diff >= x) {
            await sendMail({
              to: recipients.join(','),
              subject: `USD/JPY Alert (${iv})`,
              text: `USD/JPY がしきい値に到達しました。\ninterval=${iv}\nindicator=${name}\ncrossPrice=${ev.price}\ncurrentPrice=${curClose}\ndiff=${diff}\nthreshold=${x}`,
            });

            // clear
            ivMap[name] = null;
            io.to(userRoom(userId)).emit('cross_history_cleared', { indicatorName: name, interval: iv });
          }
        }
      }
    }
  }

  settings.realTimeState = rt;
  await upsertUserSettings(userId, settings);
}

async function processCryptoForUser(userId, settings) {
  const bbEnabled = settings.areBollingerBandsVisible !== false;
  const emaEnabled = settings.areEmaVisible !== false;
  const emailEnabled = settings.emailAlertsEnabled !== false;

  const rt = ensureRealTimeState(settings);
  const root = ensureCryptoPerTickerState(rt);

  // 監視対象：crypto_x_values に載ってる ticker を優先。無ければ currentCryptoTicker
  const cx = ensureObj(settings.crypto_x_values);
  const tickers =
    Object.keys(cx).length > 0 ? Object.keys(cx) : [settings.currentCryptoTicker || 'BTC-USD'];

  const iv = normalizeInterval(settings.currentInterval || '1d');

  for (const ticker of tickers) {
    if (!ticker) continue;

    if (!root[ticker] || typeof root[ticker] !== 'object') root[ticker] = {};
    const byIv = root[ticker];
    const ivMap = ensureIntervalMap(byIv, iv);

    const candles = await getCandlesWithCache(ticker, iv);
    if (!candles || candles.length < 30) continue;

    const closes = candles.map((c) => c.close);
    const prevClose = closes[closes.length - 2];
    const curClose = closes[closes.length - 1];

    // ---- BB cross ----
    const bbPeriod = parseInt(settings.bbPeriod, 10) || 20;
    const bbStdDev = Number(settings.bbStdDev) || 2;

    if (bbEnabled) {
      const bb1 = BollingerBands.calculate({ period: bbPeriod, values: closes, stdDev: 1 });
      const bb2 = BollingerBands.calculate({ period: bbPeriod, values: closes, stdDev: bbStdDev });

      if (bb1.length >= 2 && bb2.length >= 2) {
        const prev1 = bb1[bb1.length - 2];
        const cur1 = bb1[bb1.length - 1];
        const prev2 = bb2[bb2.length - 2];
        const cur2 = bb2[bb2.length - 1];

        const checks = [
          { key: 'upper2', prev: prev2.upper, cur: cur2.upper, label: '+2σ' },
          { key: 'upper1', prev: prev1.upper, cur: cur1.upper, label: '+1σ' },
          { key: 'middle', prev: prev1.middle, cur: cur1.middle, label: '0σ' },
          { key: 'lower1', prev: prev1.lower, cur: cur1.lower, label: '-1σ' },
          { key: 'lower2', prev: prev2.lower, cur: cur2.lower, label: '-2σ' },
        ];

        for (const x of checks) {
          if (crossed(prevClose, curClose, x.prev, x.cur)) {
            ivMap[x.key] = eventObj(curClose, iv);
            io.to(userRoom(userId)).emit('crypto_bb_cross', {
              ticker,
              bandName: x.key,
              interval: iv,
              price: curClose,
              timestamp: ivMap[x.key].timestamp,
              message: `${ticker}: 価格がBB ${x.label} をクロスしました (${iv})`,
            });
          }
        }
      }
    }

    // ---- EMA cross ----
    const emaPeriods = [
      parseInt(settings.ema1Period, 10) || 10,
      parseInt(settings.ema2Period, 10) || 25,
      parseInt(settings.ema3Period, 10) || 50,
    ];

    if (emaEnabled) {
      for (const p of emaPeriods) {
        const ema = EMA.calculate({ period: p, values: closes, exact: false });
        if (ema.length < 2) continue;

        const prevE = ema[ema.length - 2];
        const curE = ema[ema.length - 1];

        if (crossed(prevClose, curClose, prevE, curE)) {
          const key = `ema${p}`;
          ivMap[key] = eventObj(curClose, iv);
          io.to(userRoom(userId)).emit('crypto_ema_cross', {
            ticker,
            emaName: key,
            interval: iv,
            price: curClose,
            timestamp: ivMap[key].timestamp,
            message: `${ticker}: 価格がEMA(${p})をクロスしました (${iv})`,
          });
        }
      }
    }

    // ---- Threshold email + clear (respect toggles) ----
    if (emailEnabled) {
      const threshold = normalizeXValue(cx?.[ticker]?.[iv]);
      if (threshold != null) {
        const rMail = await pool.query(`SELECT email FROM users WHERE id = $1`, [userId]);
        const userEmail = rMail.rows[0]?.email || null;

        const rSubs = await pool.query(`SELECT email FROM emails WHERE user_id = $1`, [userId]);
        const extra = rSubs.rows.map((z) => z.email);
        const recipients = [userEmail, ...extra].filter(Boolean);

        if (recipients.length > 0) {
          for (const [name, ev] of Object.entries(ivMap || {})) {
            if (!ev || typeof ev !== 'object' || !Number.isFinite(ev.price)) continue;

            const isEma = String(name).startsWith('ema');
            if (isEma && !emaEnabled) continue;
            if (!isEma && !bbEnabled) continue;

            const diff = Math.abs(curClose - ev.price);
            if (diff >= threshold) {
              await sendMail({
                to: recipients.join(','),
                subject: `${ticker} Alert (${iv})`,
                text: `${ticker} がしきい値に到達しました。\ninterval=${iv}\nindicator=${name}\ncrossPrice=${ev.price}\ncurrentPrice=${curClose}\ndiff=${diff}\nthreshold=${threshold}`,
              });

              ivMap[name] = null;
              io.to(userRoom(userId)).emit('crypto_cross_history_cleared', {
                ticker,
                interval: iv,
                indicatorName: name,
              });
            }
          }
        }
      }
    }
  }

  settings.realTimeState = rt;
  await upsertUserSettings(userId, settings);
}

async function watcherTick() {
  try {
    const r = await pool.query(
      `SELECT u.id AS user_id, s.settings
       FROM users u
       LEFT JOIN user_settings s ON s.user_id = u.id`
    );

    for (const row of r.rows) {
      const userId = row.user_id;
      const settings = ensureObj(row.settings);

      // realTimeState を必ず初期化しておく
      ensureRealTimeState(settings);

      // USDJPY は x_values がある or dataType が usd_jpy の時に動かす
      const hasUsdX =
        settings.x_values && typeof settings.x_values === 'object' && Object.keys(settings.x_values).length > 0;
      const wantsUsd = settings.currentDataType === 'usd_jpy' || hasUsdX;
      if (wantsUsd) {
        await processUsdJpyForUser(userId, settings);
      }

      // crypto は crypto_x_values がある or dataType が crypto の時に動かす
      const hasCryptoX =
        settings.crypto_x_values &&
        typeof settings.crypto_x_values === 'object' &&
        Object.keys(settings.crypto_x_values).length > 0;
      const wantsCrypto = settings.currentDataType === 'crypto' || hasCryptoX;
      if (wantsCrypto) {
        await processCryptoForUser(userId, settings);
      }
    }
  } catch (e) {
    console.error('[watcherTick] error:', e);
  }
}

let watcherStarted = false;
function startWatchers() {
  if (watcherStarted) return;
  watcherStarted = true;

  // 15秒おき（必要なら調整）
  setInterval(watcherTick, 15_000);
}

// =====================
// Boot
// =====================
(async () => {
  try {
    await ensureTables();
    startWatchers();
    server.listen(PORT, () => {
      console.log(`Server listening on :${PORT}`);
    });
  } catch (e) {
    console.error('Failed to boot server:', e);
    process.exit(1);
  }
})();
