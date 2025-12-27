const express = require('express');
const yahooFinance = require('yahoo-finance2').default;
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());

app.use(express.static('dist'));
app.use(express.static(__dirname));

// A simple caching mechanism
const cache = {};
const CACHE_TTL = 60 * 1000; // 60 seconds

app.get('/api/data', async (req, res) => {
    const { ticker, interval } = req.query;

    if (!ticker || !interval) {
        return res.status(400).json({ error: 'Ticker and interval are required' });
    }

    const cacheKey = `${ticker}-${interval}`;
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
    const daysAgo = isIntraday ? 5 : 60; // 5 days for intraday, 60 days for daily/weekly/monthly

    const queryOptions = {
        period1: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
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

app.listen(port, '0.0.0.0', () => {
    console.log(`Proxy server listening at http://0.0.0.0:${port}`);
    console.log('API endpoint: /api/data?ticker=7203.T&interval=1d');
});
