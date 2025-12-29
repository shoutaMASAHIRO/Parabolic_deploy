import { createChart as createLightweightChart, LineStyle } from 'lightweight-charts';
import { BollingerBands, SMA, EMA } from 'technicalindicators';


// --- DOM Elements ---
const tickersInput = document.getElementById('tickers-input');
const intervalSelect = document.getElementById('interval-select');
const startButton = document.getElementById('start-button');
const chartsContainer = document.getElementById('charts-container');
const statusMessage = document.getElementById('status-message');
const stockToggle = document.getElementById('stockToggle');
const usdJpyToggle = document.getElementById('usdJpyToggle');
const tickersInputGroup = tickersInput.closest('.input-group');
const toggleBbButton = document.getElementById('toggle-bb-button');
const toggleEmaButton = document.getElementById('toggle-ema-button');
const bbPeriodInput = document.getElementById('bb-period');
const ema1PeriodInput = document.getElementById('ema1-period');
const ema2PeriodInput = document.getElementById('ema2-period');
const ema3PeriodInput = document.getElementById('ema3-period');
const applyIndicatorsButton = document.getElementById('apply-indicators-button');
const toggleSettingsButton = document.getElementById('toggle-settings-button');
const indicatorSettings = document.getElementById('indicator-settings');
const toggleSubscribeButton = document.getElementById('toggle-subscribe-button');
const subscribeSettings = document.getElementById('subscribe-settings');
const emailInput = document.getElementById('email-input');
const subscribeButton = document.getElementById('subscribe-button');
const toggleEmailListButton = document.getElementById('toggle-email-list-button');
const emailListPanel = document.getElementById('email-list-panel');
const emailList = document.getElementById('email-list');

// --- Global State ---
let chartObjects = []; // To hold all chart instances and their series for updates
let updateIntervalId = null;
let currentDataType = 'stock'; // 'stock' or 'usd_jpy'
let currentInterval = '1d'; // Store the currently selected interval
let currentTickers = []; // Store the currently selected tickers
let areBollingerBandsVisible = true; // Initial state: Bollinger Bands are visible
let areEmaVisible = true; // Initial state: EMA is visible

/**
 * Refreshes data for all active charts and updates their series.
 */
async function refreshChartData() {
    statusMessage.textContent = `更新中: ${currentDataType === 'stock' ? currentTickers.join(', ') : 'USD/JPY'} (${currentInterval}) - データ取得中...`;

    for (const chartObj of chartObjects) {
        let data;
        try {
            if (currentDataType === 'stock') {
                data = await fetchStockData(chartObj.ticker, currentInterval);
            } else { // usd_jpy
                // Use chartObj.interval to get the actual interval that data was successfully fetched with,
                // accounting for any fallback to '1d' in renderChartForUsdJpy.
                data = await fetchUsdJpyData(chartObj.interval);
            }

            if (!data || data.length < 20) {
                console.warn(`Not enough data to update indicators for ${chartObj.ticker}.`);
                continue; // Skip this chart if data is insufficient
            }

            const closePrices = data.map(d => d.close);

            // Recalculate Bollinger Bands
            const bbPeriod = parseInt(bbPeriodInput.value) || 20;
            const bbInput1 = { period: bbPeriod, values: closePrices, stdDev: 1 };
            const bbInput2 = { period: bbPeriod, values: closePrices, stdDev: 2 };

            const bb1 = BollingerBands.calculate(bbInput1);
            const bb2 = BollingerBands.calculate(bbInput2);

            // Recalculate EMAs
            const emaPeriods = [
                { period: parseInt(ema1PeriodInput.value) || 10, color: 'yellow' },
                { period: parseInt(ema2PeriodInput.value) || 25, color: 'yellow' },
                { period: parseInt(ema3PeriodInput.value) || 50, color: 'yellow' }
            ];
            const emaDataArray = emaPeriods.map(({ period }) => {
                const emaInput = { period, values: closePrices, exact: false };
                const ema = EMA.calculate(emaInput);
                const emaOffset = data.length - ema.length;
                return ema.map((d, i) => ({ time: data[i + emaOffset].time, value: d }));
            });

            // Align indicator data with main chart data
            const dataOffset = data.length - bb1.length;
            const middleBandData = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.middle }));
            const upperBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
            const lowerBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));
            const upperBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
            const lowerBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));

            // Update series data
            chartObj.candleSeries.setData(data);
            chartObj.middleBandSeries.setData(middleBandData);
            chartObj.upperBand1Series.setData(upperBand1Data);
            chartObj.lowerBand1Series.setData(lowerBand1Data);
            chartObj.upperBand2Series.setData(upperBand2Data);
            chartObj.lowerBand2Series.setData(lowerBand2Data);
            
            // Update all EMA series
            if (chartObj.emaSeriesArray && chartObj.emaSeriesArray.length > 0) {
                chartObj.emaSeriesArray.forEach((emaSeries, index) => {
                    emaSeries.setData(emaDataArray[index]);
                });
            }
            
            // Do NOT call fitContent() here, as it would reset user's zoom/pan
            // chartObj.chart.timeScale().fitContent();

        } catch (error) {
            console.error(`Failed to refresh data for ${chartObj.ticker}:`, error);
            statusMessage.textContent = `エラー: ${chartObj.ticker} のデータ更新に失敗しました。`;
        }
    }
    statusMessage.textContent = `表示中: ${currentDataType === 'stock' ? currentTickers.join(', ') : 'USD/JPY'} (${currentInterval}) - 60秒ごとに更新`;
}

// --- Interval Options ---
const stockIntervalOptions = [
    { value: '5m', text: '5分' },
    { value: '15m', text: '15分' },
    { value: '30m', text: '30分' },
    { value: '1h', text: '1時間' },
    { value: '1d', text: '日足' },
    { value: '1wk', text: '1週間' },
];

// Note: For USD/JPY, intraday intervals might not be reliably available from Yahoo Finance.
// We'll restrict to generally available intervals to avoid "Invalid interval" errors.
const usdJpyIntervalOptions = [
    { value: '5m', text: '5分' },
    { value: '15m', text: '15分' },
    { value: '30m', text: '30分' },
    { value: '1h', text: '1時間' },
    { value: '1d', text: '日足' },
    { value: '1wk', text: '1週間' },
];

/**
 * Updates the intervalSelect dropdown with new options.
 * @param {Array<Object>} options - An array of { value: string, text: string } objects.
 * @param {string} defaultValue - The default value to set for the select.
 */
function updateIntervalOptions(options, defaultValue) {
    intervalSelect.innerHTML = ''; // Clear existing options
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.text;
        intervalSelect.appendChild(opt);
    });
    // Set the default value, ensuring it's one of the available options
    intervalSelect.value = options.some(opt => opt.value === defaultValue) ? defaultValue : options[0].value;
}


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
        localization: {
            timeFormatter: (timestamp) => {
                const date = new Date(timestamp * 1000);
                const month = date.getMonth() + 1;
                const day = date.getDate();
                const isIntraday = currentInterval.includes('m') || currentInterval.includes('h');

                if (isIntraday) {
                    const hours = date.getHours().toString().padStart(2, '0');
                    const minutes = date.getMinutes().toString().padStart(2, '0');
                    return `${month}月${day}日 ${hours}:${minutes}`;
                } else {
                    return `${month}月${day}日`;
                }
            },
        },
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
    return chart;
}

/**
 * Updates the visibility of the ticker input based on the current data type.
 */
function updateTickerInputVisibility() {
    if (currentDataType === 'usd_jpy') {
        tickersInputGroup.style.display = 'none';
    } else {
        tickersInputGroup.style.display = 'flex';
    }
}

/**
 * Toggles the visibility of Bollinger Bands on all active charts.
 */
function toggleBollingerBandsVisibility() {
    areBollingerBandsVisible = !areBollingerBandsVisible; // Toggle the state

    // Update button text
    toggleBbButton.textContent = areBollingerBandsVisible ? 'BB非表示' : 'BB表示';

    // Call start to re-render charts with new BB visibility state
    start(currentDataType);
}

/**
 * Toggles the visibility of EMA on all active charts.
 */
function toggleEmaVisibility() {
    areEmaVisible = !areEmaVisible; // Toggle the state

    // Update button text
    toggleEmaButton.textContent = areEmaVisible ? 'EMA非表示' : 'EMA表示';

    // Call start to re-render charts with new EMA visibility state
    start(currentDataType);
}

/**
 * Fetches data from the local proxy server for stocks.
 * @param {string} ticker The stock ticker symbol.
 * @param {string} interval The data interval.
 * @returns {Promise<object[]>} A promise that resolves to the chart data.
 */
async function fetchStockData(ticker, interval) {
    const apiUrl = `${window.location.protocol}//${window.location.host}/api/data?ticker=${ticker}&interval=${interval}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const formattedData = data
            .filter(d => d.date && d.open && d.high && d.low && d.close) // Ensure data is valid
            .map(d => ({
                time: (new Date(d.date).getTime() / 1000), // Convert to UNIX timestamp (seconds)
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
            }))
            .sort((a, b) => a.time - b.time); // Sort chronologically
        
        return formattedData;
    } catch (error) {
        console.error(`Failed to fetch data for ${ticker}:`, error);
        throw error;
    }
}

/**
 * Fetches data from the local proxy server for USD/JPY.
 * @param {string} interval The data interval.
 * @returns {Promise<object[]>} A promise that resolves to the chart data.
 */
async function fetchUsdJpyData(interval) {
    const apiUrl = `${window.location.protocol}//${window.location.host}/api/usd_jpy_data?interval=${interval}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const formattedData = data
            .filter(d => d.date && d.open && d.high && d.low && d.close) // Ensure data is valid
            .map(d => ({
                time: (new Date(d.date).getTime() / 1000), // Convert to UNIX timestamp (seconds)
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
            }))
            .sort((a, b) => a.time - b.time); // Sort chronologically
        
        return formattedData;
    } catch (error) {
        console.error(`Failed to fetch USD/JPY data:`, error);
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
    `;
    chartsContainer.appendChild(wrapper);

    // 2. Fetch data
    let data;
    try {
        data = await fetchStockData(ticker, interval);
        // Bollinger Bands require a certain amount of data to be calculated
        if (!data || data.length < 20) {
            throw new Error("Not enough data to calculate indicators.");
        }
    } catch (error) {
        wrapper.querySelector(`#ohlc-${sanitizedTicker}`).innerText = `Error loading data for ${ticker}: ${error.message}`;
        return;
    }

    const closePrices = data.map(d => d.close);

    // 3. Calculate Bollinger Bands
    const bbPeriod = parseInt(bbPeriodInput.value) || 20;
    const bbInput1 = { period: bbPeriod, values: closePrices, stdDev: 1 };
    const bbInput2 = { period: bbPeriod, values: closePrices, stdDev: 2 };

    const bb1 = BollingerBands.calculate(bbInput1);
    const bb2 = BollingerBands.calculate(bbInput2);

    // 3.5. Calculate EMAs
    const emaPeriods = [
        { period: parseInt(ema1PeriodInput.value) || 10, color: 'yellow' },
        { period: parseInt(ema2PeriodInput.value) || 25, color: 'yellow' },
        { period: parseInt(ema3PeriodInput.value) || 50, color: 'yellow' }
    ];

    const emaDataArray = emaPeriods.map(({ period }) => {
        const emaInput = { period, values: closePrices, exact: false };
        const ema = EMA.calculate(emaInput);
        const emaOffset = data.length - ema.length;
        return ema.map((d, i) => ({ time: data[i + emaOffset].time, value: d }));
    });

    // Align indicator data with main chart data
    const dataOffset = data.length - bb1.length;
    const middleBandData = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.middle }));
    const upperBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
    const lowerBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));
    const upperBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
    const lowerBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));

    // 4. Create and configure charts
    const ohlcChart = createChart(wrapper.querySelector(`#ohlc-${sanitizedTicker}`));
    
    // Add Bollinger Band series FIRST so they are in the background
    const middleBandSeries = ohlcChart.addLineSeries({ color: 'purple', lineWidth: 2, title: 'BB 0σ', crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
    const upperBand1Series = ohlcChart.addLineSeries({ color: 'purple', lineWidth: 2, title: 'BB +1σ', crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
    const lowerBand1Series = ohlcChart.addLineSeries({ color: 'purple', lineWidth: 2, title: 'BB -1σ', crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
    const upperBand2Series = ohlcChart.addLineSeries({ color: 'purple', lineWidth: 2, title: 'BB +2σ', crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
    const lowerBand2Series = ohlcChart.addLineSeries({ color: 'purple', lineWidth: 2, title: 'BB -2σ', crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
    
    middleBandSeries.setData(middleBandData);
    upperBand1Series.setData(upperBand1Data);
    lowerBand1Series.setData(lowerBand1Data);
    upperBand2Series.setData(upperBand2Data);
    lowerBand2Series.setData(lowerBand2Data);

    // Add EMA series
    const emaSeriesArray = emaPeriods.map((emaConfig, index) => {
        const emaSeries = ohlcChart.addLineSeries({
            color: emaConfig.color,
            lineWidth: 1,
            title: `EMA ${emaConfig.period}`,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false, // Enable last value label
            visible: areEmaVisible
        });
        emaSeries.setData(emaDataArray[index]);
        return emaSeries;
    });

    // Add Candlestick series last so it's in the foreground
    const candleSeries = ohlcChart.addCandlestickSeries({
        upColor: '#ff4c4c',
        downColor: '#4c6aff',
        borderVisible: false,
        wickUpColor: '#ff4c4c',
        wickDownColor: '#4c6aff',
    });
    candleSeries.setData(data);

    return {
        chart: ohlcChart,
        container: wrapper.querySelector(`#ohlc-${sanitizedTicker}`),
        candleSeries,
        middleBandSeries,
        upperBand1Series,
        lowerBand1Series,
        upperBand2Series,
        lowerBand2Series,
        emaSeriesArray, // Store EMA series array
        ticker, // Store ticker for easy access during updates
        interval, // Store interval for easy access during updates
    };
}

/**
 * Renders charts for stock data.
 * @param {string[]} tickers Array of stock ticker symbols.
 * @param {string} interval The data interval.
 */
async function renderChartsForStocks(tickers, interval) {
    const renderedCharts = await Promise.all(
        tickers.map(ticker => renderChartForTicker(ticker, interval))
    );
    chartObjects.push(...renderedCharts);
}

/**
 * Renders the chart for USD/JPY data.
 * @param {string} interval The data interval.
 */
async function renderChartForUsdJpy(interval) {
    const defaultInterval = '1d';
    let currentInterval = interval;
    let dataFetchAttempted = 0; // Track attempts to prevent infinite loops

    while (dataFetchAttempted < 2) { // Allow one retry with default interval
        // 1. Create container for USD/JPY chart
        const wrapper = document.createElement('div');
        wrapper.className = 'chart-wrapper';
        wrapper.innerHTML = `
            <h2 class="chart-title">USD/JPY</h2>
            <div class="chart-container" id="usd-jpy-chart"></div>
        `;
        chartsContainer.appendChild(wrapper);

        // 2. Fetch data
        let data;
        let errorMessage = '';
        try {
            data = await fetchUsdJpyData(currentInterval);
            // Bollinger Bands require a certain amount of data to be calculated
            if (!data || data.length < 20) {
                throw new Error(`Not enough data to calculate indicators for USD/JPY with interval ${currentInterval}.`);
            }
        } catch (error) {
            errorMessage = `Error loading USD/JPY data for interval '${currentInterval}': ${error.message}`;
            if (error.message.includes("not supported by Yahoo Finance for currency pairs")) {
                 errorMessage = `エラー: ドル円の '${currentInterval}' インターバルはYahoo Financeでサポートされていない可能性があります。`;
            } else if (error.message.includes("Not enough data")) {
                errorMessage = `エラー: ドル円の '${currentInterval}' インターバルで十分なデータがありません。`;
            }
            console.error(errorMessage);

            if (currentInterval !== defaultInterval && dataFetchAttempted === 0) {
                // Try fetching with the default interval and display a warning
                wrapper.querySelector(`#usd-jpy-chart`).innerText = `${errorMessage} 日足で再試行します...`;
                currentInterval = defaultInterval;
                dataFetchAttempted++;
                chartsContainer.innerHTML = ''; // Clear for retry
                continue; // Retry with default interval
            } else {
                wrapper.querySelector(`#usd-jpy-chart`).innerText = `${errorMessage} 日足データも取得できませんでした。`;
                return; // Failed even with default interval
            }
        }

        // If data was successfully fetched, break the loop
        if (data && data.length > 0) {
            // Display a message if a fallback was used
            if (interval !== currentInterval) {
                 statusMessage.textContent = `注意: ドル円の '${interval}' インターバルはサポートされていません。日足データが表示されています。`;
            } else {
                 statusMessage.textContent = `表示中: USD/JPY (${currentInterval}) - 60秒ごとに更新`;
            }

            const closePrices = data.map(d => d.close);

            // 3. Calculate Bollinger Bands
            const bbPeriod = parseInt(bbPeriodInput.value) || 20;
            const bbInput1 = { period: bbPeriod, values: closePrices, stdDev: 1 };
            const bbInput2 = { period: bbPeriod, values: closePrices, stdDev: 2 };

            const bb1 = BollingerBands.calculate(bbInput1);
            const bb2 = BollingerBands.calculate(bbInput2);

            // 3.5. Calculate EMAs
            const emaPeriods = [
                { period: parseInt(ema1PeriodInput.value) || 10, color: 'yellow' },
                { period: parseInt(ema2PeriodInput.value) || 25, color: 'yellow' },
                { period: parseInt(ema3PeriodInput.value) || 50, color: 'yellow' }
            ];
        
            const emaDataArray = emaPeriods.map(({ period }) => {
                const emaInput = { period, values: closePrices, exact: false };
                const ema = EMA.calculate(emaInput);
                const emaOffset = data.length - ema.length;
                return ema.map((d, i) => ({ time: data[i + emaOffset].time, value: d }));
            });

            // Align indicator data with main chart data
            const dataOffset = data.length - bb1.length;
            const middleBandData = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.middle }));
            const upperBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
            const lowerBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));
            const upperBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
            const lowerBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));

            // 4. Create and configure chart
            const usdJpyChart = createChart(wrapper.querySelector(`#usd-jpy-chart`));

            // Add Bollinger Band series FIRST so they are in the background
            const middleBandSeries = usdJpyChart.addLineSeries({ color: 'purple', lineWidth: 2, title: 'BB 0σ', crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
            const upperBand1Series = usdJpyChart.addLineSeries({ color: 'purple', lineWidth: 2, title: 'BB +1σ', crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
            const lowerBand1Series = usdJpyChart.addLineSeries({ color: 'purple', lineWidth: 2, title: 'BB -1σ', crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
            const upperBand2Series = usdJpyChart.addLineSeries({ color: 'purple', lineWidth: 2, title: 'BB +2σ', crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
            const lowerBand2Series = usdJpyChart.addLineSeries({ color: 'purple', lineWidth: 2, title: 'BB -2σ', crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: areBollingerBandsVisible });
            
            middleBandSeries.setData(middleBandData);
            upperBand1Series.setData(upperBand1Data);
            lowerBand1Series.setData(lowerBand1Data);
            upperBand2Series.setData(upperBand2Data);
            lowerBand2Series.setData(lowerBand2Data);

            // Add EMA series
            const emaSeriesArray = emaPeriods.map((emaConfig, index) => {
                const emaSeries = usdJpyChart.addLineSeries({
                    color: emaConfig.color,
                    lineWidth: 1,
                    title: `EMA ${emaConfig.period}`,
                    crosshairMarkerVisible: false,
                    priceLineVisible: false,
                    lastValueVisible: false, // Enable last value label
                    visible: areEmaVisible
                });
                emaSeries.setData(emaDataArray[index]);
                return emaSeries;
            });

            // Add Candlestick series last so it's in the foreground
            const candleSeries = usdJpyChart.addCandlestickSeries({
                upColor: '#ff4c4c',
                downColor: '#4c6aff',
                borderVisible: false,
                wickUpColor: '#ff4c4c',
                wickDownColor: '#4c6aff',
            });
            candleSeries.setData(data);

            // Adjust the visible range to show the latest data
            usdJpyChart.timeScale().fitContent();
            
            return {
                chart: usdJpyChart,
                container: wrapper.querySelector(`#usd-jpy-chart`),
                candleSeries,
                middleBandSeries,
                upperBand1Series,
                lowerBand1Series,
                upperBand2Series,
                lowerBand2Series,
                emaSeriesArray, // Store EMA series array
                ticker: 'USDJPY=X', // Store ticker for easy access during updates
                interval: currentInterval, // Store currentInterval as the actual interval used
            };
        }
        dataFetchAttempted++; // Increment attempt counter if loop continues
    }
    // If the loop finishes without returning, it means an error occurred
    return null; // Indicate failure to render
}

/**
 * Main function to start/update the charting process.
 * @param {string} dataType The type of data to display ('stock' or 'usd_jpy').
 */
async function start(dataType) {
    // Clear previous update interval
    if (updateIntervalId) {
        clearInterval(updateIntervalId);
    }
    
    // Clear existing charts from DOM and reset chartObjects
    chartsContainer.innerHTML = '';
    chartObjects = [];
    statusMessage.textContent = 'チャートを読み込んでいます...';

    currentDataType = dataType; // Update global data type

    if (dataType === 'stock') {
        currentTickers = tickersInput.value.split(',').map(t => t.trim()).filter(t => t);
        currentInterval = intervalSelect.value;
        
        // Add ".T" for Japanese stocks if not present
        const formattedTickers = currentTickers.map(c => c.endsWith(".T") ? c : `${c}.T`);

        await renderChartsForStocks(formattedTickers, currentInterval);
        statusMessage.textContent = `表示中: ${formattedTickers.join(', ')} (${currentInterval}) - 60秒ごとに更新`;
        updateIntervalId = setInterval(refreshChartData, 60 * 1000);

    } else if (dataType === 'usd_jpy') {
        currentTickers = ['USDJPY=X']; // USD/JPY has a fixed ticker
        currentInterval = intervalSelect.value; // Get the selected interval
        const usdJpyChartObj = await renderChartForUsdJpy(currentInterval); // Pass interval to render function
        if (usdJpyChartObj) {
            chartObjects.push(usdJpyChartObj);
        }
        statusMessage.textContent = `表示中: USD/JPY (${currentInterval}) - 60秒ごとに更新`;
        updateIntervalId = setInterval(refreshChartData, 60 * 1000);
    }
}

// --- Event Listeners ---
window.addEventListener('resize', () => {
    chartObjects.forEach(({ container, chart }) => {
        chart.resize(container.clientWidth, container.clientHeight);
    });
});

startButton.addEventListener('click', () => start(currentDataType));
toggleBbButton.addEventListener('click', toggleBollingerBandsVisibility);
toggleEmaButton.addEventListener('click', toggleEmaVisibility);
applyIndicatorsButton.addEventListener('click', () => {
    start(currentDataType);
    indicatorSettings.classList.add('hidden'); // Hide the settings panel after applying
});

toggleSettingsButton.addEventListener('click', () => {
    indicatorSettings.classList.toggle('hidden');
});

toggleSubscribeButton.addEventListener('click', () => {
    subscribeSettings.classList.toggle('hidden');
});

subscribeButton.addEventListener('click', async () => {
    const email = emailInput.value;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        statusMessage.textContent = '有効なメールアドレスを入力してください。';
        return;
    }

    try {
        statusMessage.textContent = '登録中...';
        const response = await fetch('/api/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        const result = await response.json();

        if (response.ok) {
            statusMessage.textContent = result.message;
            emailInput.value = ''; // Clear input on success
            setTimeout(() => {
                subscribeSettings.classList.add('hidden');
            }, 1500); // Hide panel after a short delay
        } else {
            throw new Error(result.error || '登録に失敗しました。');
        }
    } catch (error) {
        statusMessage.textContent = error.message;
    }
});

toggleEmailListButton.addEventListener('click', async () => {
    const isHidden = emailListPanel.classList.contains('hidden');

    if (isHidden) {
        try {
            const response = await fetch('/api/emails');
            if (!response.ok) {
                throw new Error('Could not fetch email list.');
            }
            const emails = await response.json();
            
            emailList.innerHTML = ''; // Clear previous list

            if (emails.length === 0) {
                const li = document.createElement('li');
                li.textContent = '登録されているメールアドレスはありません。';
                emailList.appendChild(li);
            } else {
                emails.forEach(item => {
                    const li = document.createElement('li');
                    li.textContent = item.email; // Display email text
                    li.classList.add('email-list-item'); // Add class for styling

                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = '削除';
                    deleteButton.classList.add('delete-email-button');
                    deleteButton.dataset.email = item.email; // Store email for deletion
                    
                    deleteButton.addEventListener('click', async (event) => {
                        event.stopPropagation(); // Prevent toggling the panel
                        const emailToDelete = event.target.dataset.email;
                        await deleteEmail(emailToDelete);
                        // Re-fetch and re-render the list after deletion
                        await refreshEmailList();
                    });
                    
                    li.appendChild(deleteButton);
                    emailList.appendChild(li);
                });
            }
            emailListPanel.classList.remove('hidden');
        } catch (error) {
            console.error('Failed to fetch emails:', error);
            statusMessage.textContent = 'メールリストの読み込みに失敗しました。';
        }
    } else {
        emailListPanel.classList.add('hidden');
    }
});

/**
 * Deletes an email from the database.
 * @param {string} email The email to delete.
 */
async function deleteEmail(email) {
    statusMessage.textContent = `メールアドレス ${email} を削除中...`;
    try {
        const response = await fetch(`/api/emails/${email}`, {
            method: 'DELETE',
        });

        const result = await response.json();

        if (response.ok) {
            statusMessage.textContent = result.message;
        } else {
            throw new Error(result.error || '削除に失敗しました。');
        }
    } catch (error) {
        console.error('Email deletion error:', error);
        statusMessage.textContent = error.message;
    }
}

/**
 * Refreshes the email list in the UI.
 */
async function refreshEmailList() {
    try {
        const response = await fetch('/api/emails');
        if (!response.ok) {
            throw new Error('Could not fetch email list.');
        }
        const emails = await response.json();
        
        emailList.innerHTML = ''; // Clear previous list

        if (emails.length === 0) {
            const li = document.createElement('li');
            li.textContent = '登録されているメールアドレスはありません。';
            emailList.appendChild(li);
        } else {
            emails.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item.email;
                li.classList.add('email-list-item');

                const deleteButton = document.createElement('button');
                deleteButton.textContent = '削除';
                deleteButton.classList.add('delete-email-button');
                deleteButton.dataset.email = item.email;
                
                deleteButton.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    const emailToDelete = event.target.dataset.email;
                    await deleteEmail(emailToDelete);
                    await refreshEmailList(); // Re-fetch and re-render after deletion
                });
                
                li.appendChild(deleteButton);
                emailList.appendChild(li);
            });
        }
    } catch (error) {
        console.error('Failed to refresh email list:', error);
        statusMessage.textContent = 'メールリストの更新に失敗しました。';
    }
}

stockToggle.addEventListener('click', () => {
    currentDataType = 'stock';
    stockToggle.classList.add('active');
    usdJpyToggle.classList.remove('active');
    updateIntervalOptions(stockIntervalOptions, '1d'); // Update interval options
    updateTickerInputVisibility(); // Update visibility
    start(currentDataType);
});

usdJpyToggle.addEventListener('click', () => {
    currentDataType = 'usd_jpy';
    usdJpyToggle.classList.add('active');
    stockToggle.classList.remove('active');
    updateIntervalOptions(usdJpyIntervalOptions, '1d'); // Update interval options
    updateTickerInputVisibility(); // Update visibility
    start(currentDataType);
});

// --- Initial Load ---
// Ensure the correct toggle button is active and interval options are set on initial load
if (currentDataType === 'stock') {
    stockToggle.classList.add('active');
    updateIntervalOptions(stockIntervalOptions, '1d');
} else {
    usdJpyToggle.classList.add('active');
    updateIntervalOptions(usdJpyIntervalOptions, '1d');
}
updateTickerInputVisibility(); // Set initial visibility
start(currentDataType);
