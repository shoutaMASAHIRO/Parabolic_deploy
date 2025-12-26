import { createChart as createLightweightChart, LineStyle } from 'lightweight-charts';
import { SMA, RSI } from 'technicalindicators';


// --- DOM Elements ---
const tickersInput = document.getElementById('tickers-input');
const intervalSelect = document.getElementById('interval-select');
const startButton = document.getElementById('start-button');
const chartsContainer = document.getElementById('charts-container');
const statusMessage = document.getElementById('status-message');

// --- Global State ---
let chartObjects = []; // To hold all chart instances for resizing
let updateIntervalId = null;

// --- Charting Configuration ---
const chartLayoutOptions = {
    layout: {
        background: { color: '#0a0a0a' },
        textColor: '#ffffff',
    },
    grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.15)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.15)' },
    },
    timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#555555',
    },
};

/**
 * Creates a new chart instance with the standard dark theme.
 * @param {HTMLElement} container The container element for the chart.
 * @param {object} options Custom options to override defaults.
 * @returns {import('lightweight-charts').IChartApi}
 */
function createChart(container, options = {}) {
    const chart = createLightweightChart(container, {
        ...chartLayoutOptions,
        ...options,
        width: container.clientWidth,
        height: container.clientHeight,
    });
    chartObjects.push({ container, chart });
    return chart;
}

/**
 * Fetches data from the local proxy server.
 * @param {string} ticker The stock ticker symbol.
 * @param {string} interval The data interval.
 * @returns {Promise<object[]>} A promise that resolves to the chart data.
 */
async function fetchData(ticker, interval) {
    const apiUrl = `http://localhost:3000/api/data?ticker=${ticker}&interval=${interval}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Format for Lightweight Charts: { time, open, high, low, close }
        return data
            .filter(d => d.date && d.open && d.high && d.low && d.close) // Ensure data is valid
            .map(d => ({
                time: (new Date(d.date).getTime() / 1000), // Convert to UNIX timestamp (seconds)
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
            }))
            .sort((a, b) => a.time - b.time); // Sort chronologically
    } catch (error) {
        console.error(`Failed to fetch data for ${ticker}:`, error);
        throw error;
    }
}

/**
 * Fetches data and draws all charts for a single ticker.
 * @param {string} ticker The stock ticker symbol.
 * @param {string} interval The data interval.
 */
async function renderChartForTicker(ticker, interval) {
    // Sanitize ticker for use in DOM IDs by removing dots
    const sanitizedTicker = ticker.replace(/\./g, '');

    // 1. Create container for this ticker's charts
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-wrapper';
    wrapper.innerHTML = `
        <h2 class="chart-title">${ticker}</h2>
        <div class="chart-container" id="ohlc-${sanitizedTicker}"></div>
        <div class="sub-chart-container" id="price-ma-${sanitizedTicker}"></div>
        <div class="sub-chart-container" id="rsi-${sanitizedTicker}"></div>
    `;
    chartsContainer.appendChild(wrapper);

    // 2. Fetch data
    let data;
    try {
        data = await fetchData(ticker, interval);
        if (!data || data.length < 20) {
            throw new Error("Not enough data to calculate indicators.");
        }
    } catch (error) {
        wrapper.querySelector(`#ohlc-${sanitizedTicker}`).innerText = `Error loading data for ${ticker}: ${error.message}`;
        return;
    }

    const closePrices = data.map(d => d.close);

    // 3. Calculate Indicators
    const ma20 = SMA.calculate({ period: 20, values: closePrices });
    const rsi14 = RSI.calculate({ period: 14, values: closePrices });
    
    // Align indicator data with main chart data
    const priceAndMaData = data.slice(-ma20.length).map((d, i) => ({ time: d.time, value: ma20[i] }));
    const rsiData = data.slice(-rsi14.length).map((d, i) => ({ time: d.time, value: rsi14[i] }));
    const closePriceData = data.slice(-ma20.length).map((d) => ({time: d.time, value: d.close}));

    // 4. Create and configure charts
    
    // Candlestick Chart
    const ohlcChart = createChart(wrapper.querySelector(`#ohlc-${sanitizedTicker}`));
    const candleSeries = ohlcChart.addCandlestickSeries({
        upColor: '#ff4c4c',
        downColor: '#4c6aff',
        borderVisible: false,
        wickUpColor: '#ff4c4c',
        wickDownColor: '#4c6aff',
    });
    candleSeries.setData(data);

    // Price + MA20 Chart
    const priceMaChart = createChart(wrapper.querySelector(`#price-ma-${sanitizedTicker}`));
    const priceSeries = priceMaChart.addLineSeries({ color: 'white', lineWidth: 2, title: 'Close' });
    const maSeries = priceMaChart.addLineSeries({ color: 'orange', lineWidth: 2, title: 'MA20' });
    priceSeries.setData(closePriceData);
    maSeries.setData(priceAndMaData);
    priceMaChart.timeScale().setVisible(false); // Hide time scale for sub-charts

    // RSI Chart
    const rsiChart = createChart(wrapper.querySelector(`#rsi-${sanitizedTicker}`), {
        priceScale: {
            autoScale: false, // Disable auto scale for fixed 0-100 range
            scaleMargins: { top: 0.1, bottom: 0.1 },
        }
    });
    rsiChart.priceScale().applyOptions({
        minimum: 0,
        maximum: 100,
    });

    const rsiSeries = rsiChart.addLineSeries({ color: '#8A2BE2', lineWidth: 1, title: 'RSI(14)' });
    rsiSeries.setData(rsiData);

    // Add RSI bands
    rsiSeries.createPriceLine({ price: 70, color: 'orange', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '70' });
    rsiSeries.createPriceLine({ price: 30, color: 'green', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: '30' });

    // Add RSI sharp change markers (same logic as Python script)
    const rsiDiffMarkers = [];
    for (let i = 1; i < rsiData.length; i++) {
        const diff = rsiData[i].value - rsiData[i-1].value;
        if (diff >= 10) {
            rsiDiffMarkers.push({ time: rsiData[i].time, position: 'belowBar', color: 'red', shape: 'arrowUp', text: '▲' });
        } else if (diff <= -10) {
            rsiDiffMarkers.push({ time: rsiData[i].time, position: 'aboveBar', color: 'blue', shape: 'arrowDown', text: '▼' });
        }
    }
    rsiSeries.setMarkers(rsiDiffMarkers);

    rsiChart.timeScale().setVisible(false);

    // Sync crosshairs across charts for this ticker
    ohlcChart.timeScale().subscribeVisibleTimeRangeChange(timeRange => {
        priceMaChart.timeScale().setVisibleTimeRange(timeRange);
        rsiChart.timeScale().setVisibleTimeRange(timeRange);
    });
    priceMaChart.timeScale().subscribeVisibleTimeRangeChange(timeRange => {
        ohlcChart.timeScale().setVisibleTimeRange(timeRange);
        rsiChart.timeScale().setVisibleTimeRange(timeRange);
    });
    rsiChart.timeScale().subscribeVisibleTimeRangeChange(timeRange => {
        ohlcChart.timeScale().setVisibleTimeRange(timeRange);
        priceMaChart.timeScale().setVisibleTimeRange(timeRange);
    });

}

/**
 * Main function to start/update the charting process.
 */
async function start() {
    // Clear previous state
    if (updateIntervalId) {
        clearInterval(updateIntervalId);
    }
    chartsContainer.innerHTML = '';
    chartObjects = [];
    statusMessage.textContent = 'チャートを読み込んでいます...';

    const tickers = tickersInput.value.split(',').map(t => t.trim()).filter(t => t);
    const interval = intervalSelect.value;
    
    // Add ".T" for Japanese stocks if not present
    const formattedTickers = tickers.map(c => c.endsWith(".T") ? c : `${c}.T`);

    await Promise.all(
        formattedTickers.map(ticker => renderChartForTicker(ticker, interval))
    );

    statusMessage.textContent = `表示中: ${formattedTickers.join(', ')} (${interval}) - 60秒ごとに更新`;

    // Set up auto-update
    updateIntervalId = setInterval(start, 60 * 1000);
}

// --- Event Listeners ---
window.addEventListener('resize', () => {
    chartObjects.forEach(({ container, chart }) => {
        chart.resize(container.clientWidth, container.clientHeight);
    });
});

startButton.addEventListener('click', start);

// --- Initial Load ---
start();
