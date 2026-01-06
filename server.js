// server.js（B案：クロス時intervalを保存してメールに表示・全文）
// + BB表示名を upper/lower/middle から ±σ 表記に変更
// + ✅ 追加：送信メール本文の一番下に【サイト】URLを追記

const nodemailer = require("nodemailer");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { SSMClient, GetParametersCommand } = require("@aws-sdk/client-ssm");
const bcrypt = require("bcrypt");
const session = require("express-session");
const http = require("http");
const { Server } = require("socket.io");
const { BollingerBands, EMA } = require("technicalindicators");

let transporter;
let gmailUserForFrom = null;

// ✅ 追加：サイトURL（環境変数があればそれを優先）
const SITE_URL = process.env.SITE_URL || "http://13.192.112.191:3000/";

// ✅ 追加：メール末尾にサイト情報を付ける（text/html両対応）
function appendSiteBlockToMail(text, html) {
  const siteText = `\n\n【サイト】\n${SITE_URL}\n`;
  const siteHtml = `<hr><p><strong>【サイト】</strong><br><a href="${SITE_URL}">${SITE_URL}</a></p>`;

  return {
    text: (text || "") + siteText,
    html: (html || "") + siteHtml,
  };
}

// ===== 表示名変換（DBキーは維持して、表示だけ変える） =====
function getIndicatorDisplayName(indicatorName) {
  const bbMap = {
    upper2: "+2σ",
    upper1: "+1σ",
    middle: "0σ",
    lower1: "-1σ",
    lower2: "-2σ",
  };
  if (bbMap[indicatorName]) return bbMap[indicatorName];

  // EMA はそのまま "EMA10" などに揃える（メール/通知用）
  if (indicatorName?.startsWith("ema")) return `EMA${indicatorName.slice(3)}`;

  // それ以外はフォールバック
  return String(indicatorName ?? "");
}

// This function fetches credentials from AWS Parameter Store and configures Nodemailer
async function configureNodemailer() {
  try {
    const ssmClient = new SSMClient({
      region: process.env.AWS_REGION || "ap-northeast-1",
    });
    const command = new GetParametersCommand({
      Names: ["/parabolic/gmail/user", "/parabolic/gmail/pass"],
      WithDecryption: true,
    });

    const { Parameters } = await ssmClient.send(command);

    const gmailUser = Parameters.find((p) => p.Name === "/parabolic/gmail/user")?.Value;
    const gmailPass = Parameters.find((p) => p.Name === "/parabolic/gmail/pass")?.Value;

    if (!gmailUser || !gmailPass) {
      throw new Error("Gmail credentials not found in Parameter Store.");
    }

    gmailUserForFrom = gmailUser;

    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    console.log("Nodemailer configured successfully with credentials from Parameter Store.");
  } catch (error) {
    console.error("Failed to configure Nodemailer from Parameter Store:", error);
  }
}

const app = express();
const port = 3000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// --- Real-time Price Watcher for USD/JPY ---
io.on("connection", (socket) => {
  const sess = socket.request.session;
  if (sess && sess.userId) {
    socket.userId = sess.userId;
    console.log(`User connected: ${socket.id}, userId: ${socket.userId}`);
  } else {
    console.log(`Anonymous user connected: ${socket.id}`);
  }

  socket.on("disconnect", () => {
    console.log(`user disconnected: ${socket.id}`);
  });
});

// --- Database Setup ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
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
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        x_value NUMERIC DEFAULT 0
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

// --- Session Middleware for Authentication ---
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "your_secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
  },
});
app.use(sessionMiddleware);

// Share session with socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

app.use(express.static("dist"));
app.use(express.static(__dirname));

// A simple caching mechanism
const cache = {};
const CACHE_TTL = 30 * 1000; // 30 seconds

// ===== Yahoo Chart API (fetch) helper =====
async function fetchYahooChartQuotes(symbol, interval, period1Date, period2Date) {
  const p1 = Math.floor(period1Date.getTime() / 1000);
  const p2 = Math.floor(period2Date.getTime() / 1000);

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${encodeURIComponent(interval)}&period1=${p1}&period2=${p2}`;

  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
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
 * ✅ 追加：USD/JPY現在値を「quote → ダメなら chart」で取得
 * quote が 403/429 で落ちても watcher を止めないための仕組み
 */
async function fetchUsdJpyCurrentPrice() {
  const ticker = "USDJPY=X";

  // ① quote（速いが弾かれやすい）
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    const text = await resp.text();

    if (!resp.ok) {
      console.error(`Yahoo quote HTTP ${resp.status}: ${text.slice(0, 200)}`);
    } else {
      const json = JSON.parse(text);
      const p = json?.quoteResponse?.result?.[0]?.regularMarketPrice;
      if (typeof p === "number") return p;
      console.error(`Yahoo quote OK but price missing: ${text.slice(0, 200)}`);
    }
  } catch (e) {
    console.error("Yahoo quote fetch error:", e);
  }

  // ② fallback：chart の最新 close を現在値扱い（通りやすい）
  try {
    const period2 = new Date();
    const period1 = new Date(period2.getTime() - 2 * 24 * 60 * 60 * 1000);
    const quotes = await fetchYahooChartQuotes(ticker, "1m", period1, period2);
    const last = quotes[quotes.length - 1];
    if (last?.close != null) return last.close;
    console.error("Yahoo chart fallback OK but last.close missing");
  } catch (e) {
    console.error("Yahoo chart fallback fetch error:", e);
  }

  return null;
}

// --- API Endpoints for Authentication ---
app.post("/api/auth/register", async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ error: "Email, username, and password are required." });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "Please provide a valid email address." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username",
      [email, username, hashedPassword]
    );
    const user = result.rows[0];
    req.session.userId = user.id;
    res.status(201).json({
      message: "Registration successful!",
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error.code === "23505") {
      if (error.detail?.includes("email")) return res.status(409).json({ error: "Email already in use." });
      if (error.detail?.includes("username")) return res.status(409).json({ error: "Username already taken." });
    }
    res.status(500).json({ error: "An internal server error occurred during registration." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { emailOrUsername, password } = req.body;

  if (!emailOrUsername || !password) {
    return res.status(400).json({ error: "Email/username and password are required." });
  }

  try {
    const result = await pool.query("SELECT id, email, username, password_hash FROM users WHERE email = $1 OR username = $1", [
      emailOrUsername,
    ]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) return res.status(401).json({ error: "Invalid credentials." });

    req.session.userId = user.id;
    res.status(200).json({
      message: "Login successful!",
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "An internal server error occurred during login." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Failed to log out." });
    }
    res.clearCookie("connect.sid");
    res.status(200).json({ message: "Logout successful!" });
  });
});

app.get("/api/auth/me", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated." });

  try {
    const result = await pool.query("SELECT id, email, username FROM users WHERE id = $1", [req.session.userId]);
    const user = result.rows[0];

    if (!user) {
      req.session.destroy();
      return res.status(401).json({ error: "User not found or session invalid." });
    }
    res.status(200).json({ user: { id: user.id, email: user.email, username: user.username } });
  } catch (error) {
    console.error("Fetch user error:", error);
    res.status(500).json({ error: "An internal server error occurred." });
  }
});

// API to get user settings
app.get("/api/user/settings", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated." });

  try {
    const result = await pool.query("SELECT settings FROM user_settings WHERE user_id = $1", [req.session.userId]);
    if (result.rows.length > 0) return res.status(200).json(result.rows[0].settings);
    return res.status(200).json({});
  } catch (error) {
    console.error("Fetch user settings error:", error);
    res.status(500).json({ error: "An internal server error occurred while fetching settings." });
  }
});

// API to save/update user settings（重複してたので1つだけ）
// ===== FIX: 既存settingsとマージして realTimeState を消さない =====
app.post("/api/user/settings", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated." });

  const settings = req.body;

  try {
    const result = await pool.query(
      `
      INSERT INTO user_settings (user_id, settings)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET
        settings = user_settings.settings || EXCLUDED.settings,
        updated_at = CURRENT_TIMESTAMP
      RETURNING settings
      `,
      [req.session.userId, settings]
    );
    res.status(200).json(result.rows[0].settings);
  } catch (error) {
    console.error("Save user settings error:", error);
    res.status(500).json({ error: "An internal server error occurred while saving settings." });
  }
});

// API to get user's x_value
app.get("/api/user/x_value", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated." });

  try {
    const result = await pool.query("SELECT x_value FROM users WHERE id = $1", [req.session.userId]);
    if (result.rows.length > 0) return res.status(200).json({ x_value: result.rows[0].x_value });
    return res.status(404).json({ error: "User not found." });
  } catch (error) {
    console.error("Fetch user x_value error:", error);
    res.status(500).json({ error: "An internal server error occurred while fetching x_value." });
  }
});

// API to update user's x_value
app.post("/api/user/x_value", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated." });

  const { x_value } = req.body;
  if (typeof x_value !== "number" || isNaN(x_value)) {
    return res.status(400).json({ error: "x_value must be a number." });
  }

  try {
    const result = await pool.query("UPDATE users SET x_value = $1 WHERE id = $2 RETURNING x_value", [
      x_value,
      req.session.userId,
    ]);
    if (result.rows.length > 0) {
      return res.status(200).json({ message: "x_value updated successfully.", x_value: result.rows[0].x_value });
    }
    return res.status(404).json({ error: "User not found." });
  } catch (error) {
    console.error("Update user x_value error:", error);
    res.status(500).json({ error: "An internal server error occurred while updating x_value." });
  }
});

// ✅ 追加：client側でクロス履歴をクリアしたら server(DB)側もクリアして整合を取る
app.post("/api/user/cross_history/clear", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated." });

  const { indicatorNames } = req.body;
  if (!Array.isArray(indicatorNames) || indicatorNames.length === 0) {
    return res.status(400).json({ error: "indicatorNames must be a non-empty array." });
  }

  try {
    const r = await pool.query("SELECT settings FROM user_settings WHERE user_id = $1", [req.session.userId]);
    const settings = r.rows?.[0]?.settings || {};

    const realTimeState = settings.realTimeState || {};
    const crossHistory = realTimeState.crossHistory || {};

    for (const name of indicatorNames) {
      crossHistory[String(name)] = null;
    }

    const newSettings = {
      ...settings,
      realTimeState: {
        ...realTimeState,
        crossHistory,
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

    return res.status(200).json({ message: "crossHistory cleared.", crossHistory });
  } catch (e) {
    console.error("Clear cross_history error:", e);
    return res.status(500).json({ error: "An internal server error occurred while clearing cross history." });
  }
});

// Subscribe email
app.post("/api/subscribe", async (req, res) => {
  const { email } = req.body;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "Please provide a valid email address." });
  }

  try {
    const result = await pool.query("INSERT INTO emails (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING *", [
      email,
    ]);

    if (result.rows.length > 0) return res.status(201).json({ message: "Thank you for subscribing!", email: result.rows[0] });
    return res.status(200).json({ message: "You are already subscribed." });
  } catch (error) {
    console.error("Database insertion error:", error);
    return res.status(500).json({ error: "An internal server error occurred." });
  }
});

app.get("/api/emails", async (req, res) => {
  try {
    const result = await pool.query("SELECT email FROM emails ORDER BY created_at DESC");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Database query error:", error);
    return res.status(500).json({ error: "An internal server error occurred." });
  }
});

app.delete("/api/emails/:email", async (req, res) => {
  const { email } = req.params;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "Please provide a valid email address." });
  }

  try {
    const result = await pool.query("DELETE FROM emails WHERE email = $1 RETURNING email", [email]);
    if (result.rowCount > 0) return res.status(200).json({ message: `Email ${email} deleted successfully.` });
    return res.status(404).json({ error: `Email ${email} not found.` });
  } catch (error) {
    console.error("Database deletion error:", error);
    return res.status(500).json({ error: "An internal server error occurred." });
  }
});

app.post("/api/send-emails", async (req, res) => {
  if (!transporter) {
    return res.status(500).json({ error: "Email service is not configured. Please check the server logs." });
  }

  try {
    const result = await pool.query("SELECT email FROM emails");
    const emails = result.rows.map((row) => row.email);

    if (emails.length === 0) {
      return res.status(404).json({ message: "No emails found to send." });
    }

    let mailOptions = {
      from: `"Parabolic" <${gmailUserForFrom || process.env.GMAIL_USER}>`,
      subject: "条件達成",
      text: "おめでとうございます。条件達成です。",
      html: "<p>おめでとうございます。条件達成です。</p>",
    };

    // ✅ 追加：サイト追記
    mailOptions = { ...mailOptions, ...appendSiteBlockToMail(mailOptions.text, mailOptions.html) };

    for (const email of emails) {
      await transporter.sendMail({ ...mailOptions, to: email });
      console.log(`Email sent to ${email}`);
    }

    res.status(200).json({ message: "Emails sent successfully." });
  } catch (error) {
    console.error("Error sending emails:", error);
    res.status(500).json({ error: "An internal server error occurred while sending emails." });
  }
});

// =====================
//   Price Data APIs
// =====================
app.get("/api/data", async (req, res) => {
  const { ticker, interval } = req.query;

  if (!ticker || !interval) {
    return res.status(400).json({ error: "Ticker and interval are required" });
  }

  const cacheKey = `stock-${ticker}-${interval}`;
  const now = Date.now();

  if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_TTL) {
    return res.json(cache[cacheKey].data);
  }

  const validIntervals = ["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "4h", "8h", "1d", "5d", "1wk", "1mo", "3mo"];
  if (!validIntervals.includes(interval)) {
    return res.status(400).json({ error: `Invalid interval. Valid intervals are: ${validIntervals.join(", ")}` });
  }

  let daysToFetch;
  let actualInterval = interval;

  switch (interval) {
    case "1m":
      daysToFetch = 7;
      break;
    case "2m":
    case "5m":
    case "15m":
    case "30m":
      daysToFetch = 30;
      break;
    case "60m":
    case "1h":
      daysToFetch = 60;
      break;
    case "4h":
      daysToFetch = 120;
      actualInterval = "1h";
      break;
    case "8h":
      daysToFetch = 180;
      actualInterval = "1h";
      break;
    case "1d":
      daysToFetch = 365;
      break;
    case "5d":
      daysToFetch = 365 * 5;
      break;
    case "1wk":
      daysToFetch = 365 * 5;
      break;
    case "1mo":
      daysToFetch = 365 * 30;
      break;
    case "3mo":
      daysToFetch = 365 * 90;
      break;
    default:
      daysToFetch = 365;
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
    console.error("api/data error:", error);
    res.status(500).json({ error: "Failed to fetch data from Yahoo Finance" });
  }
});

// USD/JPY endpoint
app.get("/api/usd_jpy_data", async (req, res) => {
  const ticker = "USDJPY=X";
  let { interval } = req.query;

  if (!interval) interval = "1d";

  const validIntervals = ["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "4h", "8h", "1d", "5d", "1wk", "1mo", "3mo"];
  if (!validIntervals.includes(interval)) {
    return res.status(400).json({ error: `Invalid interval. Valid intervals are: ${validIntervals.join(", ")}` });
  }

  const cacheKey = `usd_jpy-${ticker}-${interval}`;
  const now = Date.now();

  if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_TTL) {
    return res.json(cache[cacheKey].data);
  }

  let daysToFetch;
  let actualInterval = interval;

  switch (interval) {
    case "1m":
      daysToFetch = 7;
      break;
    case "2m":
    case "5m":
    case "15m":
    case "30m":
      daysToFetch = 30;
      break;
    case "60m":
    case "1h":
      daysToFetch = 60;
      break;
    case "4h":
      daysToFetch = 120;
      actualInterval = "1h";
      break;
    case "8h":
      daysToFetch = 180;
      actualInterval = "1h";
      break;
    case "1d":
      daysToFetch = 365;
      break;
    case "5d":
      daysToFetch = 365 * 5;
      break;
    case "1wk":
      daysToFetch = 365 * 5;
      break;
    case "1mo":
      daysToFetch = 365 * 30;
      break;
    case "3mo":
      daysToFetch = 365 * 90;
      break;
    default:
      daysToFetch = 365;
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
    console.error("api/usd_jpy_data error:", error);
    res.status(500).json({ error: "Failed to fetch USD/JPY data from Yahoo Finance" });
  }
});

/**
 * ★B案対応：interval を引数で受け取り、メールに表示する
 * - intervalForEmail は「クロス発生時に保存された interval」を渡す
 */
async function sendThresholdEmail(user, indicatorName, crossedPrice, currentPrice, crossedTimestamp, intervalForEmail) {
  if (!transporter) {
    console.error(`Email not sent for user ${user.email}: Email service is not configured.`);
    return;
  }

  const priceDifference = Math.abs(currentPrice - crossedPrice);
  const userThreshold = parseFloat(user.x_value);
  const now = new Date();

  const intervalLabel = intervalForEmail || "unknown";
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
- クロス発生時刻: ${new Date(crossedTimestamp).toLocaleString("ja-JP")}
- クロス時価格: ${crossedPrice.toFixed(3)} 円
- 設定しきい値: ±${userThreshold.toFixed(3)} 円
- 現在時刻: ${now.toLocaleString("ja-JP")}
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
      <li><b>クロス発生時刻:</b> ${new Date(crossedTimestamp).toLocaleString("ja-JP")}</li>
      <li><b>クロス時価格:</b> ${crossedPrice.toFixed(3)} 円</li>
      <li><b>設定しきい値:</b> ±${userThreshold.toFixed(3)} 円</li>
      <li><b>現在時刻:</b> ${now.toLocaleString("ja-JP")}</li>
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
 * ここはあなたの client 側の「SMA(1)=終値」実装と整合させてあります
 */
async function monitorSma1Value(user, quotes, realTimeState, socketMap, io) {
  let stateChanged = false;
  const settings = user.settings || {};
  const userInterval = settings.currentInterval || "5m";

  try {
    const minDataPoints = 55;
    if (quotes.length < minDataPoints) return false;

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
      indicatorValues["middle"] = { last: bbResult1[bbResult1.length - 1].middle, secondLast: bbResult1[bbResult1.length - 2].middle };
      indicatorValues["upper1"] = { last: bbResult1[bbResult1.length - 1].upper, secondLast: bbResult1[bbResult1.length - 2].upper };
      indicatorValues["lower1"] = { last: bbResult1[bbResult1.length - 1].lower, secondLast: bbResult1[bbResult1.length - 2].lower };
      indicatorValues["upper2"] = { last: bbResult2[bbResult2.length - 1].upper, secondLast: bbResult2[bbResult2.length - 2].upper };
      indicatorValues["lower2"] = { last: bbResult2[bbResult2.length - 1].lower, secondLast: bbResult2[bbResult2.length - 2].lower };
    }

    // Calculate EMA
    emaPeriods.forEach((p) => {
      const emaResult = EMA.calculate({ period: p, values: closePrices });
      if (emaResult.length >= 2) {
        indicatorValues["ema" + p] = { last: emaResult[emaResult.length - 1], secondLast: emaResult[emaResult.length - 2] };
      }
    });

    // Ensure state shape
    if (!realTimeState.crossHistory) realTimeState.crossHistory = {};

    // Check for crosses (終値 vs indicator)
    for (const indicatorName in indicatorValues) {
      const { last, secondLast } = indicatorValues[indicatorName];
      if (last === undefined || secondLast === undefined) continue;

      const lastRelPosition = lastCandle.close > last ? "above" : "below";
      const secondLastRelPosition = secondLastCandle.close > secondLast ? "above" : "below";

      if (lastRelPosition !== secondLastRelPosition) {
        const crossPrice = lastCandle.close;
        const crossTimestamp = lastCandle.date;

        // ★B案：クロス発生時の interval を保存（後でメールに出す）
        realTimeState.crossHistory[indicatorName] = {
          price: crossPrice,
          timestamp: crossTimestamp.toISOString(),
          interval: userInterval,
        };
        stateChanged = true;

        const indicatorLabel = getIndicatorDisplayName(indicatorName);

        console.log(
          `User ${user.id}: CLOSE(SMA1)-BASED cross detected for ${indicatorName}(${indicatorLabel}) at price ${crossPrice} on interval ${userInterval}`
        );

        const socketId = socketMap.get(user.id);
        if (socketId) {
          const eventName = indicatorName.startsWith("ema") ? "ema_cross" : "bb_cross";
          const eventPayload = {
            message: `ドル円が ${indicatorLabel} を終値で${lastRelPosition === "above" ? "上抜け" : "下抜け"}しました！ (間隔: ${userInterval})`,
            price: crossPrice,
            crossDirection: lastRelPosition === "above" ? "up" : "down",
            timestamp: crossTimestamp,
            [eventName === "ema_cross" ? "emaName" : "bandName"]: indicatorName,
            [eventName === "ema_cross" ? "emaValue" : "bandValue"]: last,
            // 追加で表示名も渡す（clientが使いたければ使える）
            [eventName === "ema_cross" ? "emaLabel" : "bandLabel"]: indicatorLabel,
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
  console.log("Starting DB-centric, always-on USD/JPY price watcher...");

  setInterval(async () => {
    try {
      const userQuery = `
        SELECT u.id, u.username, u.email, u.x_value, s.settings
        FROM users u
        LEFT JOIN user_settings s ON u.id = s.user_id
        WHERE u.x_value > 0 OR s.settings IS NOT NULL
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
        console.error("Failed to fetch current USD/JPY price (quote & chart both failed). Continuing without live price...");
      } else {
        io.emit("usd_jpy_price_update", { price: currentPrice, timestamp: new Date() });
      }

      const ticker = "USDJPY=X";

      for (const user of users) {
        const settings = user.settings || {};
        const realTimeState = settings.realTimeState || { crossHistory: {} };
        let stateChanged = false;

        // Part 1: X-Value threshold using live price（live price がある時だけ）
        if (currentPrice != null && Object.keys(realTimeState.crossHistory || {}).length > 0) {
          for (const indicatorName in realTimeState.crossHistory) {
            const crossEvent = realTimeState.crossHistory[indicatorName];
            if (crossEvent) {
              const { price: crossedPrice, interval: crossedInterval } = crossEvent;
              const priceDifference = Math.abs(currentPrice - crossedPrice);

              if (parseFloat(user.x_value) > 0 && priceDifference >= parseFloat(user.x_value)) {
                const intervalForEmail = crossedInterval || settings.currentInterval || "5m"; // 旧データ互換
                await sendThresholdEmail(user, indicatorName, crossedPrice, currentPrice, new Date(crossEvent.timestamp), intervalForEmail);

                realTimeState.crossHistory[indicatorName] = null;
                stateChanged = true;
              }
            }
          }
        }

        // Part 2: Fetch data and call cross-detection function
        const userInterval = settings.currentInterval || "5m";

        let daysToFetch;
        switch (userInterval) {
          case "1m":
            daysToFetch = 7;
            break;
          case "2m":
          case "5m":
          case "15m":
          case "30m":
            daysToFetch = 30;
            break;
          case "60m":
          case "1h":
            daysToFetch = 60;
            break;
          case "4h":
            daysToFetch = 120;
            break;
          case "8h":
            daysToFetch = 180;
            break;
          case "1d":
            daysToFetch = 365;
            break;
          case "5d":
          case "1wk":
            daysToFetch = 365 * 5;
            break;
          case "1mo":
            daysToFetch = 365 * 30;
            break;
          case "3mo":
            daysToFetch = 365 * 90;
            break;
          default:
            daysToFetch = 365;
        }

        const period2 = new Date();
        const period1 = new Date(period2.getTime() - daysToFetch * 24 * 60 * 60 * 1000);

        try {
          let fetchInterval = userInterval;
          let aggregateHours = null;

          if (userInterval === "4h") {
            fetchInterval = "1h";
            aggregateHours = 4;
          } else if (userInterval === "8h") {
            fetchInterval = "1h";
            aggregateHours = 8;
          }

          const rawQuotes = await fetchYahooChartQuotes(ticker, fetchInterval, period1, period2);
          const quotesForDetection = aggregateHours ? aggregateQuotesToHours(rawQuotes, aggregateHours) : rawQuotes;

          const crossDetectionStateChanged = await monitorSma1Value(user, quotesForDetection, realTimeState, socketMap, io);
          stateChanged = stateChanged || crossDetectionStateChanged;
        } catch (fetchError) {
          console.error(`Error fetching quotes for user ${user.id} on interval ${userInterval}:`, fetchError.message);
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
      console.error("Error in price watcher:", error);
    }
  }, 15000);
}

// --- Server Startup ---
async function startServer() {
  await configureNodemailer();

  console.log("Initializing database...");
  // ✅ 外部キーの都合で users → emails → user_settings の順にしています
  await createUsersTable();
  await createEmailsTable();
  await createUserSettingsTable();
  console.log("Database initialized successfully.");

  server.listen(port, "0.0.0.0", () => {
    console.log(`Proxy server listening at http://0.0.0.0:${port}`);
    console.log("API endpoint for stocks: /api/data?ticker=7203.T&interval=1d");
    console.log("API endpoint for USD/JPY: /api/usd_jpy_data");
    startPriceWatcher();
  });
}

startServer();
