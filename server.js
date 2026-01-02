const nodemailer = require("nodemailer");
const express = require('express');
const yahooFinance = require('yahoo-finance2').default;
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

        const gmailUser = Parameters.find(p => p.Name === '/parabolic/gmail/user').Value;
        const gmailPass = Parameters.find(p => p.Name === '/parabolic/gmail/pass').Value;

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
        // In a production environment, you might want to handle this more gracefully,
        // for example, by preventing the app from starting or sending an alert.
    }
}

const app = express();
const port = 3000;
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity. In production, restrict this to your domain.
        methods: ["GET", "POST"]
    }
});

// --- Real-time Price Watcher for USD/JPY ---
let previousPositions = {
    'upper2': 'unknown', // price relative to +2σ upper band ('above'/'below')
    'lower2': 'unknown', // price relative to +2σ lower band ('above'/'below')
    'upper1': 'unknown', // price relative to +1σ upper band ('above'/'below')
    'lower1': 'unknown', // price relative to +1σ lower band ('above'/'below')
    'middle': 'unknown'  // price relative to middle band ('above'/'below')
};
let currentBbPeriod = 20; // Default BB period
let currentBbStdDev = 2;  // Default BB std deviation

// --- Real-time Price Watcher for EMA ---
let previousPositionsEMA = {
    'ema10': 'unknown',
    'ema25': 'unknown',
    'ema50': 'unknown'
};


io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('update_bb_settings', (settings) => {
        console.log('Received BB settings from client:', settings);
        if (settings.bbPeriod) {
            currentBbPeriod = parseInt(settings.bbPeriod, 10);
            console.log(`Updated BB Period to: ${currentBbPeriod}`);
        }
        if (settings.bbStdDev) {
            currentBbStdDev = parseFloat(settings.bbStdDev);
            console.log(`Updated BB StdDev to: ${currentBbStdDev}`);
        }
    });
    socket.on('disconnect', () => {
        console.log('user disconnected');
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
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- user_idを追加し、NULLを許可
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
app.use(express.json()); // Middleware to parse JSON bodies

// --- Session Middleware for Authentication ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key', // Replace with a strong, secret key in production
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // Set to true if using HTTPS (recommended for production)
        httpOnly: true, // Prevents client-side JS from accessing the cookie
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

app.use(express.static('dist'));
app.use(express.static(__dirname));

// A simple caching mechanism
const cache = {};
const CACHE_TTL = 60 * 1000; // 60 seconds

// --- API Endpoints ---

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
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
        const result = await pool.query(
            'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username',
            [email, username, hashedPassword]
        );
        const user = result.rows[0];
        req.session.userId = user.id; // Log in the user immediately
        res.status(201).json({ message: 'Registration successful!', user: { id: user.id, email: user.email, username: user.username } });
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === '23505') { // Unique violation
            if (error.detail.includes('email')) {
                return res.status(409).json({ error: 'Email already in use.' });
            }
            if (error.detail.includes('username')) {
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

        req.session.userId = user.id; // Store user ID in session
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
        res.clearCookie('connect.sid'); // Clear session cookie
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
            req.session.destroy(); // Session invalid, destroy it
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
            res.status(200).json({}); // Return empty settings if none found
        }
    } catch (error) {
        console.error('Fetch user settings error:', error);
        res.status(500).json({ error: 'An internal server error occurred while fetching settings.' });
    }
});

// API to save/update user settings
app.post('/api/user/settings', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }
    const settings = req.body; // Settings sent from client

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

// API to save/update user settings
app.post('/api/user/settings', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }
    const settings = req.body; // Settings sent from client

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
            // This case should ideally not happen if a user ID is in session but not in DB
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

// New endpoint to subscribe an email
app.post('/api/subscribe', async (req, res) => {
    const { email } = req.body;

    // Basic email validation
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

// New endpoint to get all subscribed emails
app.get('/api/emails', async (req, res) => {
    try {
        const result = await pool.query('SELECT email FROM emails ORDER BY created_at DESC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

// New endpoint to delete an email
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



app.get('/api/data', async (req, res) => {
        const { ticker, interval } = req.query;

        if (!ticker || !interval) {
            return res.status(400).json({ error: 'Ticker and interval are required' });
        }

        const cacheKey = `stock-${ticker}-${interval}`; // Differentiate cache keys for stocks and USD/JPY
        const now = Date.now();

        // Check cache first
        if (cache[cacheKey] && (now - cache[cacheKey].timestamp < CACHE_TTL)) {
            // console.log(`Serving from cache: ${cacheKey}`);
            return res.json(cache[cacheKey].data);
        }

        // Map interval to yahoo-finance2 format
        const validIntervals = ["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "4h", "8h", "1d", "5d", "1wk", "1mo", "3mo"];
        if (!validIntervals.includes(interval)) {
            return res.status(400).json({ error: `Invalid interval. Valid intervals are: ${validIntervals.join(', ')}` });
        }

        // Dynamically adjust period based on interval to ensure enough data for indicators
        const isIntraday = interval.endsWith('m') || interval.endsWith('h');

        let daysToFetch;
        let actualInterval = interval; // Variable to hold the actual interval to request from Yahoo Finance

        switch (interval) {
            case "1m":
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
            case "4h": // For 4h, fetch 1h data and aggregate on client
                daysToFetch = 120; // Fetch enough 1h data to cover ~4 months
                actualInterval = '1h'; // Request 1h data from Yahoo Finance
                break;
            case "8h": // For 8h, fetch 1h data and aggregate on client
                daysToFetch = 180; // Fetch enough 1h data to cover ~6 months
                actualInterval = '1h'; // Request 1h data from Yahoo Finance
                break;
            case "1d":
                daysToFetch = 365;
                break;
            case "5d": // Each bar represents 5 days
                daysToFetch = 365 * 5;
                break;
            case "1wk":
                daysToFetch = 365 * 5; // Fetch approximately 5 years of weekly data
                break;
            case "1mo":
                daysToFetch = 365 * 30; // Approximate
                break;
            case "3mo":
                daysToFetch = 365 * 90; // Approximate
                break;
            default:
                daysToFetch = 365; // Default to 365 days if interval not explicitly handled
        }

        const queryOptions = {
            period1: new Date(Date.now() - daysToFetch * 24 * 60 * 60 * 1000),
            interval: actualInterval,
        };

        try {
            // console.log(`Fetching from Yahoo Finance: ${ticker}`);
            const result = await yahooFinance.chart(ticker, queryOptions);
            
            if (!result.quotes || result.quotes.length === 0) {
                return res.status(404).json({ error: `No data found for ticker: ${ticker}` });
            }

            // Store in cache
            cache[cacheKey] = {
                timestamp: Date.now(),
                data: result.quotes,
            };

            res.json(result.quotes);
        } catch (error) {
            console.error(error);
            if (error.code === 'BAD_REQUEST') {
                 return res.status(404).json({ error: `No data found for ticker: ${ticker}. It may be an invalid symbol.` });
            }
            res.status(500).json({ error: 'Failed to fetch data from Yahoo Finance' });
        }
    });
// New endpoint for USD/JPY data
app.get('/api/usd_jpy_data', async (req, res) => {
    const ticker = 'USDJPY=X'; // Yahoo Finance symbol for USD/JPY
    let { interval } = req.query; // Get interval from query

    if (!interval) {
        return res.status(400).json({ error: 'Interval is required for USD/JPY' });
    }

    // Map interval to yahoo-finance2 format (same as for stocks)
    const validIntervals = ["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "4h", "8h", "1d", "5d", "1wk", "1mo", "3mo"];
    if (!validIntervals.includes(interval)) {
        return res.status(400).json({ error: `Invalid interval. Valid intervals are: ${validIntervals.join(', ')}` });
    }

    const cacheKey = `usd_jpy-${ticker}-${interval}`; // Differentiate cache keys
    const now = Date.now();

    // Check cache first
    if (cache[cacheKey] && (now - cache[cacheKey].timestamp < CACHE_TTL)) {
        return res.json(cache[cacheKey].data);
    }

    let daysToFetch;
    let actualInterval = interval; // Variable to hold the actual interval to request from Yahoo Finance

    switch (interval) {
        case "1m":
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
        case "4h": // For 4h, fetch 1h data and aggregate on client
            daysToFetch = 120; // Fetch enough 1h data to cover ~4 months
            actualInterval = '1h'; // Request 1h data from Yahoo Finance
            break;
        case "8h": // For 8h, fetch 1h data and aggregate on client
            daysToFetch = 180; // Fetch enough 1h data to cover ~6 months
            actualInterval = '1h'; // Request 1h data from Yahoo Finance
            break;
        case "1d":
            daysToFetch = 365;
            break;
        case "5d": // Each bar represents 5 days
            daysToFetch = 365 * 5;
            break;
        case "1wk":
            daysToFetch = 365 * 5; // Fetch approximately 5 years of weekly data
            break;
        case "1mo":
            daysToFetch = 365 * 30; // Approximate
            break;
        case "3mo":
            daysToFetch = 365 * 90; // Approximate
            break;
        default:
            daysToFetch = 365; // Default to 365 days if interval not explicitly handled
    }

    const queryOptions = {
        period1: new Date(Date.now() - daysToFetch * 24 * 60 * 60 * 1000),
        interval: actualInterval,
    };

    try {
        const result = await yahooFinance.chart(ticker, queryOptions);
        
        if (!result.quotes || result.quotes.length === 0) {
            return res.status(404).json({ error: `No data found for USD/JPY with interval ${interval}.` });
        }

        // Store in cache
        cache[cacheKey] = {
            timestamp: Date.now(),
            data: result.quotes,
        };

        res.json(result.quotes);
    } catch (error) {
        console.error(error);
        if (error.code === 'BAD_REQUEST') {
             return res.status(404).json({ error: `No data found for USD/JPY for interval '${interval}'. This interval may not be supported by Yahoo Finance for currency pairs like USDJPY=X.` });
        }
        res.status(500).json({ error: 'Failed to fetch USD/JPY data from Yahoo Finance' });
    }
});

async function startPriceWatcher() {
    console.log('Starting USD/JPY price watcher...');
    const ticker = 'USDJPY=X';

    setInterval(async () => {
        try {
            // 1. Fetch recent historical data to calculate BB
            const queryOptions = {
                period1: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Fetch last 2 days of 1-minute data
                interval: '1m',
            };
            const chartData = await yahooFinance.chart(ticker, queryOptions);
            if (!chartData.quotes || chartData.quotes.length < currentBbPeriod) { // Use currentBbPeriod here
                // Not enough data to calculate BB
                return;
            }
            const closePrices = chartData.quotes.map(q => q.close);

            // Calculate EMAs
            const ema10 = EMA.calculate({ period: 10, values: closePrices });
            const ema25 = EMA.calculate({ period: 25, values: closePrices });
            const ema50 = EMA.calculate({ period: 50, values: closePrices });

            const latestEMA10 = ema10.length > 0 ? ema10[ema10.length - 1] : null;
            const latestEMA25 = ema25.length > 0 ? ema25[ema25.length - 1] : null;
            const latestEMA50 = ema50.length > 0 ? ema50[ema50.length - 1] : null;

            // 2. Calculate Bollinger Bands for 1σ and 2σ
            const bbInput1 = { period: currentBbPeriod, values: closePrices, stdDev: 1 };
            const bbResult1 = BollingerBands.calculate(bbInput1);
            const latestBB1 = bbResult1[bbResult1.length - 1];

            const bbInput2 = { period: currentBbPeriod, values: closePrices, stdDev: 2 };
            const bbResult2 = BollingerBands.calculate(bbInput2);
            const latestBB2 = bbResult2[bbResult2.length - 1];

            if (!latestBB1 || !latestBB2) return;

            const bands = {
                middle: latestBB1.middle, // Middle band is common for both stdDev 1 and 2
                upper1: latestBB1.upper,
                lower1: latestBB1.lower,
                upper2: latestBB2.upper,
                lower2: latestBB2.lower,
            };

            // 3. Fetch the current real-time price
            const quote = await yahooFinance.quote(ticker);
            const currentPrice = quote.regularMarketPrice;
            if (!currentPrice) return;

            // Emit current price update for client-side logic
            io.emit('usd_jpy_price_update', { price: currentPrice, timestamp: new Date() });

            const checkAndEmitCross = (bandName, bandValue, price, previousPosMap) => {
                const currentRelPosition = price > bandValue ? 'above' : 'below'; // Determine current position relative to band
                if (previousPosMap[bandName] === 'unknown') {
                    previousPosMap[bandName] = currentRelPosition; // Initialize if first run
                    return;
                }

                if (currentRelPosition !== previousPosMap[bandName]) { // Check if position has changed (a cross occurred)
                    // A cross has occurred
                    const crossDirection = currentRelPosition === 'above' ? 'up' : 'down';
                    const message = `ドル円が${bandName}を${crossDirection === 'up' ? '上抜け' : '下抜け'}しました！`;
                    console.log(`BB Cross Detected for ${bandName}! Price: ${price}, Band: ${bandValue}. Direction: ${crossDirection}. Emitting event.`);
                    io.emit('bb_cross', {
                        message: message,
                        price: price,
                        bandName: bandName,
                        bandValue: bandValue,
                        crossDirection: crossDirection,
                        timestamp: new Date()
                    });
                }
                previousPosMap[bandName] = currentRelPosition; // Update previous position
            };

            const checkAndEmitCrossEMA = (emaName, emaValue, price, previousPosMap) => {
                const currentRelPosition = price > emaValue ? 'above' : 'below'; // Determine current position relative to EMA
                if (previousPosMap[emaName] === 'unknown') {
                    previousPosMap[emaName] = currentRelPosition; // Initialize if first run
                    return;
                }

                if (currentRelPosition !== previousPosMap[emaName]) { // Check if position has changed (a cross occurred)
                    // A cross has occurred
                    const crossDirection = currentRelPosition === 'above' ? 'up' : 'down';
                    const message = `ドル円が${emaName}を${crossDirection === 'up' ? '上抜け' : '下抜け'}しました！`;
                    console.log(`EMA Cross Detected for ${emaName}! Price: ${price}, EMA: ${emaValue}. Direction: ${crossDirection}. Emitting event.`);
                    io.emit('ema_cross', { // Emit 'ema_cross' event
                        message: message,
                        price: price,
                        emaName: emaName,
                        emaValue: emaValue,
                        crossDirection: crossDirection,
                        timestamp: new Date()
                    });
                }
                previousPosMap[emaName] = currentRelPosition; // Update previous position
            };

            // 5. Detect BB crosses
            checkAndEmitCross('upper2', bands.upper2, currentPrice, previousPositions);
            checkAndEmitCross('lower2', bands.lower2, currentPrice, previousPositions);
            checkAndEmitCross('upper1', bands.upper1, currentPrice, previousPositions);
            checkAndEmitCross('lower1', bands.lower1, currentPrice, previousPositions);
            checkAndEmitCross('middle', bands.middle, currentPrice, previousPositions);

            // 6. Detect EMA crosses
            if (latestEMA10) checkAndEmitCrossEMA('ema10', latestEMA10, currentPrice, previousPositionsEMA);
            if (latestEMA25) checkAndEmitCrossEMA('ema25', latestEMA25, currentPrice, previousPositionsEMA);
            if (latestEMA50) checkAndEmitCrossEMA('ema50', latestEMA50, currentPrice, previousPositionsEMA);

        } catch (error) {
            console.error('Error in price watcher:', error);
        }
    }, 15000); // Run every 15 seconds. NOTE: Frequent API calls may lead to rate limiting.
}


// --- Server Startup ---
async function startServer() {
    // Configure email service before starting the server
    await configureNodemailer();

    // Ensure database tables are created before starting the server
    console.log("Initializing database...");
    await createEmailsTable();
    await createUsersTable();
    await createUserSettingsTable();
    console.log("Database initialized successfully.");

    server.listen(port, '0.0.0.0', () => {
        console.log(`Proxy server listening at http://0.0.0.0:${port}`);
        console.log('API endpoint for stocks: /api/data?ticker=7203.T&interval=1d');
        console.log('API endpoint for USD/JPY: /api/usd_jpy_data');
        startPriceWatcher(); // Start the real-time price watcher
    });
}

startServer();