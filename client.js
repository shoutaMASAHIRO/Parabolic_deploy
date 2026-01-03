import { createChart as createLightweightChart, LineStyle } from 'lightweight-charts';
import { BollingerBands, SMA, EMA } from 'technicalindicators';
import { io } from 'socket.io-client';

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
const bbStdDevInput = document.getElementById('bb-stddev');
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
const notificationElement = document.getElementById('cross-notification');

// --- Authentication DOM Elements ---
const userInfoSpan = document.getElementById('user-info');
const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');
const logoutButton = document.getElementById('logout-button');

// --- X Value DOM Elements ---
const xValueControls = document.getElementById('x-value-controls');
const currentXValueSpan = document.getElementById('current-x-value');
const xValueInput = document.getElementById('x-value-input');
const saveXValueButton = document.getElementById('save-x-value-button');

// --- Global State ---
let chartObjects = []; // holds all chart instances and their series for updates
let updateIntervalId = null;
let currentDataType = 'stock'; // 'stock' or 'usd_jpy'
let currentInterval = '1d';
let currentTickers = [];
let areBollingerBandsVisible = true;
let areEmaVisible = true;
let currentUserEmail = null;
let latestCrossPrices = {};
let latestEmaCrossPrices = {}; // New object to store EMA cross prices
let sendConditionThreshold = 0.5; // Default reset threshold for BB crosses
let usdJpyCurrentPrice = null; // Stores the latest USD/JPY price from server updates
let currentXValue = 0; // Initialize currentXValue

/**
 * Formats a numeric value to three decimal places.
 * @param {number} value The number to format.
 * @returns {string} The formatted number string.
 */
const formatValue = (value) => value.toFixed(3);

// --- Helper Function for Aggregating Candlestick Data ---
// IMPORTANT: This must be in global scope because it is used by multiple functions.
function aggregateCandleData(data, targetInterval) {
  if (!data || data.length === 0) return [];

  const aggregatedData = [];
  const intervalInHours = parseInt(targetInterval.replace('h', ''), 10);
  if (Number.isNaN(intervalInHours)) return data;

  let currentAggregatedCandle = null;
  let periodStartTime = null;

  for (const candle of data) {
    const candleTime = new Date(candle.time * 1000);
    const currentHour = candleTime.getUTCHours();
    const startOfPeriodHour = Math.floor(currentHour / intervalInHours) * intervalInHours;

    const startOfPeriodDate = new Date(candleTime);
    startOfPeriodDate.setUTCHours(startOfPeriodHour, 0, 0, 0);
    const newPeriodStartTime = startOfPeriodDate.getTime() / 1000;

    if (currentAggregatedCandle === null || newPeriodStartTime !== periodStartTime) {
      if (currentAggregatedCandle !== null) {
        aggregatedData.push(currentAggregatedCandle);
      }
      currentAggregatedCandle = {
        time: newPeriodStartTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      };
      periodStartTime = newPeriodStartTime;
    } else {
      currentAggregatedCandle.high = Math.max(currentAggregatedCandle.high, candle.high);
      currentAggregatedCandle.low = Math.min(currentAggregatedCandle.low, candle.low);
      currentAggregatedCandle.close = candle.close;
    }
  }

  if (currentAggregatedCandle !== null) {
    aggregatedData.push(currentAggregatedCandle);
  }
  return aggregatedData;
}

/**
 * Updates the content of an element to display the latest Bollinger Band values.
 * @param {HTMLElement} element The DOM element to update.
 * @param {Array} bb1 The result array from technicalindicators for 1-sigma BB.
 * @param {Array} bb2 The result array from technicalindicators for 2-sigma BB.
 */
function updateBbValues(element, bb1, bb2) {
  if (!element || !bb1 || !bb2 || bb1.length === 0 || bb2.length === 0) {
    if (element) element.innerHTML = '';
    return;
  }

  const latestBb1 = bb1[bb1.length - 1];
  const latestBb2 = bb2[bb2.length - 1];

      element.innerHTML = `
          <div class="indicator-item"><span>+2σ</span><span>${formatValue(latestBb2.upper)}</span></div>
          <div class="indicator-item"><span>+1σ</span><span>${formatValue(latestBb1.upper)}</span></div>
          <div class="indicator-item"><span>0σ</span><span>${formatValue(latestBb1.middle)}</span></div>
          <div class="indicator-item"><span>-1σ</span><span>${formatValue(latestBb1.lower)}</span></div>
          <div class="indicator-item"><span>-2σ</span><span>${formatValue(latestBb2.lower)}</span></div>
      `;}

/**
 * Updates the content of an element to display the latest EMA values.
 * @param {HTMLElement} element The DOM element to update.
 * @param {Array<Array<{time: number, value: number}>>} emaDataArray Array of EMA data series.
 * @param {Array<{period: number, color: string}>} emaPeriods Array of EMA period configurations.
 */
function updateEmaValues(element, emaDataArray, emaPeriods) {
  if (!element || !emaDataArray || emaDataArray.some((arr) => arr.length === 0)) {
    if (element) element.innerHTML = '';
    return;
  }

  const latestEmaValues = emaDataArray.map((emaData) => emaData[emaData.length - 1].value);

      element.innerHTML = `
          <div class="indicator-item"><span>EMA(${emaPeriods[0].period})</span><span>${formatValue(latestEmaValues[0])}</span></div>
          <div class="indicator-item"><span>EMA(${emaPeriods[1].period})</span><span>${formatValue(latestEmaValues[1])}</span></div>
          <div class="indicator-item"><span>EMA(${emaPeriods[2].period})</span><span>${formatValue(latestEmaValues[2])}</span></div>
      `;}

/**
 * Updates the content of an element to display the current price and change.
 * @param {HTMLElement} element The DOM element to update.
 * @param {Array<{close: number}>} data The chart data array.
 */
function updateCurrentPriceValue(element, data) {
  if (!element || !data || data.length === 0) {
    if (element) element.innerHTML = '';
    return;
  }

  const latestData = data[data.length - 1];
  const currentPrice = latestData.close;
  const previousPrice = data.length > 1 ? data[data.length - 2].close : currentPrice;
  const change = currentPrice - previousPrice;
  const changePercent = (change / previousPrice) * 100;
  const colorClass = change >= 0 ? 'price-up' : 'price-down';

  element.innerHTML = `
        <span class="price-large ${colorClass}">${formatValue(currentPrice)}</span>
        <span class="${colorClass}">${change >= 0 ? '+' : ''}${change.toFixed(2)}</span>
        <span class="${colorClass}">(${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)</span>
    `;
}

/**
 * Renders the display for the history of BB cross prices.
 * @param {HTMLElement} element The DOM element to update.
 * @param {object} crossPrices An object holding the latest cross price for each band.
 */
function updateCrossHistoryDisplay(element, crossPrices) {
    let content = '<div class="indicator-group-title">BBクロス履歴</div>';
    const bands = ['upper2', 'upper1', 'middle', 'lower1', 'lower2'];
    const bandLabels = {
        'upper2': '+2σ', 'upper1': '+1σ', 'middle': '0σ',
        'lower1': '-1σ', 'lower2': '-2σ'
    };

    if (Object.keys(crossPrices).length === 0) {
        content += '<div class="indicator-item"><span>クロス待機中...</span></div>';
    } else {
        content += '<div class="cross-item-container">';
        for (const band of bands) {
            const price = crossPrices[band] ? formatValue(crossPrices[band]) : '---';
            content += `
                <div class="indicator-item">
                    <span>${bandLabels[band]}</span>
                    <span>${price}</span>
                </div>
            `;
        }
        content += '</div>';
    }
    element.innerHTML = content;
}

/**
 * Renders the display for the history of EMA cross prices.
 * @param {HTMLElement} element The DOM element to update.
 * @param {object} crossPrices An object holding the latest cross price for each EMA.
 */
function updateEmaCrossHistoryDisplay(element, crossPrices) {
    let content = '<div class="indicator-group-title">EMAクロス履歴</div>';
    const emas = ['ema10', 'ema25', 'ema50'];
    const emaLabels = {
        'ema10': 'EMA(10)', 'ema25': 'EMA(25)', 'ema50': 'EMA(50)'
    };

    if (Object.keys(crossPrices).length === 0) {
        content += '<div class="indicator-item"><span>クロス待機中...</span></div>';
    } else {
        content += '<div class="cross-item-container">';
        for (const ema of emas) {
            const price = crossPrices[ema] ? formatValue(crossPrices[ema]) : '---';
            content += `
                <div class="indicator-item">
                    <span>${emaLabels[ema]}</span>
                    <span>${price}</span>
                </div>
            `;
        }
        content += '</div>';
    }
    element.innerHTML = content;
}

/**
 * Checks if the current USD/JPY price has moved beyond the reset threshold
 * from any recorded BB cross price and resets them if so.
 */
function checkAndResetCrossPrices() {
    if (usdJpyCurrentPrice === null) return; // No current price to compare against

    let updatedBb = false;
    const bbBands = ['upper2', 'upper1', 'middle', 'lower1', 'lower2'];
    for (const band of bbBands) {
        if (latestCrossPrices[band] !== null && latestCrossPrices[band] !== undefined) {
            if (Math.abs(usdJpyCurrentPrice - latestCrossPrices[band]) >= sendConditionThreshold) {
                console.log(`Resetting ${band} BB cross price. Current: ${usdJpyCurrentPrice}, Cross: ${latestCrossPrices[band]}, Threshold: ${sendConditionThreshold}`);
                latestCrossPrices[band] = null;
                updatedBb = true;
            }
        }
    }

    if (updatedBb) {
        const usdJpyChartObj = chartObjects.find(obj => obj.ticker === 'USDJPY=X');
        if (usdJpyChartObj && usdJpyChartObj.crossHistoryElement) {
            updateCrossHistoryDisplay(usdJpyChartObj.crossHistoryElement, latestCrossPrices);
        }
    }

    let updatedEma = false;
    const emaBands = ['ema10', 'ema25', 'ema50'];
    for (const ema of emaBands) {
        if (latestEmaCrossPrices[ema] !== null && latestEmaCrossPrices[ema] !== undefined) {
            if (Math.abs(usdJpyCurrentPrice - latestEmaCrossPrices[ema]) >= sendConditionThreshold) {
                console.log(`Resetting ${ema} EMA cross price. Current: ${usdJpyCurrentPrice}, Cross: ${latestEmaCrossPrices[ema]}, Threshold: ${sendConditionThreshold}`);
                latestEmaCrossPrices[ema] = null;
                updatedEma = true;
            }
        }
    }

    if (updatedEma) {
        const usdJpyChartObj = chartObjects.find(obj => obj.ticker === 'USDJPY=X');
        if (usdJpyChartObj && usdJpyChartObj.emaCrossHistoryElement) {
            updateEmaCrossHistoryDisplay(usdJpyChartObj.emaCrossHistoryElement, latestEmaCrossPrices);
        }
    }
}

/**
 * Refreshes data for all active charts and updates their series.
 */
async function refreshChartData() {
  statusMessage.textContent = `更新中: ${currentDataType === 'stock' ? currentTickers.join(', ') : 'USD/JPY'} (${currentInterval}) - データ取得中...`;

  for (const chartObj of chartObjects) {
    if (!chartObj) continue;

    let data;
    try {
      if (currentDataType === 'stock') {
        data = await fetchStockData(chartObj.ticker, currentInterval);
      } else {
        data = await fetchUsdJpyData(chartObj.interval);
      }

      // Update current price display (before aggregation)
      updateCurrentPriceValue(chartObj.currentPriceValuesElement, data);

      if (!data || data.length < 20) {
        console.warn(`Not enough data to update indicators for ${chartObj.ticker}.`);
        continue;
      }

      if (currentInterval === '4h' || currentInterval === '8h') {
        data = aggregateCandleData(data, currentInterval);
      }

      if (!data || data.length < 20) {
        console.warn(`Not enough aggregated data to update indicators for ${chartObj.ticker}.`);
        continue;
      }

      const closePrices = data.map((d) => d.close);

      // Bollinger Bands
      const bbPeriod = parseInt(bbPeriodInput.value, 10) || 20;
      const bbInput1 = { period: bbPeriod, values: closePrices, stdDev: 1 };
      const bbInput2 = { period: bbPeriod, values: closePrices, stdDev: 2 };

      const bb1 = BollingerBands.calculate(bbInput1);
      const bb2 = BollingerBands.calculate(bbInput2);

      // Update BB values display
      updateBbValues(chartObj.bbValuesElement, bb1, bb2);

      // EMAs
      const emaPeriods = [
        { period: parseInt(ema1PeriodInput.value, 10) || 10, color: 'yellow' },
        { period: parseInt(ema2PeriodInput.value, 10) || 25, color: 'yellow' },
        { period: parseInt(ema3PeriodInput.value, 10) || 50, color: 'yellow' },
      ];

      const emaDataArray = emaPeriods.map(({ period }) => {
        const emaInput = { period, values: closePrices, exact: false };
        const ema = EMA.calculate(emaInput);
        const emaOffset = data.length - ema.length;
        return ema.map((d, i) => ({ time: data[i + emaOffset].time, value: d }));
      });

      // Update EMA values display
      updateEmaValues(chartObj.emaValuesElement, emaDataArray, emaPeriods);

      // Align BB with candles
      const dataOffset = data.length - bb1.length;
      const middleBandData = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.middle }));
      const upperBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
      const lowerBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));
      const upperBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
      const lowerBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));

      // Update series
      chartObj.candleSeries.setData(data);
      chartObj.middleBandSeries.setData(middleBandData);
      chartObj.upperBand1Series.setData(upperBand1Data);
      chartObj.lowerBand1Series.setData(lowerBand1Data);
      chartObj.upperBand2Series.setData(upperBand2Data);
      chartObj.lowerBand2Series.setData(lowerBand2Data);

      if (chartObj.emaSeriesArray && chartObj.emaSeriesArray.length > 0) {
        chartObj.emaSeriesArray.forEach((emaSeries, index) => {
          emaSeries.setData(emaDataArray[index]);
        });
      }
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
  { value: '4h', text: '4時間' },
  { value: '8h', text: '8時間' },
  { value: '1d', text: '日足' },
  { value: '1wk', text: '1週間' },
];

const usdJpyIntervalOptions = [
  { value: '5m', text: '5分' },
  { value: '15m', text: '15分' },
  { value: '30m', text: '30分' },
  { value: '1h', text: '1時間' },
  { value: '4h', text: '4時間' },
  { value: '8h', text: '8時間' },
  { value: '1d', text: '日足' },
  { value: '1wk', text: '1週間' },
];

function updateIntervalOptions(options, defaultValue) {
  intervalSelect.innerHTML = '';
  options.forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.text;
    intervalSelect.appendChild(opt);
  });
  intervalSelect.value = options.some((opt) => opt.value === defaultValue) ? defaultValue : options[0].value;
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

function createChart(container, options = {}) {
  const chart = createLightweightChart(container, {
    ...chartLayoutOptions,
    ...options,
    width: container.clientWidth,
    height: container.clientHeight,
  });
  return chart;
}

function updateTickerInputVisibility() {
  if (currentDataType === 'usd_jpy') {
    tickersInputGroup.style.display = 'none';
  } else {
    tickersInputGroup.style.display = 'flex';
  }
}

function toggleBollingerBandsVisibility() {
  areBollingerBandsVisible = !areBollingerBandsVisible;
  toggleBbButton.textContent = areBollingerBandsVisible ? 'BB非表示' : 'BB表示';
  start(currentDataType);
}

function toggleEmaVisibility() {
  areEmaVisible = !areEmaVisible;
  toggleEmaButton.textContent = areEmaVisible ? 'EMA非表示' : 'EMA表示';
  start(currentDataType);
}

async function fetchStockData(ticker, interval) {
  const apiUrl = `${window.location.protocol}//${window.location.host}/api/data?ticker=${ticker}&interval=${interval}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data
    .filter((d) => d.date && d.open && d.high && d.low && d.close)
    .map((d) => ({
      time: new Date(d.date).getTime() / 1000,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }))
    .sort((a, b) => a.time - b.time);
}

async function fetchUsdJpyData(interval) {
  const apiUrl = `${window.location.protocol}//${window.location.host}/api/usd_jpy_data?interval=${interval}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data
    .filter((d) => d.date && d.open && d.high && d.low && d.close)
    .map((d) => ({
      time: new Date(d.date).getTime() / 1000,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }))
    .sort((a, b) => a.time - b.time);
}

async function renderChartForTicker(ticker, interval) {
  const sanitizedTicker = ticker.replace(/\./g, '');

  const wrapper = document.createElement('div');
  wrapper.className = 'chart-wrapper';
  wrapper.innerHTML = `
        <h2 class="chart-title">${ticker}</h2>
        <div class="chart-container" id="ohlc-${sanitizedTicker}"></div>
        <div class="current-price-values" id="current-price-${sanitizedTicker}"></div>
        <div class="bb-values" id="bb-values-${sanitizedTicker}"></div>
        <div class="ema-values" id="ema-values-${sanitizedTicker}"></div>
        <div class="cross-history" id="cross-history-${sanitizedTicker}"></div>
    `;
  chartsContainer.appendChild(wrapper);

  let data;
  try {
    data = await fetchStockData(ticker, interval);
    if (interval === '4h' || interval === '8h') {
      data = aggregateCandleData(data, interval);
    }
    if (!data || data.length < 20) {
      throw new Error('Not enough data to calculate indicators.');
    }
  } catch (error) {
    wrapper.querySelector(`#ohlc-${sanitizedTicker}`).innerText = `Error loading data for ${ticker}: ${error.message}`;
    return null;
  }

  // Update current price display
  const currentPriceValuesElement = wrapper.querySelector(`#current-price-${sanitizedTicker}`);
  updateCurrentPriceValue(currentPriceValuesElement, data);

  const closePrices = data.map((d) => d.close);

  const bbPeriod = parseInt(bbPeriodInput.value, 10) || 20;
  const bbInput1 = { period: bbPeriod, values: closePrices, stdDev: 1 };
  const bbInput2 = { period: bbPeriod, values: closePrices, stdDev: 2 };

  const bb1 = BollingerBands.calculate(bbInput1);
  const bb2 = BollingerBands.calculate(bbInput2);

  // Update BB values display
  const bbValuesElement = wrapper.querySelector(`#bb-values-${sanitizedTicker}`);
  updateBbValues(bbValuesElement, bb1, bb2);

  const emaPeriods = [
    { period: parseInt(ema1PeriodInput.value, 10) || 10, color: 'yellow' },
    { period: parseInt(ema2PeriodInput.value, 10) || 25, color: 'yellow' },
    { period: parseInt(ema3PeriodInput.value, 10) || 50, color: 'yellow' },
  ];

  const emaDataArray = emaPeriods.map(({ period }) => {
    const emaInput = { period, values: closePrices, exact: false };
    const ema = EMA.calculate(emaInput);
    const emaOffset = data.length - ema.length;
    return ema.map((d, i) => ({ time: data[i + emaOffset].time, value: d }));
  });

  // Update EMA values display
  const emaValuesElement = wrapper.querySelector(`#ema-values-${sanitizedTicker}`);
  updateEmaValues(emaValuesElement, emaDataArray, emaPeriods);

  const dataOffset = data.length - bb1.length;
  const middleBandData = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.middle }));
  const upperBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
  const lowerBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));
  const upperBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
  const lowerBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));

  const ohlcChart = createChart(wrapper.querySelector(`#ohlc-${sanitizedTicker}`));

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

  const emaSeriesArray = emaPeriods.map((emaConfig, index) => {
    const emaSeries = ohlcChart.addLineSeries({
      color: emaConfig.color,
      lineWidth: 1,
      title: `EMA ${emaConfig.period}`,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: areEmaVisible,
    });
    emaSeries.setData(emaDataArray[index]);
    return emaSeries;
  });

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
            currentPriceValuesElement,
            bbValuesElement,
            emaValuesElement,
            // Add a placeholder for crossHistoryElement for consistency, even if not used for stocks
            crossHistoryElement: wrapper.querySelector(`#cross-history-${sanitizedTicker}`),
            candleSeries,
            middleBandSeries,    upperBand1Series,
    lowerBand1Series,
    upperBand2Series,
    lowerBand2Series,
    emaSeriesArray,
    ticker,
    interval,
  };
}

async function renderChartsForStocks(tickers, interval) {
  const renderedCharts = await Promise.all(tickers.map((ticker) => renderChartForTicker(ticker, interval)));
  chartObjects.push(...renderedCharts.filter(Boolean));
}

async function renderChartForUsdJpy(interval) {
  const defaultInterval = '1d';
  let actualInterval = interval;
  let dataFetchAttempted = 0;

  while (dataFetchAttempted < 2) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-wrapper';
    wrapper.innerHTML = `
            <h2 class="chart-title">USD/JPY</h2>
            <div class="chart-container" id="usd-jpy-chart"></div>
            <div class="current-price-values" id="current-price-usdjpy"></div>
            <div class="bb-values" id="bb-values-usdjpy"></div>
            <div class="ema-values" id="ema-values-usdjpy"></div>
            <div class="cross-history" id="cross-history-usdjpy"></div>
            <div class="cross-history" id="ema-cross-history-usdjpy"></div>
            <div class="cross-reset-settings">
                <span id="current-send-condition-threshold-display">現在の送信条件: --</span>
                <label for="cross-reset-threshold-input">送信条件 (±円):</label>
                <input type="number" id="cross-reset-threshold-input" step="0.001" min="0.01">
                <button id="apply-cross-reset-button">適用</button>
            </div>
        `;
    chartsContainer.appendChild(wrapper);

    let data;
    let errorMessage = '';
    try {
      data = await fetchUsdJpyData(actualInterval);
      if (!data || data.length < 20) {
        throw new Error(`Not enough data to calculate indicators for USD/JPY with interval ${actualInterval}.`);
      }
    } catch (error) {
      errorMessage = `Error loading USD/JPY data for interval '${actualInterval}': ${error.message}`;
      console.error(errorMessage);

      if (actualInterval !== defaultInterval && dataFetchAttempted === 0) {
        wrapper.querySelector(`#usd-jpy-chart`).innerText = `${errorMessage} 日足で再試行します...`;
        actualInterval = defaultInterval;
        dataFetchAttempted++;
        chartsContainer.innerHTML = '';
        continue;
      } else {
        wrapper.querySelector(`#usd-jpy-chart`).innerText = `${errorMessage} 日足データも取得できませんでした。`;
        return null;
      }
    } // ★ここが欠けてた閉じカッコ。構文エラー原因

    // Update current price display
    const currentPriceValuesElement = wrapper.querySelector('#current-price-usdjpy');
    updateCurrentPriceValue(currentPriceValuesElement, data);

    if (actualInterval === '4h' || actualInterval === '8h') {
      data = aggregateCandleData(data, actualInterval);
    }
    if (!data || data.length < 20) {
      wrapper.querySelector(`#usd-jpy-chart`).innerText = `エラー: ドル円の '${actualInterval}' インターバルで十分なデータがありません。`;
      return null;
    }

    const closePrices = data.map((d) => d.close);

    const bbPeriod = parseInt(bbPeriodInput.value, 10) || 20;
    const bbInput1 = { period: bbPeriod, values: closePrices, stdDev: 1 };
    const bbInput2 = { period: bbPeriod, values: closePrices, stdDev: 2 };

    const bb1 = BollingerBands.calculate(bbInput1);
    const bb2 = BollingerBands.calculate(bbInput2);

    // Update BB values display
    const bbValuesElement = wrapper.querySelector('#bb-values-usdjpy');
    updateBbValues(bbValuesElement, bb1, bb2);

    const emaPeriods = [
      { period: parseInt(ema1PeriodInput.value, 10) || 10, color: 'yellow' },
      { period: parseInt(ema2PeriodInput.value, 10) || 25, color: 'yellow' },
      { period: parseInt(ema3PeriodInput.value, 10) || 50, color: 'yellow' },
    ];

    const emaDataArray = emaPeriods.map(({ period }) => {
      const emaInput = { period, values: closePrices, exact: false };
      const ema = EMA.calculate(emaInput);
      const emaOffset = data.length - ema.length;
      return ema.map((d, i) => ({ time: data[i + emaOffset].time, value: d }));
    });

            // Update EMA values display
            const emaValuesElement = wrapper.querySelector('#ema-values-usdjpy');
            updateEmaValues(emaValuesElement, emaDataArray, emaPeriods);
    
            // Update cross history display
            const crossHistoryElement = wrapper.querySelector('#cross-history-usdjpy');
            updateCrossHistoryDisplay(crossHistoryElement, latestCrossPrices);

            // Update EMA cross history display
            const emaCrossHistoryElement = wrapper.querySelector('#ema-cross-history-usdjpy');
            updateEmaCrossHistoryDisplay(emaCrossHistoryElement, latestEmaCrossPrices);
    const dataOffset = data.length - bb1.length;
    const middleBandData = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.middle }));
    const upperBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
    const lowerBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));
    const upperBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
    const lowerBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));

    const usdJpyChart = createChart(wrapper.querySelector(`#usd-jpy-chart`));

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

    const emaSeriesArray = emaPeriods.map((emaConfig, index) => {
      const emaSeries = usdJpyChart.addLineSeries({
        color: emaConfig.color,
        lineWidth: 1,
        title: `EMA ${emaConfig.period}`,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        visible: areEmaVisible,
      });
      emaSeries.setData(emaDataArray[index]);
      return emaSeries;
    });

    const candleSeries = usdJpyChart.addCandlestickSeries({
      upColor: '#ff4c4c',
      downColor: '#4c6aff',
      borderVisible: false,
      wickUpColor: '#ff4c4c',
      wickDownColor: '#4c6aff',
    });
    candleSeries.setData(data);

    usdJpyChart.timeScale().fitContent();

    const currentSendConditionThresholdDisplay = wrapper.querySelector('#current-send-condition-threshold-display');
    if (currentSendConditionThresholdDisplay) {
        currentSendConditionThresholdDisplay.textContent = `現在の送信条件: ${sendConditionThreshold.toFixed(3)}`;
    }

    // Moved from DOMContentLoaded: Setup for cross-reset-threshold
    const crossResetThresholdInput = wrapper.querySelector('#cross-reset-threshold-input');
    const applyCrossResetButton = wrapper.querySelector('#apply-cross-reset-button');

    if (crossResetThresholdInput) {
        crossResetThresholdInput.value = sendConditionThreshold.toFixed(3); // Set initial value for input field
    }

    if (applyCrossResetButton) {
        applyCrossResetButton.addEventListener('click', async () => {
            if (crossResetThresholdInput) {
                sendConditionThreshold = parseFloat(crossResetThresholdInput.value);
                console.log('BB Reset Threshold updated to:', sendConditionThreshold);
                checkAndResetCrossPrices(); // Re-check immediately with new threshold
                saveUserSettings(); // Persist the new threshold

                // Set xValueInput and then save it as x_value (existing logic)
                xValueInput.value = sendConditionThreshold;
                await saveUserXValue(); // Call the function to save it as x_value

                if (currentSendConditionThresholdDisplay) {
                    currentSendConditionThresholdDisplay.textContent = `現在の送信条件: ${sendConditionThreshold.toFixed(3)}`;
                }
                // Update the input field to reflect the newly applied value
                crossResetThresholdInput.value = sendConditionThreshold.toFixed(3);
            }
        });
    }

    return {
      chart: usdJpyChart,
      container: wrapper.querySelector(`#usd-jpy-chart`),
      currentPriceValuesElement,
      bbValuesElement,
      emaValuesElement,
      crossHistoryElement,
      emaCrossHistoryElement, // Add emaCrossHistoryElement here
      candleSeries,
      middleBandSeries,
      upperBand1Series,
      lowerBand1Series,
      upperBand2Series,
      lowerBand2Series,
      emaSeriesArray,
      ticker: 'USDJPY=X',
      interval: actualInterval,
    };
  }

  return null;
}

/**
 * Main function to start/update the charting process.
 * @param {string} dataType The type of data to display ('stock' or 'usd_jpy').
 */
async function start(dataType) {
  console.log('start function called with dataType:', dataType);

  if (updateIntervalId) {
    clearInterval(updateIntervalId);
  }

          chartsContainer.innerHTML = '';
          chartObjects = [];
          latestCrossPrices = {};
          usdJpyCurrentPrice = null; // Reset current price on chart start
          statusMessage.textContent = 'チャートを読み込んでいます...';  currentDataType = dataType;

  if (dataType === 'stock') {
    currentTickers = tickersInput.value.split(',').map((t) => t.trim()).filter((t) => t);
    currentInterval = intervalSelect.value;

    const formattedTickers = currentTickers.map((c) => (c.endsWith('.T') ? c : `${c}.T`));

    await renderChartsForStocks(formattedTickers, currentInterval);
    statusMessage.textContent = `表示中: ${formattedTickers.join(', ')} (${currentInterval}) - 60秒ごとに更新`;
    updateIntervalId = setInterval(refreshChartData, 60 * 1000);
  } else if (dataType === 'usd_jpy') {
    currentTickers = ['USDJPY=X'];
    currentInterval = intervalSelect.value;

    const usdJpyChartObj = await renderChartForUsdJpy(currentInterval);
    if (usdJpyChartObj) {
      chartObjects.push(usdJpyChartObj);
    }

    statusMessage.textContent = `表示中: USD/JPY (${currentInterval}) - 60秒ごとに更新`;
    updateIntervalId = setInterval(refreshChartData, 60 * 1000);
  }
}

// --- Event Listeners ---
window.addEventListener('resize', () => {
  chartObjects.forEach((obj) => {
    if (!obj) return;
    const { container, chart } = obj;
    chart.resize(container.clientWidth, container.clientHeight);
  });
});

startButton.addEventListener('click', () => {
  start(currentDataType);
  saveUserSettings();
});

toggleBbButton.addEventListener('click', () => {
  toggleBollingerBandsVisibility();
  saveUserSettings();
});

toggleEmaButton.addEventListener('click', () => {
  toggleEmaVisibility();
  saveUserSettings();
});

// ★削除: applyIndicatorsButton のリスナーは下に「sendBbSettingsToServer()」付きの方を1つだけ残す
// applyIndicatorsButton.addEventListener('click', () => {
//     start(currentDataType);
//     indicatorSettings.classList.add('hidden');
//     saveUserSettings();
// });

intervalSelect.addEventListener('change', () => {
  currentInterval = intervalSelect.value;
  saveUserSettings();
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();

    if (response.ok) {
      statusMessage.textContent = result.message;
      emailInput.value = '';
      await refreshEmailList(); // Refresh the list, which will also update the button
      setTimeout(() => {
        subscribeSettings.classList.add('hidden');
      }, 1500);
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
    await refreshEmailList();
    emailListPanel.classList.remove('hidden');
  } else {
    emailListPanel.classList.add('hidden');
  }
});

async function deleteEmail(email) {
  statusMessage.textContent = `メールアドレス ${email} を削除中...`;
  try {
    const response = await fetch(`/api/emails/${email}`, { method: 'DELETE' });
    const result = await response.json();
    if (response.ok) {
      statusMessage.textContent = result.message;
      await refreshEmailList(); // Also updates button visibility
    } else {
      throw new Error(result.error || '削除に失敗しました。');
    }
  } catch (error) {
    console.error('Email deletion error:', error);
    statusMessage.textContent = error.message;
  }
}

async function refreshEmailList() {
  try {
    const response = await fetch('/api/emails');
    if (!response.ok) throw new Error('Could not fetch email list.');
    const emails = await response.json();

    emailList.innerHTML = '';

    if (emails.length === 0) {
      const li = document.createElement('li');
      li.textContent = '登録されているメールアドレスはありません。';
      emailList.appendChild(li);
    } else {
      emails.forEach((item) => {
        const li = document.createElement('li');

        const emailSpan = document.createElement('span');
        emailSpan.textContent = item.email;
        li.appendChild(emailSpan);

        li.classList.add('email-list-item');

        const buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('email-item-buttons');

        // Add condition settings button if the email matches the current user
        if (currentUserEmail && item.email === currentUserEmail) {
          const settingsButton = document.createElement('button');
          settingsButton.textContent = '条件設定';
          settingsButton.classList.add('condition-settings-button'); // Add a class for styling
          // Add event listener for settings button if needed
          // settingsButton.addEventListener('click', () => { ... });
          buttonsContainer.appendChild(settingsButton);

          const deleteButton = document.createElement('button');
          deleteButton.textContent = '削除';
          deleteButton.classList.add('delete-email-button');
          deleteButton.dataset.email = item.email;

          deleteButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            const emailToDelete = event.target.dataset.email;
            await deleteEmail(emailToDelete);
          });

          buttonsContainer.appendChild(deleteButton);
        }
        li.appendChild(buttonsContainer);
        emailList.appendChild(li);
      });
    }
  } catch (error) {
    console.error('Failed to refresh email list:', error);
    statusMessage.textContent = 'メールリストの更新に失敗しました。';
  }
}

const sendEmailButton = document.getElementById('send-email-button');

async function sendCrossNotificationEmail() {
  statusMessage.textContent = 'メールを送信しています...';
  try {
    const response = await fetch('/api/send-emails', { method: 'POST' });
    const result = await response.json();
    if (response.ok) {
      statusMessage.textContent = result.message;
    } else {
      throw new Error(result.error || 'メールの送信に失敗しました。');
    }
  } catch (error) {
    statusMessage.textContent = error.message;
  }
}

sendEmailButton.addEventListener('click', sendCrossNotificationEmail);

stockToggle.addEventListener('click', () => {
  currentDataType = 'stock';
  stockToggle.classList.add('active');
  usdJpyToggle.classList.remove('active');
  updateIntervalOptions(stockIntervalOptions, '1d');
  updateTickerInputVisibility();
  start(currentDataType);
  saveUserSettings();
});

usdJpyToggle.addEventListener('click', () => {
  currentDataType = 'usd_jpy';
  usdJpyToggle.classList.add('active');
  stockToggle.classList.remove('active');
  updateIntervalOptions(usdJpyIntervalOptions, '1d');
  updateTickerInputVisibility();
  start(currentDataType);
  saveUserSettings();
});

// --- User Settings Functions ---
async function saveUserSettings() {
      const settings = {
          currentDataType,
          currentInterval: intervalSelect.value,
          tickersInput: tickersInput.value,
          areBollingerBandsVisible,
          areEmaVisible,
          bbPeriod: bbPeriodInput.value,
          bbStdDev: bbStdDevInput.value,
          ema1Period: ema1PeriodInput.value,
          ema2Period: ema2PeriodInput.value,
          ema3Period: ema3PeriodInput.value,
          sendConditionThreshold: sendConditionThreshold, // Add this line
      };
  try {
    const response = await fetch('/api/user/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) console.error('Failed to save user settings.');
  } catch (error) {
    console.error('Network error saving user settings:', error);
  }
}

async function loadUserSettings() {
  try {
    const response = await fetch('/api/user/settings');
    if (response.ok) {
      const settings = await response.json();
      if (Object.keys(settings).length > 0) {
        currentDataType = settings.currentDataType || 'stock';
        intervalSelect.value = settings.currentInterval || '1d';
        tickersInput.value = settings.tickersInput || '7203';
        areBollingerBandsVisible = settings.areBollingerBandsVisible !== undefined ? settings.areBollingerBandsVisible : true;
        areEmaVisible = settings.areEmaVisible !== undefined ? settings.areEmaVisible : true;
        bbPeriodInput.value = settings.bbPeriod || '20';
        bbStdDevInput.value = settings.bbStdDev || '2';
        ema1PeriodInput.value = settings.ema1Period || '10';
        ema2PeriodInput.value = settings.ema2Period || '25';
        ema3PeriodInput.value = settings.ema3Period || '50';
        sendConditionThreshold = settings.sendConditionThreshold !== undefined ? settings.sendConditionThreshold : 0.5; // Load sendConditionThreshold

        // Update the input field with the loaded value
        const crossResetThresholdInput = document.getElementById('cross-reset-threshold-input');
        if (crossResetThresholdInput) {
            crossResetThresholdInput.value = sendConditionThreshold.toFixed(3);
        }
        checkAndResetCrossPrices(); // Apply the loaded threshold immediately

        if (currentDataType === 'stock') {
          stockToggle.classList.add('active');
          usdJpyToggle.classList.remove('active');
          updateIntervalOptions(stockIntervalOptions, intervalSelect.value);
        } else {
          usdJpyToggle.classList.add('active');
          stockToggle.classList.remove('active');
          updateIntervalOptions(usdJpyIntervalOptions, intervalSelect.value);
        }
        updateTickerInputVisibility();
        toggleBbButton.textContent = areBollingerBandsVisible ? 'BB非表示' : 'BB表示';
        toggleEmaButton.textContent = areEmaVisible ? 'EMA非表示' : 'EMA表示';

        start(currentDataType);
      } else {
        start(currentDataType);
      }
    } else {
      console.error('Failed to load user settings.');
      start(currentDataType);
    }
  } catch (error) {
    console.error('Network error loading user settings:', error);
    start(currentDataType);
  }
}

// --- Authentication Functions ---
async function fetchUserXValue() {
  try {
    const response = await fetch('/api/user/x_value');
    if (response.ok) {
      const data = await response.json();
      currentXValue = parseFloat(data.x_value); // Parse as float
      currentXValueSpan.textContent = `現在のX値: ${currentXValue.toFixed(3)}`; // Format for display
      xValueInput.value = currentXValue.toFixed(3); // Format for input field
      xValueControls.classList.remove('hidden');
    } else {
      console.error('Failed to fetch user x_value.');
      xValueControls.classList.add('hidden');
    }
  } catch (error) {
    console.error('Network error fetching user x_value:', error);
    xValueControls.classList.add('hidden');
  }
}

async function saveUserXValue() {
  const newXValue = parseFloat(xValueInput.value); // Use parseFloat
  if (isNaN(newXValue)) {
    alert('有効な数値を入力してください。');
    return;
  }
  console.log('Attempting to save x_value:', newXValue); // Log the value being sent

  try {
    const response = await fetch('/api/user/x_value', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x_value: newXValue }),
    });
    console.log('Response status from /api/user/x_value:', response.status); // Log the response status
    if (response.ok) {
      const data = await response.json();
      currentXValue = parseFloat(data.x_value); // Parse as float
      currentXValueSpan.textContent = `現在のX値: ${currentXValue.toFixed(3)}`; // Format for display
      // alert('X値が保存されました！'); // Removed as per user request
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Error saving x_value:', errorData.error);
      // alert('X値の保存に失敗しました。'); // Removed as per user request
    }
  } catch (error) {
    console.error('Network error saving user x_value:', error);
    // alert('ネットワークエラーが発生しました。'); // Removed as per user request
  }
}

async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/me');
    if (response.ok) {
      const data = await response.json();
      userInfoSpan.textContent = `ようこそ、${data.user.username}さん！`;
      currentUserEmail = data.user.email; // Store user's email
      userInfoSpan.classList.remove('hidden');
      loginButton.classList.add('hidden');
      registerButton.classList.add('hidden');
      logoutButton.classList.remove('hidden');

      fetchUserXValue(); // Fetch and display x_value
      loadUserSettings();
    } else {
      currentUserEmail = null; // Clear email on failed auth
      userInfoSpan.classList.add('hidden');
      loginButton.classList.remove('hidden');
      registerButton.classList.remove('hidden');
      logoutButton.classList.add('hidden');
      xValueControls.classList.add('hidden'); // Hide x_value controls
      start(currentDataType);
    }
  } catch (error) {
    currentUserEmail = null; // Clear email on error
    console.error('Failed to check authentication status:', error);
    userInfoSpan.classList.add('hidden');
    loginButton.classList.remove('hidden');
    registerButton.classList.remove('hidden');
    logoutButton.classList.add('hidden');
    xValueControls.classList.add('hidden'); // Hide x_value controls
    start(currentDataType);
  }
}

async function handleLogout() {
  try {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    const data = await response.json();
    if (response.ok) {
      alert(data.message || 'ログアウトしました。');
      currentUserEmail = null; // Clear email on logout
      xValueControls.classList.add('hidden'); // Hide x_value controls
      await checkAuthStatus(); // Re-check status, which will hide the button
    } else {
      alert(data.error || 'ログアウトに失敗しました。');
    }
  } catch (error) {
    console.error('Network error during logout:', error);
    alert('ネットワークエラーが発生しました。ログアウトできませんでした。');
  }
}

logoutButton.addEventListener('click', handleLogout);
saveXValueButton.addEventListener('click', saveUserXValue); // Add event listener for save x_value button

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
  if (currentDataType === 'stock') {
    stockToggle.classList.add('active');
    updateIntervalOptions(stockIntervalOptions, '1d');
  } else {
    usdJpyToggle.classList.add('active');
    updateIntervalOptions(usdJpyIntervalOptions, '1d');
  }
  updateTickerInputVisibility();
  checkAuthStatus();

  socket = io(`${window.location.protocol}//${window.location.hostname}:3000`);

  socket.on('connect', () => {
    console.log('Connected to WebSocket server!');
    // Send initial BB settings to the server once connected
    sendBbSettingsToServer();
  });

      socket.on('bb_cross', async (data) => {
          console.log('BB Cross event received:', data);
          notificationElement.textContent = data.message; // Use the message directly from server
          notificationElement.classList.remove('hidden');
  
          // Update cross price history
          latestCrossPrices[data.bandName] = data.price;
  
          // Find the USD/JPY chart object and update its display
          const usdJpyChartObj = chartObjects.find(obj => obj.ticker === 'USDJPY=X');
          if (usdJpyChartObj && usdJpyChartObj.crossHistoryElement) {
              updateCrossHistoryDisplay(usdJpyChartObj.crossHistoryElement, latestCrossPrices);
          }
  
          // Hide the notification after a few seconds
          setTimeout(() => {
              notificationElement.classList.add('hidden');
          }, 5000); // Hide after 5 seconds
      });
      socket.on('ema_cross', async (data) => {
        console.log('EMA Cross event received:', data);
        notificationElement.textContent = data.message;
        notificationElement.classList.remove('hidden');

        latestEmaCrossPrices[data.emaName] = data.price;

        const usdJpyChartObj = chartObjects.find(obj => obj.ticker === 'USDJPY=X');
        if (usdJpyChartObj && usdJpyChartObj.emaCrossHistoryElement) { // Use new emaCrossHistoryElement
            updateEmaCrossHistoryDisplay(usdJpyChartObj.emaCrossHistoryElement, latestEmaCrossPrices);
        }


        setTimeout(() => {
            notificationElement.classList.add('hidden');
        }, 5000);
      });
      socket.on('disconnect', () => {
          console.log('Disconnected from WebSocket server.');
      });
  
      // Listen for real-time USD/JPY price updates
      socket.on('usd_jpy_price_update', (data) => {
          usdJpyCurrentPrice = data.price;
          checkAndResetCrossPrices();
      });
  
                    // Event listener for the reset threshold input and button (now handled within renderChartForUsdJpy)
  
                    // Removed global setup here as elements are dynamic
  
                });
  
              // Function to send BB settings to the server
function sendBbSettingsToServer() {
  if (socket && socket.connected) {
    const bbPeriod = parseInt(bbPeriodInput.value, 10);
    const bbStdDev = parseFloat(bbStdDevInput.value);
    if (!isNaN(bbPeriod) && !isNaN(bbStdDev)) {
      socket.emit('update_bb_settings', { bbPeriod, bbStdDev });
      console.log('Sent BB settings to server:', { bbPeriod, bbStdDev });
    }
  }
}

// Modify applyIndicatorsButton event listener（これを唯一の applyIndicators リスナーにする）
applyIndicatorsButton.addEventListener('click', () => {
  start(currentDataType);
  indicatorSettings.classList.add('hidden');
  saveUserSettings();
  sendBbSettingsToServer(); // Send updated settings to server
});
