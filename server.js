const nodemailer = require("nodemailer");
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { SSMClient, GetParametersCommand } = require("@aws-sdk/client-ssm");
const bcrypt = require('bcrypt');
const session = require('express-session');
const http = require('http');
const { Server } = require("socket.io");
const { BollingerBands, EMA } = require('technicalindicators');

let transporter;

// This function fetches credentials from AWS Parameter Store and configures Nodemailer
async function configureNodemailer() {
    try {
        const ssmClient = new SSMClient({ region: process.env.AWS_REGION || "ap-northeast-1" }); // Default to Tokyo region if not set
        const command = new GetParametersCommand({
            Names: [
                '/parabolic/gmail/user',
                '/parabolic/gmail/pass'
            ],
            WithDecryption: true
        });

        const { Parameters } = await ssmClient.send(command);

        const gmailUser = Parameters.find(p => p.Name === '/parabolic/gmail/user')?.Value;
        const gmailPass = Parameters.find(p => p.Name === '/parabolic/gmail/pass')?.Value;

        if (!gmailUser || !gmailPass) {
            throw new Error("Gmail credentials not found in Parameter Store.");
        }

        // Create the Nodemailer transporter with the fetched credentials
        transporter = nodemailer.createTransport({
            service: 'gmail',
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
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- Real-time Price Watcher for USD/JPY ---
// Global state is removed. This will now be managed per-socket.

io.on('connection', (socket) => {
    // Add userId to socket object upon connection if available
    const session = socket.request.session;
    if (session && session.userId) {
        socket.userId = session.userId;
        console.log(`User connected: ${socket.id}, userId: ${socket.userId}`);
    } else {
        console.log(`Anonymous user connected: ${socket.id}`);
    }

    socket.on('disconnect', () => {
        console.log(`user disconnected: ${socket.id}`);
    });
});

// --- Database Setup ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

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
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24
    }
});
app.use(sessionMiddleware);

// Share session with socket.io
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

app.use(express.static('dist'));
app.use(express.static(__dirname));

// A simple caching mechanism
const cache = {};
const CACHE_TTL = 60 * 1000; // 60 seconds

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
        res.status(201).json({ message: 'Registration successful!', user: { id: user.id, email: user.email, username: user.username } });
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === '23505') {
            if (error.detail?.includes('email')) {
                return res.status(409).json({ error: 'Email already in use.' });
            }
            if (error.detail?.includes('username')) {
                return res.status(409).json({ error: 'Username already taken.' });
            }
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
        const result = await pool.query(
            'SELECT id, email, username, password_hash FROM users WHERE email = $1 OR username = $1',
            [emailOrUsername]
        );
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        req.session.userId = user.id;
        res.status(200).json({ message: 'Login successful!', user: { id: user.id, email: user.email, username: user.username } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'An internal server error occurred during login.' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Failed to log out.' });
        }
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logout successful!' });
    });
});

app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }

    try {
        const result = await pool.query(
            'SELECT id, email, username FROM users WHERE id = $1',
            [req.session.userId]
        );
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
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }
    try {
        const result = await pool.query(
            'SELECT settings FROM user_settings WHERE user_id = $1',
            [req.session.userId]
        );
        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0].settings);
        } else {
            res.status(200).json({});
        }
    } catch (error) {
        console.error('Fetch user settings error:', error);
        res.status(500).json({ error: 'An internal server error occurred while fetching settings.' });
    }
});

// API to save/update user settings（重複してたので1つだけ）
app.post('/api/user/settings', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }
    const settings = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO user_settings (user_id, settings)
             VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP
             RETURNING settings`,
            [req.session.userId, settings]
        );
        res.status(200).json(result.rows[0].settings);
    } catch (error) {
        console.error('Save user settings error:', error);
        res.status(500).json({ error: 'An internal server error occurred while saving settings.' });
    }
});

// API to get user's x_value
app.get('/api/user/x_value', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }

    try {
        const result = await pool.query(
            'SELECT x_value FROM users WHERE id = $1',
            [req.session.userId]
        );
        if (result.rows.length > 0) {
            res.status(200).json({ x_value: result.rows[0].x_value });
        } else {
            res.status(404).json({ error: 'User not found.' });
        }
    } catch (error) {
        console.error('Fetch user x_value error:', error);
        res.status(500).json({ error: 'An internal server error occurred while fetching x_value.' });
    }
});

// API to update user's x_value
app.post('/api/user/x_value', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }
    const { x_value } = req.body;

    if (typeof x_value !== 'number' || isNaN(x_value)) {
        return res.status(400).json({ error: 'x_value must be a number.' });
    }

    try {
        const result = await pool.query(
            'UPDATE users SET x_value = $1 WHERE id = $2 RETURNING x_value',
            [x_value, req.session.userId]
        );
        if (result.rows.length > 0) {
            res.status(200).json({ message: 'x_value updated successfully.', x_value: result.rows[0].x_value });
        } else {
            res.status(404).json({ error: 'User not found.' });
        }
    } catch (error) {
        console.error('Update user x_value error:', error);
        res.status(500).json({ error: 'An internal server error occurred while updating x_value.' });
    }
});

// Subscribe email
app.post('/api/subscribe', async (req, res) => {
    const { email } = req.body;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO emails (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING *',
            [email]
        );

        if (result.rows.length > 0) {
            return res.status(201).json({ message: 'Thank you for subscribing!', email: result.rows[0] });
        } else {
            return res.status(200).json({ message: 'You are already subscribed.' });
        }
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

        if (result.rowCount > 0) {
            return res.status(200).json({ message: `Email ${email} deleted successfully.` });
        } else {
            return res.status(404).json({ error: `Email ${email} not found.` });
        }
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
        const emails = result.rows.map(row => row.email);

        if (emails.length === 0) {
            return res.status(404).json({ message: 'No emails found to send.' });
        }

        const mailOptions = {
            from: process.env.GMAIL_USER,
            subject: '条件達成',
            text: 'おめでとうございます。条件達成です。',
            html: '<p>おめでとうございます。条件達成です。</p>'
        };

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

    if (cache[cacheKey] && (now - cache[cacheKey].timestamp < CACHE_TTL)) {
        return res.json(cache[cacheKey].data);
    }

    const validIntervals = ["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "4h", "8h", "1d", "5d", "1wk", "1mo", "3mo"];
    if (!validIntervals.includes(interval)) {
        return res.status(400).json({ error: `Invalid interval. Valid intervals are: ${validIntervals.join(', ')}` });
    }

    let daysToFetch;
    let actualInterval = interval;

    switch (interval) {
        case "1m":
        case "2m":
        case "5m":
        case "15m":
        case "30m":
            daysToFetch = 30; break;
        case "60m":
        case "1h":
            daysToFetch = 60; break;
        case "4h":
            daysToFetch = 120; actualInterval = '1h'; break;
        case "8h":
            daysToFetch = 180; actualInterval = '1h'; break;
        case "1d":
            daysToFetch = 365; break;
        case "5d":
            daysToFetch = 365 * 5; break;
        case "1wk":
            daysToFetch = 365 * 5; break;
        case "1mo":
            daysToFetch = 365 * 30; break;
        case "3mo":
            daysToFetch = 365 * 90; break;
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
        console.error('api/data error:', error);
        res.status(500).json({ error: 'Failed to fetch data from Yahoo Finance' });
    }
});

// USD/JPY endpoint
app.get('/api/usd_jpy_data', async (req, res) => {
    const ticker = 'USDJPY=X';
    let { interval } = req.query;

    if (!interval) interval = '1d';

    const validIntervals = ["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "4h", "8h", "1d", "5d", "1wk", "1mo", "3mo"];
    if (!validIntervals.includes(interval)) {
        return res.status(400).json({ error: `Invalid interval. Valid intervals are: ${validIntervals.join(', ')}` });
    }

    const cacheKey = `usd_jpy-${ticker}-${interval}`;
    const now = Date.now();

    if (cache[cacheKey] && (now - cache[cacheKey].timestamp < CACHE_TTL)) {
        return res.json(cache[cacheKey].data);
    }

    let daysToFetch;
    let actualInterval = interval;

    switch (interval) {
        case "1m":
        case "2m":
        case "5m":
        case "15m":
        case "30m":
            daysToFetch = 30; break;
        case "60m":
        case "1h":
            daysToFetch = 60; break;
        case "4h":
            daysToFetch = 120; actualInterval = '1h'; break;
        case "8h":
            daysToFetch = 180; actualInterval = '1h'; break;
        case "1d":
            daysToFetch = 365; break;
        case "5d":
            daysToFetch = 365 * 5; break;
        case "1wk":
            daysToFetch = 365 * 5; break;
        case "1mo":
            daysToFetch = 365 * 30; break;
        case "3mo":
            daysToFetch = 365 * 90; break;
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
        console.error('api/usd_jpy_data error:', error);
        res.status(500).json({ error: 'Failed to fetch USD/JPY data from Yahoo Finance' });
    }
});

async function sendThresholdEmail(user, indicatorName, crossedPrice, currentPrice, crossedTimestamp) {
    if (!transporter) {
        console.error(`Email not sent for user ${user.email}: Email service is not configured.`);
        return;
    }
    const subject = `USD/JPY Price Alert: Threshold Met for ${indicatorName.toUpperCase()}`;
    const text = `Hello ${user.username}, ...`; // Keeping it brief for the replacement
    const html = `<p>Hello ${user.username}, ...</p>`;
    const mailOptions = { from: process.env.GMAIL_USER, to: user.email, subject, text, html };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Threshold alert email sent to ${user.email} for ${indicatorName}.`);
    } catch (error) {
        console.error(`Failed to send threshold alert email to ${user.email}:`, error);
    }
}

async function startPriceWatcher() {
    console.log('Starting DB-centric, always-on USD/JPY price watcher...');

    setInterval(async () => {
        try {
            const userQuery = `
                SELECT u.id, u.username, u.email, u.x_value, s.settings
                FROM users u
                LEFT JOIN user_settings s ON u.id = s.user_id
                WHERE u.x_value > 0
            `;
            const { rows: users } = await pool.query(userQuery);
            if (users.length === 0) return;

            const activeSockets = await io.fetchSockets();
            const socketMap = new Map();
            for (const socket of activeSockets) {
                if (socket.userId) {
                    socketMap.set(socket.userId, socket.id);
                }
            }

            const ticker = 'USDJPY=X';
            const period2 = new Date();
            const period1 = new Date(period2.getTime() - 2 * 24 * 60 * 60 * 1000);
            const quotes = await fetchYahooChartQuotes(ticker, '5m', period1, period2);
            if (quotes.length < 50) return;
            const closePrices = quotes.map(q => q.close);

            const response = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`);
            if (!response.ok) return;
            const data = await response.json();
            const currentPrice = data?.quoteResponse?.result?.[0]?.regularMarketPrice;
            if (!currentPrice) return;
            
            io.emit('usd_jpy_price_update', { price: currentPrice, timestamp: new Date() });

            for (const user of users) {
                const settings = user.settings || {};
                const realTimeState = settings.realTimeState || {
                    previousPositions: { 'upper2': 'unknown', 'lower2': 'unknown', 'upper1': 'unknown', 'lower1': 'unknown', 'middle': 'unknown', 'ema10': 'unknown', 'ema25': 'unknown', 'ema50': 'unknown' },
                    crossHistory: { 'upper2': null, 'lower2': null, 'upper1': null, 'lower1': null, 'middle': null, 'ema10': null, 'ema25': null, 'ema50': null }
                };
                
                const bbPeriod = parseInt(settings.bbPeriod, 10) || 20;
                const bbStdDev = parseFloat(settings.bbStdDev) || 2;
                const emaPeriods = settings.emaPeriods || [10, 25, 50];

                if (closePrices.length < Math.max(bbPeriod, ...emaPeriods)) continue;
                
                const bbInput1 = { period: bbPeriod, values: closePrices, stdDev: 1 };
                const bbResult1 = BollingerBands.calculate(bbInput1);
                const latestBB1 = bbResult1[bbResult1.length - 1];

                const bbInput2 = { period: bbPeriod, values: closePrices, stdDev: bbStdDev };
                const bbResult2 = BollingerBands.calculate(bbInput2);
                const latestBB2 = bbResult2[bbResult2.length - 1];
                
                const emaResults = emaPeriods.map(p => EMA.calculate({ period: p, values: closePrices }).pop());
                const [ema1, ema2, ema3] = emaResults;
                const emaIndicatorNames = ['ema' + emaPeriods[0], 'ema' + emaPeriods[1], 'ema' + emaPeriods[2]];
                
                if (!latestBB1 || !latestBB2 || !ema1 || !ema2 || !ema3) continue;

                const indicators = {
                    middle: latestBB1.middle, upper1: latestBB1.upper, lower1: latestBB1.lower,
                    upper2: latestBB2.upper, lower2: latestBB2.lower,
                    [emaIndicatorNames[0]]: ema1,
                    [emaIndicatorNames[1]]: ema2,
                    [emaIndicatorNames[2]]: ema3,
                };
                
                let isHistoryLocked = Object.values(realTimeState.crossHistory).some(h => h !== null);
                let stateChanged = false;

                for (const indicatorName of Object.keys(indicators)) {
                    const indicatorValue = indicators[indicatorName];
                    if (indicatorValue === undefined || indicatorValue === null) continue;

                    if (realTimeState.crossHistory[indicatorName] !== null) {
                        if (realTimeState.crossHistory[indicatorName].skipNextCheck) {
                            realTimeState.crossHistory[indicatorName].skipNextCheck = false;
                            stateChanged = true;
                            continue;
                        }

                        const { price: crossedPrice, timestamp: crossedTimestamp } = realTimeState.crossHistory[indicatorName];
                        const priceDifference = Math.abs(currentPrice - crossedPrice);
                        
                        if (parseFloat(user.x_value) > 0 && priceDifference > parseFloat(user.x_value)) {
                            await sendThresholdEmail(user, indicatorName, crossedPrice, currentPrice, new Date(crossedTimestamp));
                            realTimeState.crossHistory[indicatorName] = null;
                            realTimeState.previousPositions[indicatorName] = 'unknown';
                            stateChanged = true;
                            isHistoryLocked = false;
                            continue;
                        }
                    }

                    const currentRelPosition = currentPrice > indicatorValue ? 'above' : 'below';
                    const previousRelPosition = realTimeState.previousPositions[indicatorName] || 'unknown';

                    if (previousRelPosition === 'unknown') {
                        realTimeState.previousPositions[indicatorName] = currentRelPosition;
                        stateChanged = true;
                        continue;
                    }

                    if (currentRelPosition !== previousRelPosition) {
                        const crossDirection = currentRelPosition === 'above' ? 'up' : 'down';
                        
                        const socketId = socketMap.get(user.id);
                        if (socketId) {
                            const eventName = indicatorName.startsWith('ema') ? 'ema_cross' : 'bb_cross';
                            const eventPayload = {
                                message: `ドル円が${indicatorName.toUpperCase()}を${crossDirection === 'up' ? '上抜け' : '下抜け'}しました！`,
                                price: currentPrice, crossDirection, timestamp: new Date()
                            };
                            eventPayload[eventName === 'ema_cross' ? 'emaName' : 'bandName'] = indicatorName;
                            eventPayload[eventName === 'ema_cross' ? 'emaValue' : 'bandValue'] = indicatorValue;
                            io.to(socketId).emit(eventName, eventPayload);
                        }
                        
                        if (!isHistoryLocked) {
                            realTimeState.crossHistory[indicatorName] = { price: currentPrice, timestamp: new Date().toISOString(), skipNextCheck: true };
                            console.log(`User ${user.id}: Cross history is now active for ${indicatorName} at price ${currentPrice}`);
                            isHistoryLocked = true;
                        }
                        stateChanged = true;
                    }
                    realTimeState.previousPositions[indicatorName] = currentRelPosition;
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
        }
    }, 15000);
}
// --- Server Startup ---
async function startServer() {
    await configureNodemailer();

    console.log("Initializing database...");
    await createEmailsTable();
    await createUsersTable();
    await createUserSettingsTable();
    console.log("Database initialized successfully.");

    server.listen(port, '0.0.0.0', () => {
        console.log(`Proxy server listening at http://0.0.0.0:${port}`);
        console.log('API endpoint for stocks: /api/data?ticker=7203.T&interval=1d');
        console.log('API endpoint for USD/JPY: /api/usd_jpy_data');
        startPriceWatcher();
    });
}

startServer();
