const today = new Date();

const DEFAULTS = {
  apiKey: "demo",
  symbol: "IBM",
  frequency: "weekly",
  startingCapital: 10000,
  strategy: "sma",
  fastWindow: 10,
  slowWindow: 30,
  rsiPeriod: 14,
  oversold: 30,
  overbought: 70,
  breakoutLookback: 20,
};

const STRATEGY_DESCRIPTIONS = {
  "buy-hold": "Buy on the first bar and hold until the end of the selected range.",
  sma: "Enter when the fast moving average rises above the slow moving average, then exit when it falls back below.",
  rsi: "Enter after oversold momentum and exit after overbought momentum using the selected RSI thresholds.",
  breakout: "Enter on a close above the prior lookback high and exit on a close below the prior lookback low.",
};

const STRATEGY_NAMES = {
  "buy-hold": "Buy and hold",
  sma: "Moving average crossover",
  rsi: "RSI reversal",
  breakout: "Breakout",
};

const FREQUENCY_CONFIG = {
  daily: {
    label: "daily",
    functionName: "TIME_SERIES_DAILY",
    seriesKey: "Time Series (Daily)",
    priceKey: "4. close",
    note:
      "Daily data on standard Alpha Vantage keys is typically limited to the latest 100 bars. Use weekly or monthly for longer backtests.",
  },
  weekly: {
    label: "weekly",
    functionName: "TIME_SERIES_WEEKLY_ADJUSTED",
    seriesKey: "Weekly Adjusted Time Series",
    priceKey: "5. adjusted close",
    note:
      "Weekly adjusted data is better for multi-year backtests and handles long historical ranges more gracefully.",
  },
  monthly: {
    label: "monthly",
    functionName: "TIME_SERIES_MONTHLY_ADJUSTED",
    seriesKey: "Monthly Adjusted Time Series",
    priceKey: "5. adjusted close",
    note:
      "Monthly adjusted data is useful for long horizon tests measured over years or decades.",
  },
};

const COLORS = {
  strategy: "#f3c86a",
  benchmark: "#66dbc6",
  price: "#7ad8ff",
  fast: "#f3c86a",
  slow: "#ff8d7d",
  band: "#b79cff",
  buy: "#66dbc6",
  sell: "#ff8d7d",
  axis: "rgba(237, 244, 251, 0.72)",
  grid: "rgba(255, 255, 255, 0.08)",
};

const form = document.getElementById("backtest-form");
const resetButton = document.getElementById("resetButton");
const strategySelect = document.getElementById("strategySelect");
const frequencySelect = document.getElementById("frequencySelect");
const strategyDescription = document.getElementById("strategyDescription");
const statusBadge = document.getElementById("statusBadge");
const messageBanner = document.getElementById("messageBanner");
const tradeTableBody = document.getElementById("tradeTableBody");
const dataNote = document.getElementById("dataNote");
const insightText = document.getElementById("insightText");
const priceLegend = document.getElementById("priceLegend");
const equityLegend = document.getElementById("equityLegend");
const rangeButtons = [...document.querySelectorAll(".range-button")];
const strategyPanels = [...document.querySelectorAll("[data-strategy-panel]")];

const priceCanvas = document.getElementById("priceChart");
const equityCanvas = document.getElementById("equityChart");
const priceContext = priceCanvas.getContext("2d");
const equityContext = equityCanvas.getContext("2d");

const fields = {
  apiKey: document.getElementById("apiKeyInput"),
  symbol: document.getElementById("symbolInput"),
  frequency: frequencySelect,
  startDate: document.getElementById("startDateInput"),
  endDate: document.getElementById("endDateInput"),
  startingCapital: document.getElementById("startingCapitalInput"),
  strategy: strategySelect,
  fastWindow: document.getElementById("fastWindowInput"),
  slowWindow: document.getElementById("slowWindowInput"),
  rsiPeriod: document.getElementById("rsiPeriodInput"),
  oversold: document.getElementById("oversoldInput"),
  overbought: document.getElementById("overboughtInput"),
  breakoutLookback: document.getElementById("breakoutLookbackInput"),
};

const metricTargets = {
  strategyReturn: document.getElementById("strategyReturnMetric"),
  benchmarkReturn: document.getElementById("benchmarkReturnMetric"),
  finalValue: document.getElementById("finalValueMetric"),
  drawdown: document.getElementById("drawdownMetric"),
  tradeCount: document.getElementById("tradeCountMetric"),
  winRate: document.getElementById("winRateMetric"),
};

const noteTargets = {
  strategyReturn: document.getElementById("strategyReturnNote"),
  benchmarkReturn: document.getElementById("benchmarkReturnNote"),
  finalValue: document.getElementById("finalValueNote"),
  drawdown: document.getElementById("drawdownNote"),
  tradeCount: document.getElementById("tradeCountNote"),
  winRate: document.getElementById("winRateNote"),
};

const summaryTargets = {
  dataset: document.getElementById("datasetMetric"),
  range: document.getElementById("rangeMetric"),
  stance: document.getElementById("stanceMetric"),
};

const appState = {
  activeRangePreset: "5y",
  lastRenderPayload: null,
};

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subtractMonths(date, months) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() - months);
  return nextDate;
}

function subtractYears(date, years) {
  const nextDate = new Date(date);
  nextDate.setFullYear(nextDate.getFullYear() - years);
  return nextDate;
}

function formatCurrency(value, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

function formatSignedPercent(value, digits = 1) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateLabel(dateString, frequency) {
  const parsedDate = new Date(`${dateString}T00:00:00`);

  if (frequency === "monthly") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
    }).format(parsedDate);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
}

function setStatus(text, tone = "ready") {
  statusBadge.textContent = text;
  statusBadge.style.color =
    tone === "warning" ? "#f3c86a" : tone === "danger" ? "#ff8d7d" : "#66dbc6";
  statusBadge.style.background =
    tone === "warning"
      ? "rgba(243, 200, 106, 0.18)"
      : tone === "danger"
        ? "rgba(255, 141, 125, 0.14)"
        : "rgba(102, 219, 198, 0.18)";
}

function setMessage(text, tone = "info") {
  messageBanner.textContent = text;
  if (tone === "info") {
    messageBanner.removeAttribute("data-tone");
  } else {
    messageBanner.dataset.tone = tone;
  }
}

function setLegend(target, items) {
  target.innerHTML = items
    .map(
      (item) =>
        `<span class="legend-item"><span class="legend-swatch" style="background:${item.color}"></span>${item.label}</span>`
    )
    .join("");
}

function clearRangeButtons() {
  rangeButtons.forEach((button) => button.classList.remove("is-active"));
}

function activateRangeButton(preset) {
  appState.activeRangePreset = preset;
  rangeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.range === preset);
  });
}

function applyRangePreset(preset) {
  const endDate = fields.endDate.value ? new Date(`${fields.endDate.value}T00:00:00`) : new Date();
  let startDate = new Date(endDate);

  if (preset === "1m") {
    startDate = subtractMonths(endDate, 1);
  } else if (preset === "6m") {
    startDate = subtractMonths(endDate, 6);
  } else if (preset === "1y") {
    startDate = subtractYears(endDate, 1);
  } else if (preset === "3y") {
    startDate = subtractYears(endDate, 3);
  } else if (preset === "5y") {
    startDate = subtractYears(endDate, 5);
  } else {
    startDate = new Date("2000-01-01T00:00:00");
  }

  fields.startDate.value = toIsoDate(startDate);
  activateRangeButton(preset);
}

function updateStrategyPanels() {
  const strategy = fields.strategy.value;
  strategyDescription.textContent = STRATEGY_DESCRIPTIONS[strategy];
  strategyPanels.forEach((panel) => {
    panel.classList.toggle("is-visible", panel.dataset.strategyPanel === strategy);
  });
}

function updateDataNote() {
  dataNote.textContent = FREQUENCY_CONFIG[fields.frequency.value].note;
}

function applyDefaults() {
  fields.apiKey.value = DEFAULTS.apiKey;
  fields.symbol.value = DEFAULTS.symbol;
  fields.frequency.value = DEFAULTS.frequency;
  fields.endDate.value = toIsoDate(today);
  fields.startDate.value = toIsoDate(subtractYears(today, 5));
  fields.startingCapital.value = DEFAULTS.startingCapital;
  fields.strategy.value = DEFAULTS.strategy;
  fields.fastWindow.value = DEFAULTS.fastWindow;
  fields.slowWindow.value = DEFAULTS.slowWindow;
  fields.rsiPeriod.value = DEFAULTS.rsiPeriod;
  fields.oversold.value = DEFAULTS.oversold;
  fields.overbought.value = DEFAULTS.overbought;
  fields.breakoutLookback.value = DEFAULTS.breakoutLookback;

  updateStrategyPanels();
  updateDataNote();
  activateRangeButton("5y");
}

function resetMetrics() {
  metricTargets.strategyReturn.textContent = "0%";
  metricTargets.benchmarkReturn.textContent = "0%";
  metricTargets.finalValue.textContent = "$0";
  metricTargets.drawdown.textContent = "0%";
  metricTargets.tradeCount.textContent = "0";
  metricTargets.winRate.textContent = "0%";

  noteTargets.strategyReturn.textContent = "Compared with starting capital";
  noteTargets.benchmarkReturn.textContent = "Benchmark return for the same period";
  noteTargets.finalValue.textContent = "Ending value after all exits";
  noteTargets.drawdown.textContent = "Largest peak to trough decline";
  noteTargets.tradeCount.textContent = "Completed round trips";
  noteTargets.winRate.textContent = "Closed trades with positive profit";

  summaryTargets.dataset.textContent = "No data loaded";
  summaryTargets.range.textContent = "-";
  summaryTargets.stance.textContent = "Flat";

  insightText.textContent =
    "The app will summarize how the chosen strategy behaved once historical data is loaded.";
}

function resizeCanvas(canvas, context) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.getBoundingClientRect().width;
  const height = Math.max(220, width * 0.52);

  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(ratio, ratio);
}

function drawGrid(context, width, height, margin) {
  context.strokeStyle = COLORS.grid;
  context.lineWidth = 1;

  for (let step = 0; step <= 4; step += 1) {
    const y = margin + ((height - margin * 2) / 4) * step;
    context.beginPath();
    context.moveTo(margin, y);
    context.lineTo(width - margin, y);
    context.stroke();
  }

  for (let step = 0; step <= 5; step += 1) {
    const x = margin + ((width - margin * 2) / 5) * step;
    context.beginPath();
    context.moveTo(x, margin);
    context.lineTo(x, height - margin);
    context.stroke();
  }
}

function drawPlaceholder(canvas, context, text) {
  resizeCanvas(canvas, context);

  const width = canvas.getBoundingClientRect().width;
  const height = canvas.getBoundingClientRect().height;
  context.clearRect(0, 0, width, height);
  drawGrid(context, width, height, 34);
  context.fillStyle = COLORS.axis;
  context.font = '14px "Aptos", sans-serif';
  context.textAlign = "center";
  context.fillText(text, width / 2, height / 2);
  context.textAlign = "left";
}

function clearTradeTable() {
  tradeTableBody.innerHTML = `
    <tr class="empty-row">
      <td colspan="6">No trades yet.</td>
    </tr>
  `;
}

function resetOutputs() {
  resetMetrics();
  clearTradeTable();
  setLegend(priceLegend, [
    { label: "Close", color: COLORS.price },
    { label: "Buy", color: COLORS.buy },
    { label: "Sell", color: COLORS.sell },
  ]);
  setLegend(equityLegend, [
    { label: "Strategy", color: COLORS.strategy },
    { label: "Buy and hold", color: COLORS.benchmark },
  ]);
  drawPlaceholder(priceCanvas, priceContext, "Price chart will appear after a backtest runs.");
  drawPlaceholder(equityCanvas, equityContext, "Equity curve will appear after a backtest runs.");
  appState.lastRenderPayload = null;
}

function getConfigFromForm() {
  const config = {
    apiKey: fields.apiKey.value.trim() || "demo",
    symbol: fields.symbol.value.trim().toUpperCase(),
    frequency: fields.frequency.value,
    startDate: fields.startDate.value,
    endDate: fields.endDate.value,
    startingCapital: Number(fields.startingCapital.value),
    strategy: fields.strategy.value,
    fastWindow: Number(fields.fastWindow.value),
    slowWindow: Number(fields.slowWindow.value),
    rsiPeriod: Number(fields.rsiPeriod.value),
    oversold: Number(fields.oversold.value),
    overbought: Number(fields.overbought.value),
    breakoutLookback: Number(fields.breakoutLookback.value),
  };

  if (!config.symbol) {
    throw new Error("Enter a stock symbol before running the backtest.");
  }

  if (!config.startDate || !config.endDate) {
    throw new Error("Choose both a start date and an end date.");
  }

  if (config.startDate > config.endDate) {
    throw new Error("The start date must be earlier than the end date.");
  }

  if (!Number.isFinite(config.startingCapital) || config.startingCapital <= 0) {
    throw new Error("Starting capital must be a positive number.");
  }

  if (config.strategy === "sma" && config.slowWindow <= config.fastWindow) {
    throw new Error("For the moving average strategy, the slow SMA must be greater than the fast SMA.");
  }

  if (config.strategy === "rsi" && config.overbought <= config.oversold) {
    throw new Error("For the RSI strategy, the overbought level must be greater than the oversold level.");
  }

  return config;
}

function getSeriesKey(payload, fallbackKey) {
  if (payload[fallbackKey]) {
    return fallbackKey;
  }

  return Object.keys(payload).find((key) => key.includes("Time Series"));
}

async function fetchHistoricalSeries(config) {
  if (config.apiKey.toLowerCase() === "demo" && config.symbol !== "IBM") {
    throw new Error("The Alpha Vantage demo key only supports IBM. Enter your own API key for other symbols.");
  }

  const endpointConfig = FREQUENCY_CONFIG[config.frequency];
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", endpointConfig.functionName);
  url.searchParams.set("symbol", config.symbol);
  url.searchParams.set("apikey", config.apiKey);
  url.searchParams.set("datatype", "json");

  if (config.frequency === "daily") {
    url.searchParams.set("outputsize", "compact");
  }

  let response;
  try {
    response = await fetch(url.toString());
  } catch (error) {
    throw new Error(
      "The browser could not reach Alpha Vantage. If you opened this page from file:// and the request is blocked, try serving the folder with a small local web server."
    );
  }

  if (!response.ok) {
    throw new Error(`The market data request failed with status ${response.status}.`);
  }

  const payload = await response.json();

  if (payload["Error Message"]) {
    throw new Error("The symbol was not recognized by Alpha Vantage. Double-check the ticker and exchange suffix.");
  }

  if (payload.Note) {
    throw new Error(payload.Note);
  }

  if (payload.Information) {
    throw new Error(payload.Information);
  }

  const seriesKey = getSeriesKey(payload, endpointConfig.seriesKey);

  if (!seriesKey || !payload[seriesKey]) {
    throw new Error("No time series data was returned. Try a different frequency or verify the API key.");
  }

  const series = Object.entries(payload[seriesKey])
    .map(([date, row]) => ({
      date,
      open: Number(row["1. open"]),
      high: Number(row["2. high"]),
      low: Number(row["3. low"]),
      close: Number(row[endpointConfig.priceKey] ?? row["4. close"]),
      volume: Number(row["6. volume"] ?? row["5. volume"] ?? 0),
    }))
    .filter((bar) => [bar.open, bar.high, bar.low, bar.close].every((value) => Number.isFinite(value)))
    .sort((left, right) => left.date.localeCompare(right.date));

  const filteredSeries = series.filter((bar) => bar.date >= config.startDate && bar.date <= config.endDate);

  if (filteredSeries.length < 2) {
    const availableStart = series[0]?.date ?? "unknown";
    const availableEnd = series[series.length - 1]?.date ?? "unknown";
    throw new Error(
      `No data was available inside the selected range. Available data spans ${availableStart} to ${availableEnd}.`
    );
  }

  let coverageNote = `Loaded ${formatNumber(filteredSeries.length)} ${endpointConfig.label} bars for ${config.symbol}.`;
  if (config.frequency === "daily" && config.startDate < (series[0]?.date ?? config.startDate)) {
    coverageNote += " The daily endpoint on standard keys usually returns only the latest 100 bars.";
  }

  return {
    meta: payload["Meta Data"] ?? {},
    coverageNote,
    series: filteredSeries,
  };
}

function calculateSMA(values, period) {
  const result = Array(values.length).fill(null);
  let rollingSum = 0;

  for (let index = 0; index < values.length; index += 1) {
    rollingSum += values[index];
    if (index >= period) {
      rollingSum -= values[index - period];
    }
    if (index >= period - 1) {
      result[index] = rollingSum / period;
    }
  }

  return result;
}

function calculateRSI(values, period) {
  const result = Array(values.length).fill(null);

  if (values.length <= period) {
    return result;
  }

  let gainSum = 0;
  let lossSum = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    gainSum += Math.max(change, 0);
    lossSum += Math.max(-change, 0);
  }

  let averageGain = gainSum / period;
  let averageLoss = lossSum / period;
  result[period] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    result[index] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }

  return result;
}

function calculateBreakoutBands(series, lookback) {
  const upperBand = Array(series.length).fill(null);
  const lowerBand = Array(series.length).fill(null);

  for (let index = lookback; index < series.length; index += 1) {
    const window = series.slice(index - lookback, index);
    upperBand[index] = Math.max(...window.map((bar) => bar.high));
    lowerBand[index] = Math.min(...window.map((bar) => bar.low));
  }

  return { upperBand, lowerBand };
}

function buildIndicators(series, config) {
  const closes = series.map((bar) => bar.close);

  if (config.strategy === "sma") {
    return {
      fast: calculateSMA(closes, config.fastWindow),
      slow: calculateSMA(closes, config.slowWindow),
    };
  }

  if (config.strategy === "rsi") {
    return {
      rsi: calculateRSI(closes, config.rsiPeriod),
    };
  }

  if (config.strategy === "breakout") {
    return calculateBreakoutBands(series, config.breakoutLookback);
  }

  return {};
}

function calculateBenchmark(series, startingCapital) {
  const benchmarkShares = startingCapital / series[0].close;
  const equityCurve = series.map((bar) => ({
    date: bar.date,
    value: benchmarkShares * bar.close,
  }));

  return {
    equityCurve,
    finalValue: equityCurve[equityCurve.length - 1].value,
  };
}

function calculateMaxDrawdown(equityCurve) {
  let peak = equityCurve[0]?.value ?? 0;
  let worstDrawdown = 0;

  equityCurve.forEach((point) => {
    if (point.value > peak) {
      peak = point.value;
    }
    const drawdown = peak === 0 ? 0 : ((point.value - peak) / peak) * 100;
    if (drawdown < worstDrawdown) {
      worstDrawdown = drawdown;
    }
  });

  return worstDrawdown;
}

function runBacktest(config, series) {
  const indicators = buildIndicators(series, config);
  const benchmark = calculateBenchmark(series, config.startingCapital);
  const trades = [];
  const markers = [];
  const equityCurve = [];

  let cash = config.startingCapital;
  let shares = 0;
  let openTrade = null;
  let livePositionOnLastBar = false;

  function enterTrade(bar, index) {
    if (cash <= 0) {
      return;
    }

    shares = cash / bar.close;
    openTrade = {
      entryDate: bar.date,
      entryPrice: bar.close,
      shares,
      entryValue: cash,
    };
    cash = 0;
    markers.push({
      index,
      type: "buy",
      date: bar.date,
      price: bar.close,
    });
  }

  function exitTrade(bar, index) {
    if (!openTrade || shares <= 0) {
      return;
    }

    const exitValue = shares * bar.close;
    const pnl = exitValue - openTrade.entryValue;
    const returnPct = (bar.close / openTrade.entryPrice - 1) * 100;
    cash = exitValue;

    trades.push({
      entryDate: openTrade.entryDate,
      exitDate: bar.date,
      entryPrice: openTrade.entryPrice,
      exitPrice: bar.close,
      pnl,
      returnPct,
    });

    markers.push({
      index,
      type: "sell",
      date: bar.date,
      price: bar.close,
    });

    shares = 0;
    openTrade = null;
  }

  for (let index = 0; index < series.length; index += 1) {
    const bar = series[index];
    const previousFast = indicators.fast?.[index - 1] ?? null;
    const previousSlow = indicators.slow?.[index - 1] ?? null;
    const fast = indicators.fast?.[index] ?? null;
    const slow = indicators.slow?.[index] ?? null;
    const rsi = indicators.rsi?.[index] ?? null;
    const upperBand = indicators.upperBand?.[index] ?? null;
    const lowerBand = indicators.lowerBand?.[index] ?? null;

    let shouldEnter = false;
    let shouldExit = false;

    if (config.strategy === "buy-hold") {
      shouldEnter = index === 0;
    } else if (config.strategy === "sma") {
      shouldEnter = shares === 0 && fast !== null && slow !== null && fast > slow && (previousFast === null || previousSlow === null || previousFast <= previousSlow);
      shouldExit = shares > 0 && fast !== null && slow !== null && fast <= slow;
    } else if (config.strategy === "rsi") {
      shouldEnter = shares === 0 && rsi !== null && rsi < config.oversold;
      shouldExit = shares > 0 && rsi !== null && rsi > config.overbought;
    } else if (config.strategy === "breakout") {
      shouldEnter = shares === 0 && upperBand !== null && bar.close > upperBand;
      shouldExit = shares > 0 && lowerBand !== null && bar.close < lowerBand;
    }

    if (shouldExit) {
      exitTrade(bar, index);
    }

    if (shouldEnter && shares === 0) {
      enterTrade(bar, index);
    }

    equityCurve.push({
      date: bar.date,
      value: cash + shares * bar.close,
    });
  }

  livePositionOnLastBar = shares > 0;

  if (shares > 0) {
    const lastBar = series[series.length - 1];
    exitTrade(lastBar, series.length - 1);
    equityCurve[equityCurve.length - 1].value = cash;
  }

  const finalValue = equityCurve[equityCurve.length - 1]?.value ?? config.startingCapital;
  const strategyReturn = (finalValue / config.startingCapital - 1) * 100;
  const benchmarkReturn = (benchmark.finalValue / config.startingCapital - 1) * 100;
  const winRate =
    trades.length === 0 ? 0 : (trades.filter((trade) => trade.pnl > 0).length / trades.length) * 100;

  return {
    series,
    indicators,
    trades,
    markers,
    equityCurve,
    benchmarkCurve: benchmark.equityCurve,
    livePositionOnLastBar,
    stats: {
      strategyReturn,
      benchmarkReturn,
      finalValue,
      maxDrawdown: calculateMaxDrawdown(equityCurve),
      tradeCount: trades.length,
      winRate,
    },
  };
}

function drawLineSeries(context, values, projectX, projectY, color, lineWidth = 2) {
  let started = false;
  context.beginPath();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;

  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      started = false;
      return;
    }

    const x = projectX(index);
    const y = projectY(value);

    if (!started) {
      context.moveTo(x, y);
      started = true;
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();
}

function drawSignalMarker(context, x, y, type) {
  context.save();
  context.beginPath();

  if (type === "buy") {
    context.fillStyle = COLORS.buy;
    context.moveTo(x, y - 7);
    context.lineTo(x - 6, y + 5);
    context.lineTo(x + 6, y + 5);
  } else {
    context.fillStyle = COLORS.sell;
    context.moveTo(x, y + 7);
    context.lineTo(x - 6, y - 5);
    context.lineTo(x + 6, y - 5);
  }

  context.closePath();
  context.fill();
  context.restore();
}

function writeChartLabels(
  context,
  width,
  height,
  margin,
  minValue,
  maxValue,
  startLabel,
  endLabel,
  valueFormatter = (value) => formatCurrency(value)
) {
  context.fillStyle = COLORS.axis;
  context.font = '12px "Aptos", sans-serif';
  context.fillText(startLabel, margin + 78, height - margin + 18);
  context.fillText(endLabel, width - margin - 90, height - margin + 18);
  context.fillText(valueFormatter(maxValue), margin, margin - 12);
  context.fillText(valueFormatter(minValue), margin, height - margin - 8);
}

function drawPriceChart(result, config) {
  resizeCanvas(priceCanvas, priceContext);

  const width = priceCanvas.getBoundingClientRect().width;
  const height = priceCanvas.getBoundingClientRect().height;
  const margin = 36;
  const series = result.series;
  const usableWidth = width - margin * 2;
  const usableHeight = height - margin * 2;

  const priceValues = [...series.map((bar) => bar.close)];
  if (result.indicators.fast) {
    priceValues.push(...result.indicators.fast.filter((value) => value !== null));
    priceValues.push(...result.indicators.slow.filter((value) => value !== null));
  }
  if (result.indicators.upperBand) {
    priceValues.push(...result.indicators.upperBand.filter((value) => value !== null));
    priceValues.push(...result.indicators.lowerBand.filter((value) => value !== null));
  }

  const minValue = Math.min(...priceValues);
  const maxValue = Math.max(...priceValues);

  const projectX = (index) => margin + (index / Math.max(series.length - 1, 1)) * usableWidth;
  const projectY = (value) =>
    height - margin - ((value - minValue) / (maxValue - minValue || 1)) * usableHeight;

  priceContext.clearRect(0, 0, width, height);
  drawGrid(priceContext, width, height, margin);
  drawLineSeries(
    priceContext,
    series.map((bar) => bar.close),
    projectX,
    projectY,
    COLORS.price,
    2.5
  );

  if (result.indicators.fast) {
    drawLineSeries(priceContext, result.indicators.fast, projectX, projectY, COLORS.fast, 1.8);
    drawLineSeries(priceContext, result.indicators.slow, projectX, projectY, COLORS.slow, 1.8);
  }

  if (result.indicators.upperBand) {
    drawLineSeries(priceContext, result.indicators.upperBand, projectX, projectY, COLORS.band, 1.5);
    drawLineSeries(priceContext, result.indicators.lowerBand, projectX, projectY, COLORS.band, 1.5);
  }

  result.markers.forEach((marker) => {
    drawSignalMarker(priceContext, projectX(marker.index), projectY(marker.price), marker.type);
  });

  writeChartLabels(
    priceContext,
    width,
    height,
    margin,
    minValue,
    maxValue,
    formatDateLabel(series[0].date, config.frequency),
    formatDateLabel(series[series.length - 1].date, config.frequency),
    (value) => formatCurrency(value, 2)
  );

  const legendItems = [
    { label: "Close", color: COLORS.price },
    { label: "Buy", color: COLORS.buy },
    { label: "Sell", color: COLORS.sell },
  ];

  if (result.indicators.fast) {
    legendItems.push({ label: "Fast SMA", color: COLORS.fast });
    legendItems.push({ label: "Slow SMA", color: COLORS.slow });
  }

  if (result.indicators.upperBand) {
    legendItems.push({ label: "Breakout bands", color: COLORS.band });
  }

  setLegend(priceLegend, legendItems);
}

function drawEquityChart(result, config) {
  resizeCanvas(equityCanvas, equityContext);

  const width = equityCanvas.getBoundingClientRect().width;
  const height = equityCanvas.getBoundingClientRect().height;
  const margin = 36;
  const usableWidth = width - margin * 2;
  const usableHeight = height - margin * 2;

  const values = [
    ...result.equityCurve.map((point) => point.value),
    ...result.benchmarkCurve.map((point) => point.value),
  ];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  const projectX = (index) =>
    margin + (index / Math.max(result.equityCurve.length - 1, 1)) * usableWidth;
  const projectY = (value) =>
    height - margin - ((value - minValue) / (maxValue - minValue || 1)) * usableHeight;

  equityContext.clearRect(0, 0, width, height);
  drawGrid(equityContext, width, height, margin);
  drawLineSeries(
    equityContext,
    result.benchmarkCurve.map((point) => point.value),
    projectX,
    projectY,
    COLORS.benchmark,
    2
  );
  drawLineSeries(
    equityContext,
    result.equityCurve.map((point) => point.value),
    projectX,
    projectY,
    COLORS.strategy,
    2.7
  );

  writeChartLabels(
    equityContext,
    width,
    height,
    margin,
    minValue,
    maxValue,
    formatDateLabel(result.equityCurve[0].date, config.frequency),
    formatDateLabel(result.equityCurve[result.equityCurve.length - 1].date, config.frequency)
  );

  setLegend(equityLegend, [
    { label: "Strategy", color: COLORS.strategy },
    { label: "Buy and hold", color: COLORS.benchmark },
  ]);
}

function renderTradeTable(trades) {
  if (!trades.length) {
    clearTradeTable();
    return;
  }

  tradeTableBody.innerHTML = trades
    .map((trade) => {
      const returnClass = trade.returnPct >= 0 ? "positive-text" : "negative-text";
      const pnlClass = trade.pnl >= 0 ? "positive-text" : "negative-text";
      return `
        <tr>
          <td>${trade.entryDate}</td>
          <td>${trade.exitDate}</td>
          <td>${formatCurrency(trade.entryPrice, 2)}</td>
          <td>${formatCurrency(trade.exitPrice, 2)}</td>
          <td class="${returnClass}">${formatSignedPercent(trade.returnPct, 1)}</td>
          <td class="${pnlClass}">${trade.pnl >= 0 ? "+" : ""}${formatCurrency(trade.pnl)}</td>
        </tr>
      `;
    })
    .join("");
}

function updateMetrics(config, dataPayload, result) {
  const outperformance = result.stats.strategyReturn - result.stats.benchmarkReturn;
  const yearsInRange =
    (new Date(`${result.series[result.series.length - 1].date}T00:00:00`) -
      new Date(`${result.series[0].date}T00:00:00`)) /
    (1000 * 60 * 60 * 24 * 365.25);
  const strategyLabel = STRATEGY_NAMES[config.strategy] ?? "Strategy";

  metricTargets.strategyReturn.textContent = formatSignedPercent(result.stats.strategyReturn, 1);
  metricTargets.benchmarkReturn.textContent = formatSignedPercent(result.stats.benchmarkReturn, 1);
  metricTargets.finalValue.textContent = formatCurrency(result.stats.finalValue);
  metricTargets.drawdown.textContent = formatPercent(result.stats.maxDrawdown, 1);
  metricTargets.tradeCount.textContent = formatNumber(result.stats.tradeCount);
  metricTargets.winRate.textContent = formatPercent(result.stats.winRate, 0);

  noteTargets.strategyReturn.textContent =
    outperformance >= 0
      ? `Outperformed buy and hold by ${formatPercent(outperformance, 1)}`
      : `Lagged buy and hold by ${formatPercent(Math.abs(outperformance), 1)}`;
  noteTargets.benchmarkReturn.textContent = "Same symbol and date range benchmark";
  noteTargets.finalValue.textContent = `Started with ${formatCurrency(config.startingCapital)}`;
  noteTargets.drawdown.textContent = `Largest decline during ${yearsInRange >= 1 ? `${yearsInRange.toFixed(1)} years` : "the selected period"}`;
  noteTargets.tradeCount.textContent = "Long only and fully invested when in position";
  noteTargets.winRate.textContent =
    result.stats.tradeCount === 0 ? "No completed trades were generated" : "Closed trades with positive PnL";

  summaryTargets.dataset.textContent = `${config.symbol} - ${config.frequency} - ${formatNumber(result.series.length)} bars`;
  summaryTargets.range.textContent = `${formatDateLabel(result.series[0].date, config.frequency)} to ${formatDateLabel(result.series[result.series.length - 1].date, config.frequency)}`;
  summaryTargets.stance.textContent = result.livePositionOnLastBar ? "Would be long on last bar" : "Flat on last bar";

  const outperformanceLabel = outperformance >= 0 ? "outperformed" : "lagged";
  insightText.textContent =
    `${strategyLabel} on ${config.symbol} returned ${formatSignedPercent(result.stats.strategyReturn, 1)} across ${formatNumber(result.series.length)} ${config.frequency} bars. It ${outperformanceLabel} buy and hold by ${formatPercent(Math.abs(outperformance), 1)} with a maximum drawdown of ${formatPercent(result.stats.maxDrawdown, 1)}. ${result.stats.tradeCount > 0 ? `${formatNumber(result.stats.tradeCount)} trades closed with a ${formatPercent(result.stats.winRate, 0)} win rate.` : "No completed trades fired in the selected range."} Signals execute on the bar close with no transaction costs or slippage included.`;

  setMessage(dataPayload.coverageNote, "success");
}

async function handleBacktest() {
  let config;

  try {
    config = getConfigFromForm();
  } catch (error) {
    setStatus("Fix inputs", "danger");
    setMessage(error.message, "danger");
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setStatus("Loading data", "warning");
  setMessage("Fetching historical market data from Alpha Vantage...", "warning");

  try {
    const dataPayload = await fetchHistoricalSeries(config);
    const result = runBacktest(config, dataPayload.series);

    updateMetrics(config, dataPayload, result);
    renderTradeTable(result.trades);
    drawPriceChart(result, config);
    drawEquityChart(result, config);

    appState.lastRenderPayload = { config, result };
    setStatus("Backtest ready");
  } catch (error) {
    setStatus("Load failed", "danger");
    setMessage(error.message, "danger");
  } finally {
    submitButton.disabled = false;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleBacktest();
});

resetButton.addEventListener("click", () => {
  applyDefaults();
  resetOutputs();
  setStatus("Ready");
  setMessage("Defaults restored. Run the backtest to fetch real historical data.");
});

strategySelect.addEventListener("change", () => {
  updateStrategyPanels();
});

frequencySelect.addEventListener("change", () => {
  updateDataNote();
});

rangeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyRangePreset(button.dataset.range);
  });
});

[fields.startDate, fields.endDate].forEach((input) => {
  input.addEventListener("input", () => {
    clearRangeButtons();
    appState.activeRangePreset = null;
  });
});

window.addEventListener("resize", () => {
  if (!appState.lastRenderPayload) {
    drawPlaceholder(priceCanvas, priceContext, "Price chart will appear after a backtest runs.");
    drawPlaceholder(equityCanvas, equityContext, "Equity curve will appear after a backtest runs.");
    return;
  }

  drawPriceChart(appState.lastRenderPayload.result, appState.lastRenderPayload.config);
  drawEquityChart(appState.lastRenderPayload.result, appState.lastRenderPayload.config);
});

applyDefaults();
resetOutputs();
setStatus("Ready");
setMessage("Defaults loaded with IBM demo settings. Click Run Backtest to fetch data.");
