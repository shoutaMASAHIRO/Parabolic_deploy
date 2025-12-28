const express = require('express');
const yahooFinance = require('yahoo-finance2').default;
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = 3000;

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

// --- Middleware ---
app.use(cors());
app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.static('dist'));
app.use(express.static(__dirname));

// A simple caching mechanism
const cache = {};
const CACHE_TTL = 60 * 1000; // 60 seconds

// --- API Endpoints ---

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
        const validIntervals = ["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo", "3mo"];
        if (!validIntervals.includes(interval)) {
            return res.status(400).json({ error: `Invalid interval. Valid intervals are: ${validIntervals.join(', ')}` });
        }

        // Dynamically adjust period based on interval to ensure enough data for indicators
        const isIntraday = interval.endsWith('m') || interval.endsWith('h');

        let daysToFetch;
        switch (interval) {
            case "1m":
            case "2m":
            case "5m":
            case "15m":
            case "30m":
                daysToFetch = 30; // Fetch enough days to cover 365 minutes within trading hours, and account for API limits
                break;
            case "60m":
            case "1h":
                daysToFetch = 60; // Fetch enough days to cover 365 hours within trading hours
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
            interval: interval,
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
    const validIntervals = ["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo", "3mo"];
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
    switch (interval) {
        case "1m":
        case "2m":
        case "5m":
        case "15m":
        case "30m":
            daysToFetch = 30; // Fetch enough days to cover 365 minutes within trading hours, and account for API limits
            break;
        case "60m":
        case "1h":
            daysToFetch = 60; // Fetch enough days to cover 365 hours within trading hours
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
        interval: interval,
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

// Start the server and create table
app.listen(port, '0.0.0.0', () => {
    console.log(`Proxy server listening at http://0.0.0.0:${port}`);
    console.log('API endpoint for stocks: /api/data?ticker=7203.T&interval=1d');
    console.log('API endpoint for USD/JPY: /api/usd_jpy_data');
    createEmailsTable();
});
