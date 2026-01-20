// client.js
import { createChart as createLightweightChart, LineStyle } from 'lightweight-charts';
import { BollingerBands, SMA, EMA } from 'technicalindicators';
import { io } from 'socket.io-client';

// --- DOM Elements ---
const tickersInput = document.getElementById('tickers-input');
const intervalSelect = document.getElementById('interval-select');
const startButton = document.getElementById('start-button');
const cryptoTickerListContainer = document.getElementById('crypto-ticker-list-container');
const cryptoTickerSelect = document.getElementById('crypto-ticker-select');
const chartsContainer = document.getElementById('charts-container');
const statusMessage = document.getElementById('status-message');
const stockToggle = document.getElementById('stockToggle');
const usdJpyToggle = document.getElementById('usdJpyToggle');
const cryptoToggle = document.getElementById('cryptoToggle');
const tickersInputGroup = tickersInput.closest('.input-group');
const toggleBbButton = document.getElementById('toggle-bb-button');
const toggleEmaButton = document.getElementById('toggle-ema-button');
const bbPeriodInput = document.getElementById('bb-period');
const bbStdDevInput = document.getElementById('bb-stddev');
const ema1PeriodInput = document.getElementById('ema1-period');
const ema2PeriodInput = document.getElementById('ema2-period');
const ema3PeriodInput = document.getElementById('ema3-period');
const applyIndicatorsButton = document.getElementById('apply-indicators-button');
const indicatorSettings = document.getElementById('indicator-settings');
const subscribeSettings = document.getElementById('subscribe-settings');
const emailInput = document.getElementById('email-input');
const subscribeButton = document.getElementById('subscribe-button');
const toggleEmailListButton = document.getElementById('toggle-email-list-button');
const emailListPanel = document.getElementById('email-list-panel');
const emailList = document.getElementById('email-list');
const notificationElement = document.getElementById('cross-notification');

// ✅ 追加：ヘッダーの「メール受信」トグル
const emailAlertToggleContainer = document.getElementById('email-alert-toggle-container');
const emailAlertToggle = document.getElementById('email-alert-toggle');
const emailAlertToggleText = document.getElementById('email-alert-toggle-text');

// --- Authentication DOM Elements ---
const userInfoSpan = document.getElementById('user-info');
const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');
const logoutButton = document.getElementById('logout-button');

// --- X Value DOM Elements ---
const xValueControls = document.getElementById('x-value-controls');
const xValueLabel = document.getElementById('x-value-label');
const xValueIntervalLabel = document.getElementById('x-value-interval-label');
const currentXValueSpan = document.getElementById('current-x-value');
const xValueInput = document.getElementById('x-value-input');
const saveXValueButton = document.getElementById('save-x-value-button');
const deleteXValueButton = document.getElementById('delete-x-value-button');

// --- Global State ---
let chartObjects = []; // holds all chart instances and their series for updates
let updateIntervalId = null;
let currentDataType = 'stock'; // 'stock' or 'usd_jpy' or 'crypto'
let currentStockTicker = '7203';
let currentCryptoTicker = 'BTC-USD';
let currentUserCryptoXValues = {};
let currentInterval = '1d';
let currentTickers = [];
let areBollingerBandsVisible = true;
let areEmaVisible = true;
let currentUserEmail = null;

// ✅ intervalごとに保持（独立運用）
let latestCrossPricesByInterval = {}; // USDJPY BB: { [interval]: { upper2: {price,interval,timestamp}|null, ... } }
let latestEmaCrossPricesByInterval = {}; // USDJPY EMA: { [interval]: { ema10: {price,interval,timestamp}|null, ... } }

let usdJpyCurrentPrice = null;
let currentUserXValues = {}; // USDJPY thresholds by interval
let socket = null;

/**
 * Formats a numeric value to three decimal places.
 */
const formatValue = (value) => Number(value).toFixed(3);

// ✅ 追加：メール受信トグルの表示更新
function updateEmailAlertToggleUI() {
  if (!emailAlertToggle || !emailAlertToggleText) return;
  emailAlertToggleText.textContent = emailAlertToggle.checked ? 'メール受信: ON' : 'メール受信: OFF';
}

/**
 * ✅ FIX: X値UIがタブ切替で「前の値を保持してしまう」事故を防ぐ
 * - どのタブで何のしきい値を編集しているかを明示
 * - stockタブではX値UIを無効化（誤保存防止）
 */
function setXValueUiEnabled(enabled) {
  if (xValueInput) xValueInput.disabled = !enabled;
  if (saveXValueButton) saveXValueButton.disabled = !enabled;
  if (deleteXValueButton) deleteXValueButton.disabled = !enabled;
}

function updateXValueContextLabel() {
  if (!xValueLabel) return;

  if (currentDataType === 'crypto') {
    xValueLabel.textContent = `しきい値（仮想通貨: ${currentCryptoTicker}）`;
    return;
  }
  if (currentDataType === 'usd_jpy') {
    xValueLabel.textContent = 'しきい値（USD/JPY）';
    return;
  }
  xValueLabel.textContent = 'しきい値（このタブでは未使用）';
}

// =========================
// ✅ X-value helpers (FIX)
// =========================
// 未設定は null として扱う（0/NaN/負は無効）
function normalizeXValue(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}
function getXValueForInterval(interval) {
  if (!hasOwn(currentUserXValues, interval)) return null;
  return normalizeXValue(currentUserXValues[interval]);
}
// 保存時は「正の数だけ」送る（消したキーが勝手に復活しない）
function buildCleanXValues() {
  const cleaned = {};
  for (const [iv, v] of Object.entries(currentUserXValues || {})) {
    const n = normalizeXValue(v);
    if (n != null) cleaned[iv] = n;
  }
  return cleaned;
}

// ✅ クリア直後に 0.001 が見えるのを避ける（HTML側の初期value対策）
try {
  if (xValueInput) xValueInput.value = '';
} catch {}

// ✅ 縦軸(価格軸)を小数第3位固定にするための設定
const PRICE_FORMAT_3DP = { type: 'price', precision: 3, minMove: 0.001 };

// =========================
// Cross history persistence (USDJPY only)
// =========================
let lsKeySuffix = 'guest';
const LS_KEY_BB_CROSS = () => `parabolic_bb_cross_prices_v2_${lsKeySuffix}`;
const LS_KEY_EMA_CROSS = () => `parabolic_ema_cross_prices_v2_${lsKeySuffix}`;

function safeParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// =========================
// Cross event shape helpers
// =========================
function normalizeCrossEvent(v) {
  if (v == null) return null;
  if (typeof v === 'number' && !Number.isNaN(v)) {
    return { price: v, interval: null, timestamp: null };
  }
  if (typeof v === 'object') {
    const p = v.price;
    if (typeof p === 'number' && !Number.isNaN(p)) {
      return {
        price: p,
        interval: typeof v.interval === 'string' ? v.interval : null,
        timestamp: typeof v.timestamp === 'string' ? v.timestamp : null,
      };
    }
  }
  return null;
}

function getCrossPriceValue(v) {
  const ev = normalizeCrossEvent(v);
  return ev ? ev.price : null;
}

function ensureIntervalMap(obj, interval) {
  const iv = String(interval || 'unknown');
  if (!obj[iv] || typeof obj[iv] !== 'object') obj[iv] = {};
  return obj[iv];
}
function getBbCrossMap(interval) {
  return ensureIntervalMap(latestCrossPricesByInterval, interval);
}
function getEmaCrossMap(interval) {
  return ensureIntervalMap(latestEmaCrossPricesByInterval, interval);
}

// localStorage → in-memory（v2: interval別）
function ingestCrossHistoryObjectToByInterval(sourceObj, targetByInterval) {
  if (!sourceObj || typeof sourceObj !== 'object') return;

  const values = Object.values(sourceObj);

  const looksNested =
    values.some(
      (v) =>
        v &&
        typeof v === 'object' &&
        !normalizeCrossEvent(v) &&
        Object.values(v).some((x) => normalizeCrossEvent(x))
    );

  const looksFlat =
    values.some((v) => normalizeCrossEvent(v) !== null) || values.some((v) => v === null);

  if (looksNested && !looksFlat) {
    for (const [intervalKey, map] of Object.entries(sourceObj)) {
      if (!map || typeof map !== 'object') continue;
      const dest = ensureIntervalMap(targetByInterval, intervalKey);
      for (const [name, ev] of Object.entries(map)) {
        const n = normalizeCrossEvent(ev);
        dest[String(name)] = n ? n : ev === null ? null : dest[String(name)];
      }
    }
    return;
  }

  const fallbackInterval = currentInterval || intervalSelect?.value || 'unknown';
  for (const [name, ev] of Object.entries(sourceObj)) {
    if (ev === null) {
      ensureIntervalMap(targetByInterval, fallbackInterval)[String(name)] = null;
      continue;
    }
    const n = normalizeCrossEvent(ev);
    if (!n) continue;
    const iv = n.interval || fallbackInterval;
    ensureIntervalMap(targetByInterval, iv)[String(name)] = n;
  }
}

function loadCrossHistoryFromLocalStorage() {
  try {
    const bb = safeParseJson(localStorage.getItem(LS_KEY_BB_CROSS()));
    const ema = safeParseJson(localStorage.getItem(LS_KEY_EMA_CROSS()));

    if (bb && typeof bb === 'object') ingestCrossHistoryObjectToByInterval(bb, latestCrossPricesByInterval);
    if (ema && typeof ema === 'object') ingestCrossHistoryObjectToByInterval(ema, latestEmaCrossPricesByInterval);
  } catch (e) {
    console.warn('Failed to load cross history from localStorage:', e);
  }
}

function saveCrossHistoryToLocalStorage() {
  try {
    localStorage.setItem(LS_KEY_BB_CROSS(), JSON.stringify(latestCrossPricesByInterval || {}));
    localStorage.setItem(LS_KEY_EMA_CROSS(), JSON.stringify(latestEmaCrossPricesByInterval || {}));
  } catch (e) {
    console.warn('Failed to save cross history to localStorage:', e);
  }
}

function clearCrossHistoryLocalStorage() {
  try {
    localStorage.removeItem(LS_KEY_BB_CROSS());
    localStorage.removeItem(LS_KEY_EMA_CROSS());
  } catch (e) {
    console.warn('Failed to clear cross history localStorage:', e);
  }
}

// server(DB)に保存されている crossHistory を client 用の形に反映（USDJPYのみ）
function applyCrossHistoryFromServer(crossHistory) {
  if (!crossHistory || typeof crossHistory !== 'object') return;

  ingestCrossHistoryObjectToByInterval(crossHistory, latestCrossPricesByInterval);

  const mixed = latestCrossPricesByInterval;
  latestCrossPricesByInterval = {};
  latestEmaCrossPricesByInterval = {};

  for (const [iv, map] of Object.entries(mixed || {})) {
    if (!map || typeof map !== 'object') continue;
    for (const [name, ev] of Object.entries(map)) {
      const n = normalizeCrossEvent(ev);
      if (String(name).startsWith('ema')) {
        ensureIntervalMap(latestEmaCrossPricesByInterval, iv)[String(name)] = n ? n : ev === null ? null : null;
      } else {
        ensureIntervalMap(latestCrossPricesByInterval, iv)[String(name)] = n ? n : ev === null ? null : null;
      }
    }
  }

  saveCrossHistoryToLocalStorage();
}

// --- Helper Function for Aggregating Candlestick Data ---
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

function resizeChartObject(chartObj) {
  if (!chartObj || !chartObj.chart || !chartObj.container) return;
  const w = chartObj.container.clientWidth;
  const h = chartObj.container.clientHeight;
  if (!w || !h) return;
  chartObj.chart.resize(w, h);
}

function refreshUsdJpyCrossHistoryUI() {
  const usdJpyChartObj = chartObjects.find((obj) => obj?.ticker === 'USDJPY=X');
  if (!usdJpyChartObj) return;

  if (usdJpyChartObj.crossHistoryElement) {
    updateCrossHistoryDisplay(usdJpyChartObj.crossHistoryElement, getBbCrossMap(currentInterval));
  }
  if (usdJpyChartObj.emaCrossHistoryElement) {
    updateEmaCrossHistoryDisplay(usdJpyChartObj.emaCrossHistoryElement, getEmaCrossMap(currentInterval));
  }
  requestAnimationFrame(() => resizeChartObject(usdJpyChartObj));
}

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
  `;
}

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
  `;
}

function updateCurrentPriceValue(element, data) {
  if (!element || !data || data.length === 0) {
    if (element) element.innerHTML = '';
    return;
  }

  const latestData = data[data.length - 1];
  const currentPrice = latestData.close;
  const previousPrice = data.length > 1 ? data[data.length - 2].close : currentPrice;
  const change = currentPrice - previousPrice;
  const changePercent = previousPrice ? (change / previousPrice) * 100 : 0;
  const colorClass = change >= 0 ? 'price-up' : 'price-down';

  element.innerHTML = `
    <span class="price-large ${colorClass}">${formatValue(currentPrice)}</span>
    <span class="${colorClass}">${change >= 0 ? '+' : ''}${change.toFixed(2)}</span>
    <span class="${colorClass}">(${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)</span>
  `;
}

function updateCrossHistoryDisplay(element, crossPrices) {
  if (!element) return;

  element.style.boxSizing = 'border-box';
  element.style.minHeight = '72px';

  const bands = ['upper2', 'upper1', 'middle', 'lower1', 'lower2'];
  const bandLabels = {
    upper2: '+2σ',
    upper1: '+1σ',
    middle: '0σ',
    lower1: '-1σ',
    lower2: '-2σ',
  };

  const hasAny = Object.values(crossPrices || {}).some((v) => getCrossPriceValue(v) != null);

  let content = `
    <div class="indicator-group-title" style="margin-bottom:6px;font-weight:600;">
      BBクロス履歴（${currentInterval}）
    </div>
  `;

  if (!hasAny) {
    content += `<div class="indicator-item"><span>クロス待機中...</span></div>`;
    element.innerHTML = content;
    return;
  }

  content += `
    <div class="cross-item-container"
         style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;">
  `;

  for (const band of bands) {
    const v = crossPrices?.[band];
    const pv = getCrossPriceValue(v);
    const price = pv != null ? formatValue(pv) : '---';

    content += `
      <div class="indicator-item"
           style="display:flex;justify-content:space-between;gap:8px;white-space:nowrap;overflow:hidden;">
        <span style="opacity:0.85;">${bandLabels[band]}</span>
        <span style="font-variant-numeric:tabular-nums;">${price}</span>
      </div>
    `;
  }

  content += `</div>`;
  element.innerHTML = content;
}

function updateEmaCrossHistoryDisplay(element, crossPrices) {
  if (!element) return;

  element.style.boxSizing = 'border-box';
  element.style.minHeight = '72px';

  const emas = ['ema10', 'ema25', 'ema50'];
  const emaLabels = {
    ema10: 'EMA(10)',
    ema25: 'EMA(25)',
    ema50: 'EMA(50)',
  };

  const hasAny = Object.values(crossPrices || {}).some((v) => getCrossPriceValue(v) != null);

  let content = `
    <div class="indicator-group-title" style="margin-bottom:6px;font-weight:600;">
      EMAクロス履歴（${currentInterval}）
    </div>
  `;

  if (!hasAny) {
    content += `<div class="indicator-item"><span>クロス待機中...</span></div>`;
    element.innerHTML = content;
    return;
  }

  content += `
    <div class="cross-item-container"
         style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;">
  `;

  for (const ema of emas) {
    const v = crossPrices?.[ema];
    const pv = getCrossPriceValue(v);
    const price = pv != null ? formatValue(pv) : '---';

    content += `
      <div class="indicator-item"
           style="display:flex;justify-content:space-between;gap:8px;white-space:nowrap;overflow:hidden;">
        <span style="opacity:0.85;">${emaLabels[ema]}</span>
        <span style="font-variant-numeric:tabular-nums;">${price}</span>
      </div>
    `;
  }

  content += `</div>`;
  element.innerHTML = content;
}

async function refreshChartData() {
  statusMessage.textContent = `更新中: ${
    currentDataType === 'usd_jpy' ? 'USD/JPY' : currentTickers.join(', ')
  } (${currentInterval}) - データ取得中...`;

  for (const chartObj of chartObjects) {
    if (!chartObj) continue;

    let data;
    try {
      if (currentDataType === 'stock' || currentDataType === 'crypto') {
        data = await fetchStockData(chartObj.ticker, currentInterval);
      } else {
        data = await fetchUsdJpyData(chartObj.interval);
      }

      updateCurrentPriceValue(chartObj.currentPriceValuesElement, data);

      if (!data || data.length < 20) continue;

      if (currentInterval === '4h' || currentInterval === '8h') {
        data = aggregateCandleData(data, currentInterval);
      }
      if (!data || data.length < 20) continue;

      const closePrices = data.map((d) => d.close);

      // Bollinger Bands
      const bbPeriod = parseInt(bbPeriodInput.value, 10) || 20;
      const bbStdDev = parseFloat(bbStdDevInput.value) || 2;
      const bbInput1 = { period: bbPeriod, values: closePrices, stdDev: 1 };
      const bbInput2 = { period: bbPeriod, values: closePrices, stdDev: bbStdDev };

      const bb1 = BollingerBands.calculate(bbInput1);
      const bb2 = BollingerBands.calculate(bbInput2);

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

      updateEmaValues(chartObj.emaValuesElement, emaDataArray, emaPeriods);

      // Align BB with candles
      const dataOffset = data.length - bb1.length;
      const middleBandData = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.middle }));
      const upperBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
      const lowerBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));
      const upperBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
      const lowerBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));

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

      const sma1Data = data.map((d) => ({ time: d.time, value: d.close }));
      if (chartObj.sma1Series) {
        chartObj.sma1Series.setData(sma1Data);
      }

      resizeChartObject(chartObj);
    } catch (error) {
      console.error(`Failed to refresh data for ${chartObj.ticker}:`, error);
      statusMessage.textContent = `エラー: ${chartObj.ticker} のデータ更新に失敗しました。`;
    }
  }

  statusMessage.textContent = `表示中: ${
    currentDataType === 'usd_jpy' ? 'USD/JPY' : currentTickers.join(', ')
  } (${currentInterval}) - 60秒ごとに更新`;
}

// --- Interval Options ---
const stockIntervalOptions = [
  { value: '1m', text: '1分' },
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
  { value: '1m', text: '1分' },
  { value: '5m', text: '5分' },
  { value: '15m', text: '15分' },
  { value: '30m', text: '30分' },
  { value: '1h', text: '1時間' },
  { value: '4h', text: '4時間' },
  { value: '8h', text: '8時間' },
  { value: '1d', text: '日足' },
  { value: '1wk', text: '1週間' },
];

const cryptoIntervalOptions = [
  { value: '1m', text: '1分' },
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
  tickersInputGroup.style.display = currentDataType === 'usd_jpy' ? 'none' : 'flex';
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
    <h2 class="chart-title">
      ${currentDataType === 'crypto' ? `<a href="https://finance.yahoo.com/markets/crypto/all/" target="_blank" rel="noopener noreferrer" style="margin-right: 5px;">🔗</a>` : ''}
      ${ticker}
    </h2>
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
    if (interval === '4h' || interval === '8h') data = aggregateCandleData(data, interval);
    if (!data || data.length < 20) throw new Error('Not enough data to calculate indicators.');
  } catch (error) {
    wrapper.querySelector(`#ohlc-${sanitizedTicker}`).innerText = `Error loading data for ${ticker}: ${error.message}`;
    return null;
  }

  const currentPriceValuesElement = wrapper.querySelector(`#current-price-${sanitizedTicker}`);
  updateCurrentPriceValue(currentPriceValuesElement, data);

  const closePrices = data.map((d) => d.close);

  const bbPeriod = parseInt(bbPeriodInput.value, 10) || 20;
  const bbStdDev = parseFloat(bbStdDevInput.value) || 2;
  const bbInput1 = { period: bbPeriod, values: closePrices, stdDev: 1 };
  const bbInput2 = { period: bbPeriod, values: closePrices, stdDev: bbStdDev };
  const bb1 = BollingerBands.calculate(bbInput1);
  const bb2 = BollingerBands.calculate(bbInput2);

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

  const emaValuesElement = wrapper.querySelector(`#ema-values-${sanitizedTicker}`);
  updateEmaValues(emaValuesElement, emaDataArray, emaPeriods);

  const dataOffset = data.length - bb1.length;
  const middleBandData = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.middle }));
  const upperBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
  const lowerBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));
  const upperBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
  const lowerBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));

  const ohlcChart = createChart(wrapper.querySelector(`#ohlc-${sanitizedTicker}`));

  const middleBandSeries = ohlcChart.addLineSeries({
    color: 'purple',
    lineWidth: 2,
    title: 'BB 0σ',
    crosshairMarkerVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
    visible: areBollingerBandsVisible,
    priceFormat: PRICE_FORMAT_3DP,
  });
  const upperBand1Series = ohlcChart.addLineSeries({
    color: 'purple',
    lineWidth: 2,
    title: 'BB +1σ',
    crosshairMarkerVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
    visible: areBollingerBandsVisible,
    priceFormat: PRICE_FORMAT_3DP,
  });
  const lowerBand1Series = ohlcChart.addLineSeries({
    color: 'purple',
    lineWidth: 2,
    title: 'BB -1σ',
    crosshairMarkerVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
    visible: areBollingerBandsVisible,
    priceFormat: PRICE_FORMAT_3DP,
  });
  const upperBand2Series = ohlcChart.addLineSeries({
    color: 'purple',
    lineWidth: 2,
    title: 'BB +2σ',
    crosshairMarkerVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
    visible: areBollingerBandsVisible,
    priceFormat: PRICE_FORMAT_3DP,
  });
  const lowerBand2Series = ohlcChart.addLineSeries({
    color: 'purple',
    lineWidth: 2,
    title: 'BB -2σ',
    crosshairMarkerVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
    visible: areBollingerBandsVisible,
    priceFormat: PRICE_FORMAT_3DP,
  });

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
      priceFormat: PRICE_FORMAT_3DP,
    });
    emaSeries.setData(emaDataArray[index]);
    return emaSeries;
  });

  const sma1Data = data.map((d) => ({ time: d.time, value: d.close }));
  const sma1Series = ohlcChart.addLineSeries({
    color: 'cyan',
    lineWidth: 1,
    title: 'SMA(1)',
    crosshairMarkerVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
    visible: true,
    priceFormat: PRICE_FORMAT_3DP,
  });
  sma1Series.setData(sma1Data);

  const candleSeries = ohlcChart.addCandlestickSeries({
    upColor: '#ff4c4c',
    downColor: '#4c6aff',
    borderVisible: false,
    wickUpColor: '#ff4c4c',
    wickDownColor: '#4c6aff',
    priceFormat: PRICE_FORMAT_3DP,
  });
  candleSeries.setData(data);

  return {
    chart: ohlcChart,
    container: wrapper.querySelector(`#ohlc-${sanitizedTicker}`),
    currentPriceValuesElement,
    bbValuesElement,
    emaValuesElement,
    crossHistoryElement: wrapper.querySelector(`#cross-history-${sanitizedTicker}`),
    candleSeries,
    middleBandSeries,
    upperBand1Series,
    lowerBand1Series,
    upperBand2Series,
    lowerBand2Series,
    emaSeriesArray,
    sma1Series,
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
    }

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
    const bbStdDev = parseFloat(bbStdDevInput.value) || 2;
    const bbInput1 = { period: bbPeriod, values: closePrices, stdDev: 1 };
    const bbInput2 = { period: bbPeriod, values: closePrices, stdDev: bbStdDev };

    const bb1 = BollingerBands.calculate(bbInput1);
    const bb2 = BollingerBands.calculate(bbInput2);

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

    const emaValuesElement = wrapper.querySelector('#ema-values-usdjpy');
    updateEmaValues(emaValuesElement, emaDataArray, emaPeriods);

    const crossHistoryElement = wrapper.querySelector('#cross-history-usdjpy');
    updateCrossHistoryDisplay(crossHistoryElement, getBbCrossMap(currentInterval));

    const emaCrossHistoryElement = wrapper.querySelector('#ema-cross-history-usdjpy');
    updateEmaCrossHistoryDisplay(emaCrossHistoryElement, getEmaCrossMap(currentInterval));

    const dataOffset = data.length - bb1.length;
    const middleBandData = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.middle }));
    const upperBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
    const lowerBand1Data = bb1.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));
    const upperBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.upper }));
    const lowerBand2Data = bb2.map((d, i) => ({ time: data[i + dataOffset].time, value: d.lower }));

    const usdJpyChart = createChart(wrapper.querySelector(`#usd-jpy-chart`));

    const middleBandSeries = usdJpyChart.addLineSeries({
      color: 'purple',
      lineWidth: 2,
      title: 'BB 0σ',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: areBollingerBandsVisible,
      priceFormat: PRICE_FORMAT_3DP,
    });
    const upperBand1Series = usdJpyChart.addLineSeries({
      color: 'purple',
      lineWidth: 2,
      title: 'BB +1σ',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: areBollingerBandsVisible,
      priceFormat: PRICE_FORMAT_3DP,
    });
    const lowerBand1Series = usdJpyChart.addLineSeries({
      color: 'purple',
      lineWidth: 2,
      title: 'BB -1σ',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: areBollingerBandsVisible,
      priceFormat: PRICE_FORMAT_3DP,
    });
    const upperBand2Series = usdJpyChart.addLineSeries({
      color: 'purple',
      lineWidth: 2,
      title: 'BB +2σ',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: areBollingerBandsVisible,
      priceFormat: PRICE_FORMAT_3DP,
    });
    const lowerBand2Series = usdJpyChart.addLineSeries({
      color: 'purple',
      lineWidth: 2,
      title: 'BB -2σ',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: areBollingerBandsVisible,
      priceFormat: PRICE_FORMAT_3DP,
    });

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
        priceFormat: PRICE_FORMAT_3DP,
      });
      emaSeries.setData(emaDataArray[index]);
      return emaSeries;
    });

    const sma1Data = data.map((d) => ({ time: d.time, value: d.close }));
    const sma1Series = usdJpyChart.addLineSeries({
      color: 'cyan',
      lineWidth: 1,
      title: 'SMA(1)',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: true,
      priceFormat: PRICE_FORMAT_3DP,
    });
    sma1Series.setData(sma1Data);

    const candleSeries = usdJpyChart.addCandlestickSeries({
      upColor: '#ff4c4c',
      downColor: '#4c6aff',
      borderVisible: false,
      wickUpColor: '#ff4c4c',
      wickDownColor: '#4c6aff',
      priceFormat: PRICE_FORMAT_3DP,
    });
    candleSeries.setData(data);

    usdJpyChart.timeScale().fitContent();

    return {
      chart: usdJpyChart,
      container: wrapper.querySelector(`#usd-jpy-chart`),
      currentPriceValuesElement,
      bbValuesElement,
      emaValuesElement,
      crossHistoryElement,
      emaCrossHistoryElement,
      candleSeries,
      middleBandSeries,
      upperBand1Series,
      lowerBand1Series,
      upperBand2Series,
      lowerBand2Series,
      emaSeriesArray,
      sma1Series,
      ticker: 'USDJPY=X',
      interval: actualInterval,
    };
  }

  return null;
}

/**
 * Main function to start/update the charting process.
 */
async function start(dataType) {
  if (dataType === 'stock') {
    currentStockTicker = tickersInput.value;
  } else if (dataType === 'crypto') {
    currentCryptoTicker =
      String(tickersInput.value || '').split(',')[0].trim() || currentCryptoTicker;
  }

  if (updateIntervalId) clearInterval(updateIntervalId);

  currentInterval = intervalSelect.value;
  chartsContainer.innerHTML = '';
  chartObjects = [];

  usdJpyCurrentPrice = null;

  statusMessage.textContent = 'チャートを読み込んでいます...';
  currentDataType = dataType;

  // ✅ FIX: タブ切替/再描画のたびに「そのタブのX値」を必ず反映（残留値事故防止）
  updateXValueDisplay(currentInterval);

  if (dataType === 'stock') {
    currentTickers = tickersInput.value.split(',').map((t) => t.trim()).filter((t) => t);
    currentInterval = intervalSelect.value;

    const formattedTickers = currentTickers.map((c) => (c.endsWith('.T') ? c : `${c}.T`));
    await renderChartsForStocks(formattedTickers, currentInterval);

    statusMessage.textContent = `表示中: ${formattedTickers.join(', ')} (${currentInterval}) - 30秒ごとに更新`;
    updateIntervalId = setInterval(refreshChartData, 30 * 1000);
  } else if (dataType === 'usd_jpy') {
    currentTickers = ['USDJPY=X'];
    currentInterval = intervalSelect.value;

    const usdJpyChartObj = await renderChartForUsdJpy(currentInterval);
    if (usdJpyChartObj) chartObjects.push(usdJpyChartObj);

    refreshUsdJpyCrossHistoryUI();

    statusMessage.textContent = `表示中: USD/JPY (${currentInterval}) - 30秒ごとに更新`;
    updateIntervalId = setInterval(refreshChartData, 30 * 1000);
  } else if (dataType === 'crypto') {
    currentTickers = tickersInput.value.split(',').map((t) => t.trim()).filter((t) => t);
    currentInterval = intervalSelect.value;

    currentCryptoTicker = currentTickers[0] || currentCryptoTicker;
    updateXValueDisplay(currentInterval);

    await renderChartsForStocks(currentTickers, currentInterval);
    statusMessage.textContent = `表示中: ${currentTickers.join(', ')} (${currentInterval}) - 30秒ごとに更新`;
    updateIntervalId = setInterval(refreshChartData, 30 * 1000);
  }
}

// --- Event Listeners ---
async function loadCryptoTickers() {
  try {
    const response = await fetch('/api/crypto/tickers');
    if (!response.ok) throw new Error('Failed to fetch tickers');
    const tickers = await response.json();

    cryptoTickerSelect.innerHTML = '<option value="">銘柄を選択...</option>';
    tickers.forEach(ticker => {
      const option = document.createElement('option');
      option.value = ticker;
      option.textContent = ticker;
      cryptoTickerSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading crypto tickers:', error);
    if (cryptoTickerListContainer) cryptoTickerListContainer.classList.add('hidden');
  }
}

if (cryptoTickerSelect) {
  cryptoTickerSelect.addEventListener('change', () => {
    if (cryptoTickerSelect.value) {
      tickersInput.value = cryptoTickerSelect.value;
      start(currentDataType);
      updateXValueDisplay(intervalSelect.value);
    }
  });
}

window.addEventListener('resize', () => {
  chartObjects.forEach((obj) => resizeChartObject(obj));
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

applyIndicatorsButton.addEventListener('click', () => {
  start(currentDataType);
  saveUserSettings();
});

intervalSelect.addEventListener('change', () => {
  currentInterval = intervalSelect.value;
  updateXValueDisplay(currentInterval);
  refreshUsdJpyCrossHistoryUI();
  saveUserSettings();
});

// ✅ 追加：ヘッダーのメール受信トグル change で保存
if (emailAlertToggle) {
  emailAlertToggle.addEventListener('change', () => {
    updateEmailAlertToggleUI();
    saveUserSettings();
  });
}

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
      await refreshEmailList();
    } else {
      throw new Error(result.error || '登録に失敗しました。');
    }
  } catch (error) {
    statusMessage.textContent = error.message;
  }
});

// ===== Email list panel =====
toggleEmailListButton.addEventListener('click', async () => {
  const isHidden = emailListPanel.classList.contains('hidden');
  if (isHidden) {
    await refreshEmailList();
    emailListPanel.classList.remove('hidden');
  } else {
    emailListPanel.classList.add('hidden');
  }
});

async function safeReadJson(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function deleteEmail(email) {
  statusMessage.textContent = `メールアドレス ${email} を削除中...`;

  try {
    const response = await fetch(`/api/emails/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const result = await safeReadJson(response);

    if (response.ok) {
      statusMessage.textContent = result?.message || '削除しました。';
      await refreshEmailList();
      return;
    }

    throw new Error(result?.error || `削除に失敗しました。(HTTP ${response.status})`);
  } catch (error) {
    console.error('Email deletion error:', error);
    statusMessage.textContent = error?.message || '削除に失敗しました。';
  }
}

async function refreshEmailList() {
  try {
    const response = await fetch('/api/emails', { credentials: 'include' });

    if (!response.ok) {
      const err = await safeReadJson(response);
      throw new Error(err?.error || `メール一覧を取得できませんでした。(HTTP ${response.status})`);
    }

    const data = await safeReadJson(response);
    const emails = Array.isArray(data) ? data : Array.isArray(data?.emails) ? data.emails : [];

    emailList.innerHTML = '';

    if (emails.length === 0) {
      const li = document.createElement('li');
      li.textContent = '登録されているメールアドレスはありません。';
      emailList.appendChild(li);
      return;
    }

    const me = (currentUserEmail || '').toLowerCase();

    emails.forEach((item) => {
      const li = document.createElement('li');
      li.classList.add('email-list-item');

      const emailText = String(item?.email ?? '');
      const emailSpan = document.createElement('span');
      emailSpan.textContent = emailText;
      li.appendChild(emailSpan);

      if (me && emailText.toLowerCase() === me) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = '削除';
        deleteButton.classList.add('delete-email-button');

        deleteButton.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();
          await deleteEmail(emailText);
        });

        li.appendChild(deleteButton);
      }

      emailList.appendChild(li);
    });
  } catch (error) {
    console.error('Failed to refresh email list:', error);
    statusMessage.textContent = error?.message || 'メールリストの更新に失敗しました。';
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
  if (cryptoToggle) cryptoToggle.classList.remove('active');
  if (cryptoTickerListContainer) cryptoTickerListContainer.classList.add('hidden');
  updateIntervalOptions(stockIntervalOptions, '1d');
  updateTickerInputVisibility();
  tickersInput.closest('.input-group').querySelector('label').textContent = '銘柄コード';
  tickersInput.value = currentStockTicker;
  currentInterval = intervalSelect.value;
  start(currentDataType);
  saveUserSettings();
});

usdJpyToggle.addEventListener('click', () => {
  currentDataType = 'usd_jpy';
  usdJpyToggle.classList.add('active');
  stockToggle.classList.remove('active');
  if (cryptoToggle) cryptoToggle.classList.remove('active');
  if (cryptoTickerListContainer) cryptoTickerListContainer.classList.add('hidden');
  updateIntervalOptions(usdJpyIntervalOptions, '1d');
  updateTickerInputVisibility();
  currentInterval = intervalSelect.value;
  start(currentDataType);
  saveUserSettings();
});

if (cryptoToggle) {
  cryptoToggle.addEventListener('click', () => {
    currentDataType = 'crypto';
    cryptoToggle.classList.add('active');
    stockToggle.classList.remove('active');
    usdJpyToggle.classList.remove('active');
    if (cryptoTickerListContainer) cryptoTickerListContainer.classList.remove('hidden');
    loadCryptoTickers();
    updateIntervalOptions(cryptoIntervalOptions, '1d');
    updateTickerInputVisibility();
    tickersInput.closest('.input-group').querySelector('label').textContent = '通貨ペア';
    tickersInput.value = currentCryptoTicker;
    currentInterval = intervalSelect.value;
    start(currentDataType);
    saveUserSettings();
  });
}

// --- User Settings Functions ---
async function saveUserSettings() {
  const settings = {
    currentDataType,
    currentInterval: intervalSelect.value,
    currentStockTicker,
    currentCryptoTicker,
    areBollingerBandsVisible,
    areEmaVisible,
    bbPeriod: bbPeriodInput.value,
    bbStdDev: bbStdDevInput.value,
    ema1Period: ema1PeriodInput.value,
    ema2Period: ema2PeriodInput.value,
    ema3Period: ema3PeriodInput.value,
    emailAlertsEnabled: emailAlertToggle ? !!emailAlertToggle.checked : true,
    x_values: buildCleanXValues(),                // USDJPY thresholds
    crypto_x_values: currentUserCryptoXValues,    // ✅ crypto thresholds: { [ticker]: { [interval]: number } }
  };

  try {
    const response = await fetch('/api/user/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to save user settings.', errorData.error || '');
    }
  } catch (error) {
    console.error('Network error saving user settings:', error);
  }
}

async function loadUserSettings() {
  try {
    const response = await fetch(`/api/user/settings?_=${Date.now()}`);
    if (response.ok) {
      const raw = await response.json();
      const settings = { ...(raw.settings || {}), ...raw };
      delete settings.settings;

      if (Object.keys(settings).length > 0) {
        applyCrossHistoryFromServer(settings.realTimeState?.crossHistory);
        currentUserXValues = settings.x_values && typeof settings.x_values === 'object' ? settings.x_values : {};
        currentUserXValues = buildCleanXValues();

        currentUserCryptoXValues = settings.crypto_x_values || {};

        currentDataType = settings.currentDataType || 'stock';
        currentInterval = settings.currentInterval || '1d';
        intervalSelect.value = currentInterval;

        currentStockTicker = settings.currentStockTicker || '7203';
        currentCryptoTicker = settings.currentCryptoTicker || 'BTC-USD';

        if (currentDataType === 'stock') {
          tickersInput.value = currentStockTicker;
        } else if (currentDataType === 'crypto') {
          tickersInput.value = currentCryptoTicker;
        }

        areBollingerBandsVisible = settings.areBollingerBandsVisible !== undefined ? settings.areBollingerBandsVisible : true;
        areEmaVisible = settings.areEmaVisible !== undefined ? settings.areEmaVisible : true;
        bbPeriodInput.value = settings.bbPeriod || '20';
        bbStdDevInput.value = settings.bbStdDev || '2';
        ema1PeriodInput.value = settings.ema1Period || '10';
        ema2PeriodInput.value = settings.ema2Period || '25';
        ema3PeriodInput.value = settings.ema3Period || '50';

        if (emailAlertToggle) {
          emailAlertToggle.checked = settings.emailAlertsEnabled !== false;
          updateEmailAlertToggleUI();
        }

        updateXValueDisplay(currentInterval);

        if (currentDataType === 'stock') {
          stockToggle.classList.add('active');
          usdJpyToggle.classList.remove('active');
          if (cryptoToggle) cryptoToggle.classList.remove('active');
          if (cryptoTickerListContainer) cryptoTickerListContainer.classList.add('hidden');
          updateIntervalOptions(stockIntervalOptions, intervalSelect.value);
          tickersInput.closest('.input-group').querySelector('label').textContent = '銘柄コード';
        } else if (currentDataType === 'crypto') {
          if (cryptoToggle) cryptoToggle.classList.add('active');
          stockToggle.classList.remove('active');
          usdJpyToggle.classList.remove('active');
          if (cryptoTickerListContainer) cryptoTickerListContainer.classList.remove('hidden');
          loadCryptoTickers();
          updateIntervalOptions(cryptoIntervalOptions, intervalSelect.value);
          tickersInput.closest('.input-group').querySelector('label').textContent = '通貨ペア';
        } else {
          usdJpyToggle.classList.add('active');
          stockToggle.classList.remove('active');
          if (cryptoToggle) cryptoToggle.classList.remove('active');
          if (cryptoTickerListContainer) cryptoTickerListContainer.classList.add('hidden');
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

// --- Authentication & X-Value Functions ---
function updateXValueDisplay(interval) {
  if (xValueControls.classList.contains('hidden')) return;

  updateXValueContextLabel();

  // ✅ stockタブではX値は使わない（誤保存防止）
  const supported = currentDataType === 'usd_jpy' || currentDataType === 'crypto';
  if (!supported) {
    setXValueUiEnabled(false);
    xValueIntervalLabel.textContent = interval;
    currentXValueSpan.textContent = 'このタブではしきい値は使用しません';
    xValueInput.value = '';
    return;
  }
  setXValueUiEnabled(true);

  const iv = interval;
  xValueIntervalLabel.textContent = iv;

  let v = null;
  if (currentDataType === 'crypto') {
    v = currentUserCryptoXValues?.[currentCryptoTicker]?.[iv];
  } else {
    v = getXValueForInterval(iv);
  }

  if (v == null) {
    currentXValueSpan.textContent = '現在の値: 未設定';
    xValueInput.value = '';
    return;
  }

  currentXValueSpan.textContent = `現在の値: ${formatValue(v)}`;
  xValueInput.value = formatValue(v);
}

async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/me');
    if (response.ok) {
      const data = await response.json();

      lsKeySuffix = String(data.user.id ?? data.user.email ?? 'guest');

      userInfoSpan.textContent = `ようこそ、${data.user.username}さん！`;
      currentUserEmail = data.user.email;
      userInfoSpan.classList.remove('hidden');
      loginButton.classList.add('hidden');
      registerButton.classList.add('hidden');
      logoutButton.classList.remove('hidden');
      xValueControls.classList.remove('hidden');

      if (emailAlertToggleContainer) emailAlertToggleContainer.classList.remove('hidden');
      if (emailAlertToggle) {
        emailAlertToggle.checked = true;
        updateEmailAlertToggleUI();
      }

      try {
        xValueInput.value = '';
        currentXValueSpan.textContent = '現在の値: 読み込み中...';
      } catch {}

      loadCrossHistoryFromLocalStorage();

      connectSocket();
      await loadUserSettings();
      try {
        socket?.emit('auth_sync');
      } catch {}
    } else {
      currentUserEmail = null;
      lsKeySuffix = 'guest';
      latestCrossPricesByInterval = {};
      latestEmaCrossPricesByInterval = {};
      currentUserXValues = {};
      currentUserCryptoXValues = {};
      clearCrossHistoryLocalStorage();

      if (emailAlertToggleContainer) emailAlertToggleContainer.classList.add('hidden');

      userInfoSpan.classList.add('hidden');
      loginButton.classList.remove('hidden');
      registerButton.classList.remove('hidden');
      logoutButton.classList.add('hidden');
      xValueControls.classList.add('hidden');
      connectSocket();
      start(currentDataType);
    }
  } catch (error) {
    currentUserEmail = null;
    lsKeySuffix = 'guest';
    latestCrossPricesByInterval = {};
    latestEmaCrossPricesByInterval = {};
    currentUserXValues = {};
    currentUserCryptoXValues = {};
    clearCrossHistoryLocalStorage();

    if (emailAlertToggleContainer) emailAlertToggleContainer.classList.add('hidden');

    console.error('Failed to check authentication status:', error);
    userInfoSpan.classList.add('hidden');
    loginButton.classList.remove('hidden');
    registerButton.classList.remove('hidden');
    logoutButton.classList.add('hidden');
    xValueControls.classList.add('hidden');
    connectSocket();
    start(currentDataType);
  }
}

async function handleLogout() {
  try {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    const data = await response.json();
    if (response.ok) {
      alert(data.message || 'ログアウトしました。');
      clearCrossHistoryLocalStorage();

      currentUserEmail = null;
      lsKeySuffix = 'guest';
      latestCrossPricesByInterval = {};
      latestEmaCrossPricesByInterval = {};
      currentUserXValues = {};
      currentUserCryptoXValues = {};
      xValueControls.classList.add('hidden');

      if (emailAlertToggleContainer) emailAlertToggleContainer.classList.add('hidden');

      await checkAuthStatus();
    } else {
      alert(data.error || 'ログアウトに失敗しました。');
    }
  } catch (error) {
    console.error('Network error during logout:', error);
    alert('ネットワークエラーが発生しました。ログアウトできませんでした。');
  }
}

logoutButton.addEventListener('click', handleLogout);

saveXValueButton.addEventListener('click', () => {
  const iv = intervalSelect.value;
  const raw = String(xValueInput.value ?? '').trim();
  const n = normalizeXValue(raw);

  if (raw !== '' && n == null) {
    alert('0より大きい数値を入力してください。（空欄は削除になります）');
    return;
  }

  if (currentDataType === 'crypto') {
    if (!currentUserCryptoXValues[currentCryptoTicker]) currentUserCryptoXValues[currentCryptoTicker] = {};
    if (n == null) {
      delete currentUserCryptoXValues[currentCryptoTicker][iv];
    } else {
      currentUserCryptoXValues[currentCryptoTicker][iv] = n;
    }
  } else {
    if (n == null) {
      delete currentUserXValues[iv];
    } else {
      currentUserXValues[iv] = n;
    }
  }

  updateXValueDisplay(iv);
  saveUserSettings();
});

xValueInput.addEventListener('blur', () => {
  const iv = intervalSelect.value;
  const raw = String(xValueInput.value ?? '').trim();

  if (raw === '') {
    if (currentDataType === 'crypto') {
      if (currentUserCryptoXValues?.[currentCryptoTicker]?.[iv]) {
        delete currentUserCryptoXValues[currentCryptoTicker][iv];
        updateXValueDisplay(iv);
        saveUserSettings();
      }
    } else {
      if (hasOwn(currentUserXValues, iv)) {
        delete currentUserXValues[iv];
        updateXValueDisplay(iv);
        saveUserSettings();
      }
    }
  }
});

deleteXValueButton.addEventListener('click', () => {
  const iv = intervalSelect.value;
  if (currentDataType === 'crypto') {
    if (currentUserCryptoXValues?.[currentCryptoTicker]?.[iv]) {
      delete currentUserCryptoXValues[currentCryptoTicker][iv];
    }
  } else {
    if (hasOwn(currentUserXValues, iv)) {
      delete currentUserXValues[iv];
    }
  }
  xValueInput.value = '';
  updateXValueDisplay(iv);
  saveUserSettings();
});

// =========================
// Socket connection (FIX)
// =========================
function connectSocket() {
  try {
    if (socket) socket.disconnect();
  } catch {}
  socket = io(window.location.origin, { withCredentials: true });

  socket.on('connect', () => {
    console.log('Connected to WebSocket server!');
    try {
      socket.emit('auth_sync');
    } catch {}
  });

  // ===== USDJPY cross events =====
  socket.on('bb_cross', async (data) => {
    console.log('BB Cross event received:', data);
    if (notificationElement) {
      notificationElement.textContent = data.message;
      notificationElement.classList.remove('hidden');
    }

    const iv = data.interval || currentInterval || intervalSelect.value || 'unknown';
    ensureIntervalMap(latestCrossPricesByInterval, iv)[data.bandName] = {
      price: data.price,
      interval: iv,
      timestamp: typeof data.timestamp === 'string' ? data.timestamp : null,
    };
    saveCrossHistoryToLocalStorage();

    refreshUsdJpyCrossHistoryUI();
    setTimeout(() => notificationElement?.classList.add('hidden'), 5000);
  });

  socket.on('ema_cross', async (data) => {
    console.log('EMA Cross event received:', data);
    if (notificationElement) {
      notificationElement.textContent = data.message;
      notificationElement.classList.remove('hidden');
    }

    const iv = data.interval || currentInterval || intervalSelect.value || 'unknown';
    ensureIntervalMap(latestEmaCrossPricesByInterval, iv)[data.emaName] = {
      price: data.price,
      interval: iv,
      timestamp: typeof data.timestamp === 'string' ? data.timestamp : null,
    };
    saveCrossHistoryToLocalStorage();

    refreshUsdJpyCrossHistoryUI();
    setTimeout(() => notificationElement?.classList.add('hidden'), 5000);
  });

  // ===== USDJPY clear event =====
  socket.on('cross_history_cleared', (data) => {
    try {
      const indicatorName = data?.indicatorName;
      const iv = data?.interval || currentInterval || intervalSelect.value || 'unknown';
      if (!indicatorName) return;

      if (String(indicatorName).startsWith('ema')) {
        ensureIntervalMap(latestEmaCrossPricesByInterval, iv)[String(indicatorName)] = null;
      } else {
        ensureIntervalMap(latestCrossPricesByInterval, iv)[String(indicatorName)] = null;
      }
      saveCrossHistoryToLocalStorage();
      refreshUsdJpyCrossHistoryUI();
    } catch (e) {
      console.warn('Failed to apply cross_history_cleared:', e);
    }
  });

  // ===== ✅ crypto cross events（ドル円crossHistoryに混ぜない）=====
  socket.on('crypto_bb_cross', (data) => {
    console.log('CRYPTO BB Cross event received:', data);
    if (notificationElement) {
      notificationElement.textContent = data.message;
      notificationElement.classList.remove('hidden');
      setTimeout(() => notificationElement?.classList.add('hidden'), 5000);
    }
    // cryptoの履歴表示は現状UI未実装（必要ならここで別stateに保存できる）
  });

  socket.on('crypto_ema_cross', (data) => {
    console.log('CRYPTO EMA Cross event received:', data);
    if (notificationElement) {
      notificationElement.textContent = data.message;
      notificationElement.classList.remove('hidden');
      setTimeout(() => notificationElement?.classList.add('hidden'), 5000);
    }
  });

  socket.on('crypto_cross_history_cleared', (data) => {
    // ✅ USDJPYの履歴は消さない（crypto専用クリア通知）
    console.log('CRYPTO cross history cleared:', data);
  });

  socket.on('usd_jpy_price_update', (data) => {
    usdJpyCurrentPrice = data.price;

    const usdJpyChartObj = chartObjects.find((obj) => obj?.ticker === 'USDJPY=X');
    if (usdJpyChartObj?.currentPriceValuesElement) {
      updateCurrentPriceValue(usdJpyChartObj.currentPriceValuesElement, [{ close: data.price }]);
    }
  });

  socket.on('disconnect', () => console.log('Disconnected from WebSocket server.'));
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
  if (currentDataType === 'stock') {
    stockToggle.classList.add('active');
    updateIntervalOptions(stockIntervalOptions, '1d');
  } else {
    usdJpyToggle.classList.add('active');
    updateIntervalOptions(usdJpyIntervalOptions, '1d');
  }

  updateTickerInputVisibility();
  await checkAuthStatus();
});
