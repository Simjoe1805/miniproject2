'use strict';

// ── Global state ──────────────────────────────────────────────────────────
let stockData = null;   // holds last analysis result
let chartInstances = {}; // Chart.js instances keyed by id
let pdfRawText   = '';   // full text extracted from annual report PDF
let pdfSections  = [];   // parsed sections: [{title, body, startChar}]
let pdfFileName  = '';

// ── Sample data (AAPL weekly 2023) ───────────────────────────────────────
const SAMPLE = {
  companyName: 'Apple Inc.',
  tickerSymbol: 'AAPL',
  sector: 'Technology',
  marketCap: 2850,
  currentPrice: 185.92,
  weekHigh52: 199.62,
  weekLow52: 164.08,
  peRatio: 28.9,
  forwardPE: 25.4,
  pbRatio: 44.2,
  eps: 6.43,
  beta: 1.25,
  revenueGrowth: 2.1,
  grossMargin: 45.5,
  netMargin: 25.3,
  roe: 147.9,
  roa: 28.9,
  debtEquity: 1.51,
  currentRatio: 1.07,
  dividendYield: 0.53,
  priceHistory: [
    { date: '2023-01-06', price: 129.62 }, { date: '2023-01-13', price: 134.76 },
    { date: '2023-01-20', price: 141.91 }, { date: '2023-01-27', price: 145.93 },
    { date: '2023-02-03', price: 150.82 }, { date: '2023-02-10', price: 155.33 },
    { date: '2023-02-17', price: 152.55 }, { date: '2023-02-24', price: 147.92 },
    { date: '2023-03-03', price: 151.03 }, { date: '2023-03-10', price: 148.48 },
    { date: '2023-03-17', price: 155.00 }, { date: '2023-03-24', price: 160.25 },
    { date: '2023-03-31', price: 164.90 }, { date: '2023-04-07', price: 162.36 },
    { date: '2023-04-14', price: 165.79 }, { date: '2023-04-21', price: 166.65 },
    { date: '2023-04-28', price: 169.68 }, { date: '2023-05-05', price: 174.20 },
    { date: '2023-05-12', price: 172.57 }, { date: '2023-05-19', price: 175.16 },
    { date: '2023-05-26', price: 175.43 }, { date: '2023-06-02', price: 180.57 },
    { date: '2023-06-09', price: 180.95 }, { date: '2023-06-16', price: 184.92 },
    { date: '2023-06-23', price: 186.68 }, { date: '2023-06-30', price: 189.59 },
    { date: '2023-07-07', price: 190.68 }, { date: '2023-07-14', price: 190.54 },
    { date: '2023-07-21', price: 191.33 }, { date: '2023-07-28', price: 192.58 },
    { date: '2023-08-04', price: 178.19 }, { date: '2023-08-11', price: 177.79 },
    { date: '2023-08-18', price: 175.84 }, { date: '2023-08-25', price: 178.61 },
    { date: '2023-09-01', price: 189.30 }, { date: '2023-09-08', price: 178.18 },
    { date: '2023-09-15', price: 175.01 }, { date: '2023-09-22', price: 171.96 },
    { date: '2023-09-29', price: 171.21 }, { date: '2023-10-06', price: 177.49 },
    { date: '2023-10-13', price: 178.85 }, { date: '2023-10-20', price: 173.44 },
    { date: '2023-10-27', price: 168.22 }, { date: '2023-11-03', price: 176.65 },
    { date: '2023-11-10', price: 182.41 }, { date: '2023-11-17', price: 189.69 },
    { date: '2023-11-24', price: 189.97 }, { date: '2023-12-01', price: 191.24 },
    { date: '2023-12-08', price: 195.71 }, { date: '2023-12-15', price: 197.57 },
    { date: '2023-12-22', price: 193.60 }, { date: '2023-12-29', price: 192.53 },
    { date: '2024-01-05', price: 181.18 }, { date: '2024-01-12', price: 185.92 },
  ],
};

// ── Chart.js global defaults ──────────────────────────────────────────────
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(148,163,184,.1)';
Chart.defaults.font.family = '"Segoe UI", system-ui, sans-serif';
Chart.defaults.font.size = 11;

// ── Tab switching ─────────────────────────────────────────────────────────
function switchTab(id) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  document.querySelector(`.nav-tab[data-tab="${id}"]`).classList.add('active');
}

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Price-data input sub-tabs ─────────────────────────────────────────────
document.querySelectorAll('.pill-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const parent = btn.closest('.card') || btn.closest('.pill-tabs').parentElement;
    parent.querySelectorAll('.pill-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.inputTab;
    parent.querySelectorAll('.input-tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === target + '-input');
    });
  });
});

// ── Manual price rows ────────────────────────────────────────────────────
function createPriceRow(date = '', price = '', volume = '') {
  const row = document.createElement('div');
  row.className = 'price-entry-row';
  row.innerHTML = `
    <input type="date" value="${date}">
    <input type="number" step="0.01" placeholder="0.00" value="${price}">
    <input type="number" placeholder="optional" value="${volume}">
    <button class="btn-icon-remove" title="Remove">✕</button>
  `;
  row.querySelector('.btn-icon-remove').addEventListener('click', () => row.remove());
  return row;
}

document.getElementById('addRowBtn').addEventListener('click', () => {
  document.getElementById('priceRows').appendChild(createPriceRow());
});

// Seed one empty row on load
document.getElementById('priceRows').appendChild(createPriceRow());

// ── CSV parsing ──────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const rows = [];
  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim());
    if (parts.length < 2) continue;
    const dateStr = parts[0];
    const price = parseFloat(parts[1]);
    if (!dateStr || isNaN(price)) continue;
    // skip header row
    if (isNaN(price) || parts[1].toLowerCase().includes('price')) continue;
    const volume = parts[2] ? parseFloat(parts[2]) : undefined;
    rows.push({ date: dateStr, price, ...(volume !== undefined && !isNaN(volume) ? { volume } : {}) });
  }
  return rows;
}

document.getElementById('parseCSVBtn').addEventListener('click', () => {
  const text = document.getElementById('csvData').value;
  const rows = parseCSV(text);
  if (rows.length === 0) {
    showBadge(`Could not parse CSV — check format`, false);
    return;
  }
  showBadge(`${rows.length} rows parsed successfully`, true);
});

function showBadge(text, ok) {
  const badge = document.getElementById('dataBadge');
  const span = document.getElementById('dataBadgeText');
  badge.style.display = 'inline-flex';
  badge.style.background = ok ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)';
  badge.style.borderColor = ok ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)';
  badge.style.color = ok ? '#6ee7b7' : '#fca5a5';
  span.textContent = text;
}

// ── Collect form data ─────────────────────────────────────────────────────
function getNum(id) {
  const v = parseFloat(document.getElementById(id).value);
  return isNaN(v) ? null : v;
}
function getStr(id) {
  return document.getElementById(id).value.trim() || null;
}

function collectInputs() {
  // Price history: CSV tab or manual rows
  let priceHistory = [];
  const csvPanel = document.getElementById('csv-input');
  if (csvPanel.classList.contains('active')) {
    priceHistory = parseCSV(document.getElementById('csvData').value);
  } else {
    document.querySelectorAll('.price-entry-row').forEach(row => {
      const inputs = row.querySelectorAll('input');
      const date = inputs[0].value;
      const price = parseFloat(inputs[1].value);
      if (date && !isNaN(price)) priceHistory.push({ date, price });
    });
  }

  return {
    companyName: getStr('companyName'),
    tickerSymbol: getStr('tickerSymbol'),
    sector: getStr('sectorSelect'),
    marketCap: getNum('marketCap'),
    currentPrice: getNum('currentPrice'),
    weekHigh52: getNum('weekHigh52'),
    weekLow52: getNum('weekLow52'),
    peRatio: getNum('peRatio'),
    forwardPE: getNum('forwardPE'),
    pbRatio: getNum('pbRatio'),
    eps: getNum('eps'),
    beta: getNum('beta'),
    revenueGrowth: getNum('revenueGrowth'),
    grossMargin: getNum('grossMargin'),
    netMargin: getNum('netMargin'),
    roe: getNum('roe'),
    roa: getNum('roa'),
    debtEquity: getNum('debtEquity'),
    currentRatio: getNum('currentRatio'),
    dividendYield: getNum('dividendYield'),
    priceHistory,
  };
}

// ── Analysis engine ──────────────────────────────────────────────────────

function movingAverage(prices, window) {
  return prices.map((_, i) => {
    if (i < window - 1) return null;
    const slice = prices.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / window;
  });
}

function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return prices.map(() => null);
  const rsi = Array(prices.length).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function annualizedVolatility(prices) {
  if (prices.length < 2) return null;
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const periodsPerYear = prices.length > 200 ? 252 : prices.length > 50 ? 52 : 12;
  return Math.sqrt(variance * periodsPerYear) * 100;
}

function scoreColor(score) {
  if (score >= 70) return 'green';
  if (score >= 45) return 'amber';
  return 'red';
}

function calcValuationScore(pe, forwardPE, pb) {
  let score = 50;
  if (pe !== null) {
    if (pe <= 15) score += 30;
    else if (pe <= 20) score += 20;
    else if (pe <= 30) score += 5;
    else if (pe <= 40) score -= 10;
    else score -= 25;
  }
  if (forwardPE !== null && pe !== null && forwardPE < pe) score += 8;
  if (pb !== null) {
    if (pb <= 2) score += 10;
    else if (pb <= 5) score += 2;
    else if (pb > 20) score -= 8;
  }
  return Math.min(100, Math.max(0, score));
}

function calcGrowthScore(revGrowth, grossMargin, netMargin) {
  let score = 40;
  if (revGrowth !== null) {
    if (revGrowth >= 25) score += 35;
    else if (revGrowth >= 15) score += 25;
    else if (revGrowth >= 8) score += 15;
    else if (revGrowth >= 3) score += 5;
    else if (revGrowth < 0) score -= 20;
  }
  if (netMargin !== null) {
    if (netMargin >= 25) score += 15;
    else if (netMargin >= 15) score += 8;
    else if (netMargin >= 5) score += 2;
    else score -= 10;
  }
  if (grossMargin !== null && grossMargin >= 40) score += 5;
  return Math.min(100, Math.max(0, score));
}

function calcHealthScore(debtEquity, currentRatio, roe) {
  let score = 50;
  if (debtEquity !== null) {
    if (debtEquity <= 0.3) score += 25;
    else if (debtEquity <= 0.8) score += 15;
    else if (debtEquity <= 1.5) score += 5;
    else if (debtEquity <= 3) score -= 10;
    else score -= 25;
  }
  if (currentRatio !== null) {
    if (currentRatio >= 2) score += 15;
    else if (currentRatio >= 1.5) score += 8;
    else if (currentRatio >= 1) score += 2;
    else score -= 15;
  }
  if (roe !== null) {
    if (roe >= 20) score += 10;
    else if (roe >= 10) score += 5;
    else score -= 5;
  }
  return Math.min(100, Math.max(0, score));
}

function calcMomentumScore(priceHistory) {
  if (!priceHistory || priceHistory.length < 5) return 50;
  const prices = priceHistory.map(p => p.price);
  const first = prices[0], last = prices[prices.length - 1];
  const totalReturn = (last - first) / first * 100;
  let score = 50;
  if (totalReturn > 50) score += 40;
  else if (totalReturn > 20) score += 25;
  else if (totalReturn > 5) score += 10;
  else if (totalReturn > -5) score += 0;
  else if (totalReturn > -20) score -= 15;
  else score -= 30;

  // recent momentum: last 10% vs whole
  const cut = Math.max(1, Math.floor(prices.length * 0.1));
  const recentReturn = (last - prices[prices.length - 1 - cut]) / prices[prices.length - 1 - cut] * 100;
  if (recentReturn > 5) score += 10;
  else if (recentReturn < -5) score -= 10;

  return Math.min(100, Math.max(0, score));
}

function calcIncomeScore(dividendYield) {
  if (dividendYield === null) return 30;
  if (dividendYield >= 5) return 90;
  if (dividendYield >= 3) return 75;
  if (dividendYield >= 1.5) return 60;
  if (dividendYield >= 0.5) return 45;
  return 30;
}

function computeGrade(scores) {
  const avg = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
  if (avg >= 78) return { letter: 'A', cls: 'grade-a' };
  if (avg >= 65) return { letter: 'B+', cls: 'grade-b' };
  if (avg >= 55) return { letter: 'B', cls: 'grade-b' };
  if (avg >= 45) return { letter: 'C', cls: 'grade-c' };
  if (avg >= 35) return { letter: 'D', cls: 'grade-d' };
  return { letter: 'F', cls: 'grade-f' };
}

function analyze(inputs) {
  const ph = inputs.priceHistory || [];
  const prices = ph.map(p => p.price);
  const labels = ph.map(p => p.date);

  const ma20 = movingAverage(prices, 20);
  const ma50 = movingAverage(prices, 50);
  const rsi14 = calcRSI(prices);
  const vol = annualizedVolatility(prices);

  const priceReturn = prices.length >= 2
    ? (prices[prices.length - 1] - prices[0]) / prices[0] * 100
    : null;

  const scores = {
    valuation: calcValuationScore(inputs.peRatio, inputs.forwardPE, inputs.pbRatio),
    growth:    calcGrowthScore(inputs.revenueGrowth, inputs.grossMargin, inputs.netMargin),
    health:    calcHealthScore(inputs.debtEquity, inputs.currentRatio, inputs.roe),
    momentum:  calcMomentumScore(ph),
    income:    calcIncomeScore(inputs.dividendYield),
  };

  const grade = computeGrade(scores);

  return {
    inputs,
    prices, labels, ma20, ma50, rsi14,
    vol, priceReturn, scores, grade,
  };
}

// ── Populate dashboard ───────────────────────────────────────────────────
function fmt(val, prefix = '', suffix = '', decimals = 2) {
  if (val === null || val === undefined) return '--';
  return prefix + val.toFixed(decimals) + suffix;
}

function fmtReturn(val) {
  if (val === null) return '--';
  const sign = val >= 0 ? '+' : '';
  return `<span class="${val >= 0 ? 'positive' : 'negative'}">${sign}${val.toFixed(1)}%</span>`;
}

function populateDashboard(d) {
  const inp = d.inputs;

  // header
  document.getElementById('headerTicker').textContent = inp.tickerSymbol || '??';
  document.getElementById('headerName').textContent = inp.companyName || 'Unknown Company';
  const meta = [inp.sector, inp.marketCap ? `$${inp.marketCap}B Market Cap` : null].filter(Boolean).join(' · ');
  document.getElementById('headerMeta').textContent = meta || 'No sector info';

  // grade
  const gradeEl = document.getElementById('investmentGrade');
  const gradeRing = document.getElementById('gradeRing');
  gradeEl.textContent = d.grade.letter;
  gradeRing.className = 'grade-ring ' + d.grade.cls;

  // scores
  const scoreMap = { valuation: 'Valuation', growth: 'Growth', health: 'Health', momentum: 'Momentum', income: 'Income' };
  for (const [key, s] of Object.entries(d.scores)) {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    document.getElementById('fill' + label).style.width = s + '%';
    const numEl = document.getElementById('num' + label);
    numEl.textContent = s + '/100';
    numEl.className = 'score-num ' + scoreColor(s);
  }

  // KPIs
  document.getElementById('kpi-price').textContent = inp.currentPrice ? '$' + inp.currentPrice.toFixed(2) : '--';
  document.getElementById('kpi-pe').textContent = inp.peRatio ? inp.peRatio.toFixed(1) + 'x' : '--';
  document.getElementById('kpi-eps').textContent = inp.eps ? '$' + inp.eps.toFixed(2) : '--';
  const revEl = document.getElementById('kpi-revgrowth');
  revEl.innerHTML = inp.revenueGrowth !== null ? fmtReturn(inp.revenueGrowth) : '--';
  document.getElementById('kpi-div').textContent = inp.dividendYield !== null ? inp.dividendYield.toFixed(2) + '%' : '--';
  document.getElementById('kpi-beta').textContent = inp.beta !== null ? inp.beta.toFixed(2) : '--';
  const retEl = document.getElementById('kpi-return');
  retEl.innerHTML = d.priceReturn !== null ? fmtReturn(d.priceReturn) : '--';
  document.getElementById('kpi-vol').textContent = d.vol !== null ? d.vol.toFixed(1) + '%' : '--';

  // nav status
  document.getElementById('navStatus').textContent =
    (inp.tickerSymbol || inp.companyName || 'Stock') + ' · Grade ' + d.grade.letter;

  // charts
  renderPriceChart(d);
  renderScoreChart(d);
  renderRsiChart(d);
  renderRiskChart(d);

  // summary
  buildSummary(d);

  // show dashboard
  document.getElementById('dashboardEmpty').style.display = 'none';
  document.getElementById('dashboardContent').style.display = 'block';
}

// ── Chart helpers ─────────────────────────────────────────────────────────
function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

const CHART_BG = 'rgba(2,8,23,.0)';

function renderPriceChart(d, showMA = 'none') {
  destroyChart('priceChart');
  const ctx = document.getElementById('priceChart').getContext('2d');

  const datasets = [{
    label: d.inputs.tickerSymbol || 'Price',
    data: d.prices,
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59,130,246,.07)',
    borderWidth: 2,
    pointRadius: 0,
    fill: true,
    tension: 0.3,
  }];

  if ((showMA === '20' || showMA === 'both') && d.ma20.some(v => v !== null)) {
    datasets.push({
      label: 'MA 20',
      data: d.ma20,
      borderColor: '#f59e0b',
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
      tension: 0.3,
      spanGaps: true,
    });
  }
  if ((showMA === '50' || showMA === 'both') && d.ma50.some(v => v !== null)) {
    datasets.push({
      label: 'MA 50',
      data: d.ma50,
      borderColor: '#8b5cf6',
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
      tension: 0.3,
      spanGaps: true,
    });
  }

  chartInstances['priceChart'] = new Chart(ctx, {
    type: 'line',
    data: { labels: d.labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10, padding: 14 } },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: $${ctx.parsed.y?.toFixed(2) ?? '--'}`,
          },
        },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8 }, grid: { display: false } },
        y: {
          ticks: { callback: v => '$' + v.toFixed(0) },
          grid: { color: 'rgba(148,163,184,.08)' },
        },
      },
    },
  });
}

function renderScoreChart(d) {
  destroyChart('scoreChart');
  const ctx = document.getElementById('scoreChart').getContext('2d');
  const labels = ['Valuation', 'Growth', 'Fin. Health', 'Momentum', 'Income'];
  const values = [d.scores.valuation, d.scores.growth, d.scores.health, d.scores.momentum, d.scores.income];
  const colors = values.map(v => v >= 70 ? '#10b981' : v >= 45 ? '#f59e0b' : '#ef4444');

  chartInstances['scoreChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Score (0–100)',
        data: values,
        backgroundColor: colors.map(c => c + '33'),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      animation: { duration: 700 },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `Score: ${ctx.parsed.x}/100` } },
      },
      scales: {
        x: {
          min: 0, max: 100,
          ticks: { callback: v => v },
          grid: { color: 'rgba(148,163,184,.08)' },
        },
        y: { grid: { display: false } },
      },
    },
  });
}

function renderRsiChart(d) {
  destroyChart('rsiChart');
  if (!d.rsi14 || d.rsi14.every(v => v === null)) return;
  const ctx = document.getElementById('rsiChart').getContext('2d');

  const rsiColors = d.rsi14.map(v => {
    if (v === null) return 'rgba(59,130,246,.6)';
    if (v >= 70) return '#ef4444';
    if (v <= 30) return '#10b981';
    return 'rgba(59,130,246,.8)';
  });

  chartInstances['rsiChart'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [{
        label: 'RSI (14)',
        data: d.rsi14,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,.06)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.3,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10 } },
        tooltip: {
          callbacks: { label: ctx => `RSI: ${ctx.parsed.y?.toFixed(1) ?? '--'}` },
        },
        annotation: {},
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8 }, grid: { display: false } },
        y: {
          min: 0, max: 100,
          ticks: { callback: v => v },
          grid: { color: 'rgba(148,163,184,.08)' },
        },
      },
    },
    plugins: [{
      id: 'rsiLines',
      beforeDraw(chart) {
        const { ctx: c, chartArea: a, scales: { y } } = chart;
        if (!a) return;
        [[70, '#ef444466', 'Overbought'], [30, '#10b98166', 'Oversold']].forEach(([level, color, label]) => {
          const yPos = y.getPixelForValue(level);
          c.save();
          c.strokeStyle = color;
          c.lineWidth = 1;
          c.setLineDash([4, 4]);
          c.beginPath(); c.moveTo(a.left, yPos); c.lineTo(a.right, yPos); c.stroke();
          c.fillStyle = color; c.font = '10px Segoe UI';
          c.fillText(label, a.left + 4, yPos - 4);
          c.restore();
        });
      },
    }],
  });
}

function renderRiskChart(d) {
  destroyChart('riskChart');
  const ctx = document.getElementById('riskChart').getContext('2d');
  const inp = d.inputs;

  // Risk dimensions (higher = more risk)
  const marketRisk   = inp.beta    !== null ? Math.min(100, (inp.beta / 2.5) * 100) : 50;
  const leverageRisk = inp.debtEquity !== null ? Math.min(100, (inp.debtEquity / 4) * 100) : 50;
  const liquidityRisk = inp.currentRatio !== null ? Math.max(0, 100 - ((inp.currentRatio - 1) / 2) * 100) : 50;
  const valuationRisk = inp.peRatio !== null ? Math.min(100, (inp.peRatio / 60) * 100) : 50;
  const volRisk       = d.vol !== null ? Math.min(100, (d.vol / 60) * 100) : 50;

  chartInstances['riskChart'] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Market (Beta)', 'Leverage', 'Liquidity', 'Valuation', 'Price Volatility'],
      datasets: [{
        label: 'Risk Level',
        data: [marketRisk, leverageRisk, liquidityRisk, valuationRisk, volRisk],
        backgroundColor: 'rgba(239,68,68,.12)',
        borderColor: '#ef4444',
        borderWidth: 2,
        pointBackgroundColor: '#ef4444',
        pointRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 700 },
      plugins: { legend: { position: 'top', labels: { boxWidth: 10 } } },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { display: false },
          grid: { color: 'rgba(148,163,184,.1)' },
          pointLabels: { font: { size: 11 } },
          angleLines: { color: 'rgba(148,163,184,.1)' },
        },
      },
    },
  });
}

// ── MA toggle buttons ────────────────────────────────────────────────────
document.querySelectorAll('.toggle-btn[data-ma]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn[data-ma]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (stockData) renderPriceChart(stockData, btn.dataset.ma);
  });
});

// ── Build analysis summary ───────────────────────────────────────────────
function buildSummary(d) {
  const inp = d.inputs;
  const items = [];

  const name = inp.companyName || inp.tickerSymbol || 'This stock';

  // Valuation
  if (inp.peRatio !== null) {
    const verdict = inp.peRatio < 20 ? 'appears reasonably valued' : inp.peRatio < 35 ? 'carries a moderate premium' : 'trades at a significant premium';
    items.push({ icon: '💰', text: `<strong>Valuation:</strong> ${name} ${verdict} with a P/E of ${inp.peRatio.toFixed(1)}x. ${inp.forwardPE ? `Forward P/E of ${inp.forwardPE.toFixed(1)}x suggests the market expects ${inp.forwardPE < inp.peRatio ? 'earnings growth.' : 'slower growth ahead.'}` : ''}` });
  }

  // Growth
  if (inp.revenueGrowth !== null) {
    const gVerb = inp.revenueGrowth >= 15 ? 'strong' : inp.revenueGrowth >= 5 ? 'moderate' : inp.revenueGrowth >= 0 ? 'slow' : 'declining';
    items.push({ icon: '📈', text: `<strong>Growth:</strong> Revenue is growing at ${inp.revenueGrowth.toFixed(1)}% YoY — a ${gVerb} pace. ${inp.netMargin ? `Net margin of ${inp.netMargin.toFixed(1)}% indicates ${inp.netMargin >= 20 ? 'excellent' : inp.netMargin >= 10 ? 'healthy' : 'thin'} profitability.` : ''}` });
  }

  // Financial health
  if (inp.debtEquity !== null) {
    const lvg = inp.debtEquity < 0.5 ? 'very low leverage' : inp.debtEquity < 1.5 ? 'moderate leverage' : inp.debtEquity < 3 ? 'elevated leverage' : 'high leverage';
    items.push({ icon: '🏦', text: `<strong>Financial Health:</strong> Debt/Equity of ${inp.debtEquity.toFixed(2)} reflects ${lvg}. ${inp.currentRatio ? `Current ratio of ${inp.currentRatio.toFixed(2)} suggests ${inp.currentRatio >= 1.5 ? 'strong' : inp.currentRatio >= 1 ? 'adequate' : 'tight'} short-term liquidity.` : ''}` });
  }

  // Price momentum
  if (d.priceReturn !== null) {
    const trend = d.priceReturn >= 20 ? 'strong uptrend' : d.priceReturn >= 5 ? 'upward trend' : d.priceReturn >= -5 ? 'relatively flat' : 'downtrend';
    items.push({ icon: '📊', text: `<strong>Momentum:</strong> Price has moved ${d.priceReturn >= 0 ? '+' : ''}${d.priceReturn.toFixed(1)}% over the data period — showing a ${trend}. ${d.vol !== null ? `Annualized volatility of ${d.vol.toFixed(1)}% is ${d.vol < 20 ? 'low' : d.vol < 40 ? 'moderate' : 'high'} relative to typical equities.` : ''}` });
  }

  // Risk
  if (inp.beta !== null) {
    items.push({ icon: '⚠️', text: `<strong>Risk:</strong> Beta of ${inp.beta.toFixed(2)} means the stock moves approximately ${inp.beta.toFixed(2)}x as much as the broader market. ${inp.beta > 1.5 ? 'This is a high-volatility stock.' : inp.beta < 0.7 ? 'This is a low-volatility, defensive stock.' : 'This is roughly in line with typical market risk.'}` });
  }

  // Overall
  items.push({ icon: '🎯', text: `<strong>Overall Grade: ${d.grade.letter}</strong> — Based on the data provided, ${name} scores across five dimensions. This is an educational analysis and should not be considered financial advice.` });

  const container = document.getElementById('analysisSummary');
  container.innerHTML = items.map(it =>
    `<div class="summary-item"><span class="si-icon">${it.icon}</span><span class="si-text">${it.text}</span></div>`
  ).join('');
}

// ── Main analyze button ──────────────────────────────────────────────────
document.getElementById('analyzeBtn').addEventListener('click', () => {
  const inputs = collectInputs();
  const hasAny = inputs.currentPrice || inputs.peRatio || inputs.priceHistory.length > 0 ||
                 inputs.revenueGrowth !== null || inputs.eps !== null;
  if (!hasAny) {
    alert('Please enter at least some data before analyzing. You can load sample data to try it out.');
    return;
  }
  stockData = analyze(inputs);
  populateDashboard(stockData);
  switchTab('dashboard');
});

// ── Load sample data ─────────────────────────────────────────────────────
document.getElementById('loadSampleBtn').addEventListener('click', () => {
  const s = SAMPLE;
  document.getElementById('companyName').value = s.companyName;
  document.getElementById('tickerSymbol').value = s.tickerSymbol;
  document.getElementById('sectorSelect').value = s.sector;
  document.getElementById('marketCap').value = s.marketCap;
  document.getElementById('currentPrice').value = s.currentPrice;
  document.getElementById('weekHigh52').value = s.weekHigh52;
  document.getElementById('weekLow52').value = s.weekLow52;
  document.getElementById('peRatio').value = s.peRatio;
  document.getElementById('forwardPE').value = s.forwardPE;
  document.getElementById('pbRatio').value = s.pbRatio;
  document.getElementById('eps').value = s.eps;
  document.getElementById('beta').value = s.beta;
  document.getElementById('revenueGrowth').value = s.revenueGrowth;
  document.getElementById('grossMargin').value = s.grossMargin;
  document.getElementById('netMargin').value = s.netMargin;
  document.getElementById('roe').value = s.roe;
  document.getElementById('roa').value = s.roa;
  document.getElementById('debtEquity').value = s.debtEquity;
  document.getElementById('currentRatio').value = s.currentRatio;
  document.getElementById('dividendYield').value = s.dividendYield;

  // Fill CSV textarea
  const csv = ['Date,Price'].concat(s.priceHistory.map(p => `${p.date},${p.price}`)).join('\n');
  document.getElementById('csvData').value = csv;

  // Switch to CSV tab
  document.querySelectorAll('.pill-tab').forEach(b => {
    if (b.dataset.inputTab === 'csv') b.click();
  });

  showBadge(`${s.priceHistory.length} sample rows loaded`, true);
});

// ── Clear button ─────────────────────────────────────────────────────────
document.getElementById('clearBtn').addEventListener('click', () => {
  document.querySelectorAll('#tab-input input, #tab-input select, #tab-input textarea').forEach(el => {
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });
  document.getElementById('dataBadge').style.display = 'none';
});

// ── Chatbot ──────────────────────────────────────────────────────────────
const chatMessages = document.getElementById('chatMessages');
const chatInput    = document.getElementById('chatInput');

function addMessage(text, role) {
  const wrap = document.createElement('div');
  wrap.className = 'chat-msg ' + role;
  const initial = role === 'bot' ? 'AI' : 'You';
  wrap.innerHTML = `
    <div class="msg-avatar ${role}">${initial}</div>
    <div class="msg-bubble">${text}</div>
  `;
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrap;
}

function addTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'chat-msg bot';
  wrap.id = 'typing-indicator';
  wrap.innerHTML = `
    <div class="msg-avatar bot">AI</div>
    <div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>
  `;
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function ml(key, val, cls = '') {
  return `<div class="metric-line"><span class="ml-key">${key}</span><span class="ml-val ${cls}">${val}</span></div>`;
}

function generateResponse(msg) {
  const q = msg.toLowerCase();

  if (!stockData) {
    return `<p>I don't have any stock data to analyze yet. Please go to the <strong>Data Input</strong> tab, fill in your stock information, and click <strong>Analyze Investment</strong>. Then come back and ask me anything!</p>`;
  }

  const inp = stockData.inputs;
  const d = stockData;
  const name = inp.companyName || inp.tickerSymbol || 'this stock';

  // ── Buy / sell / recommend ────────────────────────────────────────────
  if (/buy|sell|recommend|invest|worth|should i/.test(q)) {
    const avg = Object.values(d.scores).reduce((a, b) => a + b, 0) / 5;
    const outlook = avg >= 70 ? 'generally favorable' : avg >= 50 ? 'mixed' : 'cautious';
    return `<p><strong>Investment Assessment for ${name} (Grade: ${d.grade.letter})</strong></p>
      <p>Based on your data, the outlook is <strong>${outlook}</strong>.</p>
      ${ml('Overall Score', Math.round(avg) + '/100', scoreColor(avg))}
      ${ml('Valuation',    d.scores.valuation + '/100', scoreColor(d.scores.valuation))}
      ${ml('Growth',       d.scores.growth + '/100',    scoreColor(d.scores.growth))}
      ${ml('Fin. Health',  d.scores.health + '/100',    scoreColor(d.scores.health))}
      ${ml('Momentum',     d.scores.momentum + '/100',  scoreColor(d.scores.momentum))}
      ${ml('Income',       d.scores.income + '/100',    scoreColor(d.scores.income))}
      <p style="margin-top:.6rem; font-size:.82rem; color:#64748b;">⚠️ This is for educational purposes only — not financial advice.</p>`;
  }

  // ── Valuation ─────────────────────────────────────────────────────────
  if (/overvalued|undervalued|valuat|p\/e|price.earn|pe ratio/.test(q)) {
    if (inp.peRatio === null) {
      return `<p>You haven't entered a P/E ratio for ${name}. Add it on the Data Input tab to get a valuation analysis.</p>`;
    }
    const verdict = inp.peRatio < 15 ? 'potentially undervalued' : inp.peRatio < 25 ? 'fairly valued' : inp.peRatio < 40 ? 'moderately premium' : 'significantly overvalued';
    const marketAvg = 22;
    const diff = ((inp.peRatio - marketAvg) / marketAvg * 100).toFixed(1);
    return `<p><strong>Valuation Analysis for ${name}</strong></p>
      <p>A P/E of <strong>${inp.peRatio.toFixed(1)}x</strong> is ${Math.abs(diff)}% ${parseFloat(diff) > 0 ? 'above' : 'below'} the S&amp;P 500 average (~22x), suggesting the stock is <strong>${verdict}</strong>.</p>
      ${ml('P/E Ratio (TTM)', inp.peRatio.toFixed(1) + 'x', inp.peRatio < 22 ? 'green' : inp.peRatio < 35 ? 'amber' : 'red')}
      ${inp.forwardPE ? ml('Forward P/E', inp.forwardPE.toFixed(1) + 'x', inp.forwardPE < inp.peRatio ? 'green' : 'amber') : ''}
      ${inp.pbRatio ? ml('Price / Book', inp.pbRatio.toFixed(1) + 'x') : ''}
      ${ml('S&P 500 Avg P/E', '~22x', 'neutral')}
      <p>Valuation Score: <strong>${d.scores.valuation}/100</strong></p>`;
  }

  // ── Trend / technical ─────────────────────────────────────────────────
  if (/trend|technical|momentum|moving average|ma\b|price/.test(q)) {
    if (d.prices.length < 2) {
      return `<p>No price history was entered. Add historical prices on the Data Input tab to analyze trends.</p>`;
    }
    const ret = d.priceReturn;
    const trendWord = ret > 20 ? 'strongly bullish 📈' : ret > 5 ? 'mildly bullish' : ret > -5 ? 'sideways' : ret > -20 ? 'mildly bearish' : 'strongly bearish 📉';
    const lastRSI = d.rsi14.filter(v => v !== null).at(-1);
    return `<p><strong>Technical Analysis for ${name}</strong></p>
      <p>Over the ${d.prices.length} data points entered, price movement has been <strong>${trendWord}</strong>.</p>
      ${ml('Total Return', (ret >= 0 ? '+' : '') + ret.toFixed(1) + '%', ret >= 0 ? 'green' : 'red')}
      ${d.vol ? ml('Annualized Volatility', d.vol.toFixed(1) + '%', d.vol < 20 ? 'green' : d.vol < 40 ? 'amber' : 'red') : ''}
      ${lastRSI ? ml('RSI (14)', lastRSI.toFixed(1), lastRSI > 70 ? 'red' : lastRSI < 30 ? 'green' : 'neutral') : ''}
      <p>RSI interpretation: ${lastRSI ? (lastRSI > 70 ? 'Overbought — may face near-term resistance.' : lastRSI < 30 ? 'Oversold — may present a buying opportunity.' : 'Neutral — no extreme reading.') : 'Not enough data for RSI.'}</p>`;
  }

  // ── Risk ──────────────────────────────────────────────────────────────
  if (/risk|volatile|volatility|beta|danger|downside/.test(q)) {
    return `<p><strong>Risk Analysis for ${name}</strong></p>
      ${inp.beta !== null ? ml('Beta', inp.beta.toFixed(2), inp.beta > 1.5 ? 'red' : inp.beta < 0.8 ? 'green' : 'amber') : ''}
      ${inp.debtEquity !== null ? ml('Debt / Equity', inp.debtEquity.toFixed(2), inp.debtEquity > 2 ? 'red' : inp.debtEquity < 0.5 ? 'green' : 'amber') : ''}
      ${inp.currentRatio !== null ? ml('Current Ratio', inp.currentRatio.toFixed(2), inp.currentRatio >= 1.5 ? 'green' : inp.currentRatio >= 1 ? 'amber' : 'red') : ''}
      ${d.vol ? ml('Price Volatility (Ann.)', d.vol.toFixed(1) + '%', d.vol < 20 ? 'green' : d.vol < 40 ? 'amber' : 'red') : ''}
      <p>${inp.beta !== null ? `A beta of ${inp.beta.toFixed(2)} means this stock is ${inp.beta > 1 ? `${((inp.beta - 1) * 100).toFixed(0)}% more volatile than` : `${((1 - inp.beta) * 100).toFixed(0)}% less volatile than`} the broader market.` : 'Enter Beta to see market-relative risk.'}</p>`;
  }

  // ── Growth ────────────────────────────────────────────────────────────
  if (/growth|revenue|earnings|eps|margin|profit/.test(q)) {
    return `<p><strong>Growth &amp; Profitability for ${name}</strong></p>
      ${inp.revenueGrowth !== null ? ml('Revenue Growth YoY', inp.revenueGrowth.toFixed(1) + '%', inp.revenueGrowth >= 15 ? 'green' : inp.revenueGrowth >= 5 ? 'amber' : 'red') : ''}
      ${inp.grossMargin !== null ? ml('Gross Margin', inp.grossMargin.toFixed(1) + '%', inp.grossMargin >= 40 ? 'green' : inp.grossMargin >= 20 ? 'amber' : 'red') : ''}
      ${inp.netMargin !== null ? ml('Net Margin', inp.netMargin.toFixed(1) + '%', inp.netMargin >= 20 ? 'green' : inp.netMargin >= 8 ? 'amber' : 'red') : ''}
      ${inp.eps !== null ? ml('EPS (TTM)', '$' + inp.eps.toFixed(2)) : ''}
      ${inp.roe !== null ? ml('Return on Equity', inp.roe.toFixed(1) + '%', inp.roe >= 15 ? 'green' : 'amber') : ''}
      <p>Growth Score: <strong>${d.scores.growth}/100</strong></p>`;
  }

  // ── Dividend / income ─────────────────────────────────────────────────
  if (/dividend|yield|income|payout/.test(q)) {
    if (inp.dividendYield === null) {
      return `<p>No dividend yield was entered for ${name}. If the company pays dividends, enter the yield on the Data Input tab.</p>`;
    }
    const quality = inp.dividendYield >= 4 ? 'high-yield' : inp.dividendYield >= 2 ? 'moderate-yield' : inp.dividendYield >= 0.5 ? 'low-yield' : 'minimal dividend';
    return `<p><strong>Dividend Analysis for ${name}</strong></p>
      ${ml('Dividend Yield', inp.dividendYield.toFixed(2) + '%', inp.dividendYield >= 3 ? 'green' : inp.dividendYield >= 1 ? 'amber' : 'neutral')}
      ${ml('S&P 500 Avg Yield', '~1.5%', 'neutral')}
      <p>${name} is a <strong>${quality}</strong> stock. ${inp.dividendYield >= 5 ? 'High yields can signal strong income but verify payout sustainability.' : inp.dividendYield < 0.5 ? 'Minimal dividend — this stock rewards investors more through capital appreciation.' : 'Moderate dividend that supplements price growth.'}</p>
      <p>Income Score: <strong>${d.scores.income}/100</strong></p>`;
  }

  // ── Financial health ─────────────────────────────────────────────────
  if (/health|balance sheet|debt|leverage|liquid|current ratio/.test(q)) {
    return `<p><strong>Financial Health for ${name}</strong></p>
      ${inp.debtEquity !== null ? ml('Debt / Equity', inp.debtEquity.toFixed(2), inp.debtEquity > 2 ? 'red' : inp.debtEquity < 0.5 ? 'green' : 'amber') : ''}
      ${inp.currentRatio !== null ? ml('Current Ratio', inp.currentRatio.toFixed(2), inp.currentRatio >= 1.5 ? 'green' : inp.currentRatio >= 1 ? 'amber' : 'red') : ''}
      ${inp.roe !== null ? ml('Return on Equity', inp.roe.toFixed(1) + '%', inp.roe >= 15 ? 'green' : 'amber') : ''}
      ${inp.roa !== null ? ml('Return on Assets', inp.roa.toFixed(1) + '%', inp.roa >= 10 ? 'green' : 'amber') : ''}
      <p>Financial Health Score: <strong>${d.scores.health}/100</strong></p>`;
  }

  // ── Price / fair value ────────────────────────────────────────────────
  if (/fair value|price target|52.week|52w|current price/.test(q)) {
    const lines = [];
    if (inp.currentPrice) lines.push(ml('Current Price', '$' + inp.currentPrice.toFixed(2)));
    if (inp.weekHigh52) lines.push(ml('52-Week High', '$' + inp.weekHigh52.toFixed(2)));
    if (inp.weekLow52) lines.push(ml('52-Week Low', '$' + inp.weekLow52.toFixed(2)));
    if (inp.currentPrice && inp.weekLow52 && inp.weekHigh52) {
      const range = inp.weekHigh52 - inp.weekLow52;
      const pos = ((inp.currentPrice - inp.weekLow52) / range * 100).toFixed(1);
      lines.push(ml('Position in 52W Range', pos + '%', pos > 80 ? 'amber' : pos < 20 ? 'green' : 'neutral'));
    }
    if (inp.peRatio && inp.eps) {
      const grahNum = (22 * inp.eps).toFixed(2);
      lines.push(ml('Graham Number (est.)', '$' + grahNum, parseFloat(grahNum) > (inp.currentPrice || 0) ? 'green' : 'red'));
    }
    return `<p><strong>Price Analysis for ${name}</strong></p>${lines.join('')}
      ${lines.length === 0 ? '<p>Enter current price and 52-week high/low on the Data Input tab.</p>' : ''}`;
  }

  // ── Compare to sector ─────────────────────────────────────────────────
  if (/sector|compare|benchmark|market average|s&p/.test(q)) {
    const sector = inp.sector || 'your sector';
    const sectorPE = { Technology: 28, Healthcare: 24, Financials: 14, Energy: 12, Utilities: 18, Industrials: 20, Consumer: 22 };
    const avgPE = Object.entries(sectorPE).find(([k]) => inp.sector && inp.sector.toLowerCase().includes(k.toLowerCase()))?.[1] ?? 20;
    return `<p><strong>Sector Comparison</strong></p>
      <p>Comparing ${name} to the <strong>${sector}</strong> sector:</p>
      ${inp.peRatio ? ml('Your P/E', inp.peRatio.toFixed(1) + 'x', inp.peRatio < avgPE ? 'green' : 'amber') : ''}
      ${ml('Sector Avg P/E', '~' + avgPE + 'x', 'neutral')}
      ${inp.dividendYield ? ml('Your Dividend Yield', inp.dividendYield.toFixed(2) + '%') : ''}
      ${inp.netMargin ? ml('Your Net Margin', inp.netMargin.toFixed(1) + '%', inp.netMargin >= 15 ? 'green' : 'amber') : ''}
      <p>Note: Sector averages are approximate benchmarks for general comparison only.</p>`;
  }

  // ── Educational: what is P/E ──────────────────────────────────────────
  if (/what is.*(p\/e|pe ratio|price.earn)/.test(q) || /explain.*p\/e/.test(q)) {
    return `<p><strong>What is the P/E Ratio?</strong></p>
      <p>The <strong>Price-to-Earnings (P/E) ratio</strong> measures how much investors pay for each dollar of earnings:</p>
      <p><code>P/E = Stock Price ÷ Earnings Per Share (EPS)</code></p>
      <p>A higher P/E means investors are willing to pay a premium — often because they expect strong future growth. A lower P/E can indicate an undervalued stock or slower expected growth.</p>
      ${ml('P/E < 15', 'Potentially undervalued', 'green')}
      ${ml('P/E 15–25', 'Fairly valued (market avg ~22)', 'neutral')}
      ${ml('P/E 25–40', 'Growth premium', 'amber')}
      ${ml('P/E > 40', 'High growth expectations', 'red')}
      ${inp.peRatio ? `<p>${name}'s current P/E is <strong>${inp.peRatio.toFixed(1)}x</strong>.</p>` : ''}`;
  }

  // ── Educational: what is beta ─────────────────────────────────────────
  if (/what is.*beta|explain.*beta/.test(q)) {
    return `<p><strong>What is Beta?</strong></p>
      <p><strong>Beta</strong> measures how much a stock moves relative to the overall market (S&amp;P 500):</p>
      ${ml('Beta = 1.0', 'Moves in line with the market', 'neutral')}
      ${ml('Beta > 1.0', 'More volatile than the market', 'amber')}
      ${ml('Beta < 1.0', 'Less volatile (defensive)', 'green')}
      ${ml('Beta < 0', 'Moves opposite to the market', 'red')}
      ${inp.beta !== null ? `<p>${name} has a beta of <strong>${inp.beta.toFixed(2)}</strong> — it's ${inp.beta > 1 ? `${((inp.beta - 1) * 100).toFixed(0)}% more` : `${((1 - inp.beta) * 100).toFixed(0)}% less`} volatile than the market.</p>` : ''}`;
  }

  // ── Overall score ────────────────────────────────────────────────────
  if (/score|grade|rating|overall/.test(q)) {
    const avg = Math.round(Object.values(d.scores).reduce((a, b) => a + b, 0) / 5);
    return `<p><strong>Overall Investment Score for ${name}</strong></p>
      <p>Grade: <strong>${d.grade.letter}</strong> · Composite Score: <strong>${avg}/100</strong></p>
      ${ml('Valuation',   d.scores.valuation + '/100', scoreColor(d.scores.valuation))}
      ${ml('Growth',      d.scores.growth + '/100',    scoreColor(d.scores.growth))}
      ${ml('Fin. Health', d.scores.health + '/100',    scoreColor(d.scores.health))}
      ${ml('Momentum',    d.scores.momentum + '/100',  scoreColor(d.scores.momentum))}
      ${ml('Income',      d.scores.income + '/100',    scoreColor(d.scores.income))}`;
  }

  // ── Volatility ────────────────────────────────────────────────────────
  if (/volatility|volatile/.test(q)) {
    if (d.vol === null) {
      return `<p>No price history was entered, so I can't compute volatility. Add historical prices on the Data Input tab.</p>`;
    }
    const level = d.vol < 15 ? 'very low' : d.vol < 25 ? 'low' : d.vol < 40 ? 'moderate' : d.vol < 60 ? 'high' : 'very high';
    return `<p><strong>Volatility Analysis for ${name}</strong></p>
      ${ml('Annualized Volatility', d.vol.toFixed(1) + '%', d.vol < 25 ? 'green' : d.vol < 50 ? 'amber' : 'red')}
      ${ml('S&P 500 Avg Volatility', '~15–20%', 'neutral')}
      <p>${name} has <strong>${level} volatility</strong> at ${d.vol.toFixed(1)}% annualized. ${d.vol > 40 ? 'This means significant price swings are possible — higher risk but potentially higher reward.' : 'This suggests relatively stable price movement.'}</p>`;
  }

  // ── Fallback ─────────────────────────────────────────────────────────
  const topics = ['valuation', 'growth', 'risk', 'trend', 'dividends', 'financial health', 'price', 'score'];
  return `<p>I can analyze <strong>${name}</strong> across many dimensions. Try asking about:</p>
    <ul>${topics.map(t => `<li>${t.charAt(0).toUpperCase() + t.slice(1)}</li>`).join('')}</ul>
    <p>Or use the suggestions on the left for quick questions.</p>`;
}

function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  addMessage(text, 'user');
  chatInput.value = '';
  addTyping();
  setTimeout(() => {
    removeTyping();
    addMessage(generateResponse(text), 'bot');
  }, 600 + Math.random() * 400);
}

document.getElementById('sendChatBtn').addEventListener('click', sendChat);
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

document.querySelectorAll('.suggest-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    chatInput.value = btn.dataset.q;
    sendChat();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// FINANCIAL STATEMENTS — file upload, parsing, and 3-statement model
// ══════════════════════════════════════════════════════════════════════════

let financialData = [];  // array of yearly objects after parsing

// ── Column name aliases (all lowercase, no spaces/punctuation) ────────────
const FIN_ALIASES = {
  year:             ['year','fiscalyear','fy','period'],
  revenue:          ['revenue','totalrevenue','netsales','sales','netrevenue','totalnet revenue'],
  cogs:             ['cogs','costofsales','costofrevenue','costofgoodssold','costsales'],
  grossProfit:      ['grossprofit','grossincome'],
  ebitda:           ['ebitda','ebit da'],
  da:               ['da','d&a','depreciationamortization','depreciation','depamort','d and a'],
  ebit:             ['ebit','operatingincome','opincome'],
  interestExpense:  ['interestexpense','interest','netinterest'],
  netIncome:        ['netincome','netearnings','netprofit','profit','earnings'],
  eps:              ['eps','earningspershare','dilutedeps','basiceps'],
  cash:             ['cash','cashandequivalents','cashequivalents','cashandcashequivalents'],
  currentAssets:    ['currentassets','totalcurrentassets'],
  totalAssets:      ['totalassets','assets'],
  currentLiabilities: ['currentliabilities','totalcurrentliabilities'],
  totalDebt:        ['totaldebt','debt','longtermdebt','totallongtermdebt','netdebt'],
  totalLiabilities: ['totalliabilities','liabilities'],
  equity:           ['equity','stockholdersequity','shareholdersequity','totalequity','totalstockholdersequity'],
  operatingCF:      ['operatingcf','cffo','cashfromoperations','operatingcashflow','netcashoperating','netcashprovidedbyoperatingactivities'],
  capex:            ['capex','capitalexpenditures','capexpend','purchaseofppe','purchaseofproperty'],
};

function normalizeKey(raw) {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapColumn(rawHeader) {
  const norm = normalizeKey(rawHeader);
  for (const [key, aliases] of Object.entries(FIN_ALIASES)) {
    if (aliases.includes(norm)) return key;
  }
  return null;
}

function parseFinancials(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const colMap = headers.map(h => mapColumn(h));  // internal key or null

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(s => s.trim().replace(/['"$,]/g, ''));
    if (!parts[0] || isNaN(parseFloat(parts[0]))) continue;

    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const key = colMap[c];
      if (!key) continue;
      const val = parseFloat(parts[c]);
      if (!isNaN(val)) obj[key] = val;
    }
    if (obj.year && obj.revenue) rows.push(obj);
  }

  // Sort ascending by year
  rows.sort((a, b) => a.year - b.year);

  // Derive missing fields
  rows.forEach((r, i) => {
    if (r.cogs && !r.grossProfit)     r.grossProfit = r.revenue - r.cogs;
    if (!r.grossProfit && r.revenue)  r.grossProfit = undefined;
    if (r.ebitda && r.da && !r.ebit)  r.ebit = r.ebitda - r.da;
    if (r.operatingCF && r.capex)     r.freeCashFlow = r.operatingCF - r.capex;
    r.grossMarginPct  = r.grossProfit ? (r.grossProfit / r.revenue * 100) : undefined;
    r.ebitdaMarginPct = r.ebitda      ? (r.ebitda      / r.revenue * 100) : undefined;
    r.netMarginPct    = r.netIncome   ? (r.netIncome   / r.revenue * 100) : undefined;
    r.revGrowthPct    = (i > 0 && rows[i-1].revenue)
      ? ((r.revenue - rows[i-1].revenue) / rows[i-1].revenue * 100) : undefined;
    if (!r.totalLiabilities && r.totalAssets && r.equity)
      r.totalLiabilities = r.totalAssets - r.equity;
  });

  return rows;
}

function fmtFin(val, decimals = 0) {
  if (val === undefined || val === null || isNaN(val)) return '—';
  if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(1) + 'T';
  if (Math.abs(val) >= 1000)    return (val / 1000).toFixed(1) + 'B';
  return val.toFixed(decimals);
}

function fmtPct(val) {
  if (val === undefined || val === null || isNaN(val)) return '—';
  return val.toFixed(1) + '%';
}

// ── Build financial table ─────────────────────────────────────────────────
function buildFinTable(tableEl, rowDefs, data) {
  const years = data.map(d => d.year);
  // thead
  tableEl.querySelector('thead').innerHTML =
    `<tr><th>Metric</th>${years.map(y => `<th>${y}</th>`).join('')}</tr>`;

  const tbody = tableEl.querySelector('tbody');
  tbody.innerHTML = '';

  rowDefs.forEach(def => {
    const tr = document.createElement('tr');
    if (def.type) tr.className = 'row-' + def.type;
    const cells = [def.label];
    data.forEach(row => {
      const val = row[def.key];
      let txt;
      if (def.pct)      txt = fmtPct(val);
      else if (def.eps) txt = val !== undefined ? '$' + val.toFixed(2) : '—';
      else              txt = fmtFin(val);

      let cls = '';
      if (def.colorSign && val !== undefined) cls = val >= 0 ? 'cell-positive' : 'cell-negative';
      if (def.colorGrowth && val !== undefined) {
        cls = val >= 10 ? 'cell-positive' : val >= 0 ? '' : 'cell-negative';
      }
      cells.push(`<td class="${cls}">${txt}</td>`);
    });
    tr.innerHTML = `<td>${cells[0]}</td>${cells.slice(1).join('')}`;
    tbody.appendChild(tr);
  });
}

const IS_ROWS = [
  { label: 'Revenue',            key: 'revenue' },
  { label: 'Revenue Growth %',   key: 'revGrowthPct',   pct: true, type: 'margin', colorGrowth: true },
  { label: 'Cost of Revenue',    key: 'cogs' },
  { label: 'Gross Profit',       key: 'grossProfit',    type: 'subtotal' },
  { label: 'Gross Margin %',     key: 'grossMarginPct', pct: true, type: 'margin' },
  { label: 'EBITDA',             key: 'ebitda',         type: 'subtotal' },
  { label: 'EBITDA Margin %',    key: 'ebitdaMarginPct',pct: true, type: 'margin' },
  { label: 'Depreciation & Amortization', key: 'da' },
  { label: 'EBIT',               key: 'ebit',           type: 'subtotal' },
  { label: 'Interest Expense',   key: 'interestExpense' },
  { label: 'Net Income',         key: 'netIncome',      type: 'total', colorSign: true },
  { label: 'Net Margin %',       key: 'netMarginPct',   pct: true, type: 'margin' },
  { label: 'EPS (Diluted)',      key: 'eps',            eps: true },
];

const BS_ROWS = [
  { label: '── Assets',                  key: '_', type: 'section' },
  { label: 'Cash & Equivalents',          key: 'cash' },
  { label: 'Total Current Assets',        key: 'currentAssets' },
  { label: 'Total Assets',               key: 'totalAssets',        type: 'total' },
  { label: '── Liabilities & Equity',    key: '_', type: 'section' },
  { label: 'Total Current Liabilities',  key: 'currentLiabilities' },
  { label: 'Total Debt',                 key: 'totalDebt' },
  { label: 'Total Liabilities',          key: 'totalLiabilities',   type: 'subtotal' },
  { label: 'Stockholders\' Equity',      key: 'equity',             type: 'total', colorSign: true },
];

const CF_ROWS = [
  { label: 'Operating Cash Flow',  key: 'operatingCF',  type: 'subtotal', colorSign: true },
  { label: 'Capital Expenditures', key: 'capex' },
  { label: 'Free Cash Flow',       key: 'freeCashFlow', type: 'total',    colorSign: true },
];

function renderThreeStatement(data) {
  if (!data || !data.length) return;

  buildFinTable(document.getElementById('incomeTable'),    IS_ROWS, data);
  buildFinTable(document.getElementById('balanceTable'),   BS_ROWS, data);
  buildFinTable(document.getElementById('cashflowTable'),  CF_ROWS, data);

  // Charts
  const years  = data.map(d => d.year);
  const revs   = data.map(d => d.revenue   ?? null);
  const ebitdas= data.map(d => d.ebitda    ?? null);
  const nets   = data.map(d => d.netIncome ?? null);
  const fcfs   = data.map(d => d.freeCashFlow ?? null);

  destroyChart('isChart');
  destroyChart('fcfChart');

  const isCtx = document.getElementById('isChart').getContext('2d');
  chartInstances['isChart'] = new Chart(isCtx, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        { label: 'Revenue',    data: revs,    backgroundColor: 'rgba(59,130,246,.7)',   borderRadius: 6 },
        { label: 'EBITDA',     data: ebitdas, backgroundColor: 'rgba(16,185,129,.7)',   borderRadius: 6 },
        { label: 'Net Income', data: nets,    backgroundColor: 'rgba(139,92,246,.7)',   borderRadius: 6 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 10 } } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(148,163,184,.08)' }, ticks: { callback: v => fmtFin(v) } },
      },
    },
  });

  const fcfCtx = document.getElementById('fcfChart').getContext('2d');
  chartInstances['fcfChart'] = new Chart(fcfCtx, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        label: 'Free Cash Flow',
        data: fcfs,
        backgroundColor: fcfs.map(v => v === null ? 'rgba(148,163,184,.3)' : v >= 0 ? 'rgba(16,185,129,.7)' : 'rgba(239,68,68,.7)'),
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 10 } } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(148,163,184,.08)' }, ticks: { callback: v => fmtFin(v) } },
      },
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════
// PDF.js SETUP
// ══════════════════════════════════════════════════════════════════════════

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

// ── PDF text extraction ───────────────────────────────────────────────────
async function extractTextFromPDF(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageLimit = Math.min(pdf.numPages, 60); // cap for performance
  let fullText = '';

  for (let pageNum = 1; pageNum <= pageLimit; pageNum++) {
    if (onProgress) onProgress(pageNum, pageLimit);

    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Group text items by approximate Y position to reconstruct rows
    const rowMap = new Map();
    content.items.forEach(item => {
      if (!item.str.trim()) return;
      // Snap Y to a grid of 2 units to cluster items on the same visual line
      const yKey = Math.round(item.transform[5] / 2) * 2;
      if (!rowMap.has(yKey)) rowMap.set(yKey, []);
      rowMap.get(yKey).push({ x: item.transform[4], str: item.str });
    });

    // Sort rows top→bottom (PDF y increases upward, so descending = top-first)
    const sortedYs = [...rowMap.keys()].sort((a, b) => b - a);
    const pageLines = sortedYs.map(y => {
      const items = rowMap.get(y).sort((a, b) => a.x - b.x);
      return items.map(i => i.str).join('  ');
    });

    fullText += pageLines.join('\n') + '\n\n';
  }

  return fullText;
}

// ── Heuristic financial data parser for PDF text ─────────────────────────

/**
 * Extract numbers (including negatives in parentheses) from a string.
 * Filters out 4-digit years, page numbers, and very small decimals that
 * are likely not financial figures.
 */
function extractFinancialNumbers(text, excludeYears = true) {
  const cleaned = text.replace(/\$/g, '').replace(/,(?=\d{3})/g, '');
  const matches = cleaned.match(/\(\d+(?:\.\d+)?\)|-?\d+(?:\.\d+)?/g) || [];

  return matches
    .map(m => {
      const neg = m.startsWith('(');
      const val = parseFloat(m.replace(/[()]/g, ''));
      return isNaN(val) ? null : (neg ? -val : val);
    })
    .filter(v => {
      if (v === null) return false;
      if (Math.abs(v) < 0.001) return false;
      // Skip likely page numbers / footnote numbers
      if (v > 0 && v < 10 && !String(v).includes('.')) return false;
      // Skip years
      if (excludeYears && v >= 2010 && v <= 2030) return false;
      return true;
    });
}

// ── Single-value field extractor ─────────────────────────────────────────
/**
 * Find a line matching one of the labels and return the first plausible number.
 * `numFilter` is an optional fn(val) → bool for range-checking the candidate.
 */
function findSingleValue(linesLower, lines, labels, numFilter) {
  for (const label of labels) {
    for (let i = 0; i < linesLower.length; i++) {
      if (!linesLower[i].includes(label)) continue;
      const text = [lines[i], lines[i + 1] || '', lines[i + 2] || ''].join(' ');
      const cleaned = text.replace(/\$/g, '').replace(/,(?=\d{3})/g, '');
      const matches = cleaned.match(/\(\d+(?:\.\d+)?\)|-?\d[\d.]+/g) || [];
      for (const m of matches) {
        const neg = m.startsWith('(');
        const v = parseFloat(m.replace(/[()]/g, ''));
        if (isNaN(v)) continue;
        const val = neg ? -v : v;
        if (!numFilter || numFilter(val)) return val;
      }
    }
  }
  return undefined;
}

/** Try to extract company name and ticker from cover/header lines. */
function extractCompanyMeta(lines) {
  let companyName, ticker;

  // Ticker: look for exchange:TICKER or (TICKER) or "Ticker: AAPL"
  for (const line of lines.slice(0, 60)) {
    const m = line.match(/(?:Nasdaq|NYSE|NASDAQ|NYSE Arca)[:\s]+([A-Z]{1,5})\b/)
           || line.match(/\(([A-Z]{1,5})\)\s*(?:Common Stock|Shares|Inc\.?|Corp\.?|$)/i)
           || line.match(/(?:Ticker|Symbol)\s*[:–]\s*([A-Z]{1,5})\b/i);
    if (m) { ticker = m[1]; break; }
  }

  // Company name: look for lines ending in Inc., Corp., Ltd., LLC, plc, etc.
  for (const line of lines.slice(0, 80)) {
    if (/\b(Inc\.?|Corp\.?|Ltd\.?|LLC|plc|N\.V\.|S\.A\.|Group)\b/i.test(line)
        && line.length > 4 && line.length < 80
        && !/^\d/.test(line.trim())
        && !/page|form|annual|report|fiscal|\d{4}/i.test(line)) {
      companyName = line.trim().replace(/,$/, '');
      break;
    }
  }

  return { companyName, ticker };
}

/**
 * Main PDF text → structured financials parser.
 * Returns { years: [...], meta: {...} }
 *
 * Strategy:
 *   1. Find fiscal years in a header row.
 *   2. For each multi-year field, scan for the label and map numbers to years.
 *   3. Extract single-value fields (shares, 52W prices, dividends, etc.).
 *   4. Compute all derived ratios from the latest year.
 */
function parseFinancialsFromText(rawText) {
  const lines = rawText
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.replace(/\t/g, '  ').trim())
    .filter(l => l.length > 0);

  const linesLower = lines.map(l => l.toLowerCase());

  // ── Step 1: Find fiscal years ─────────────────────────────────────────
  let headerYears = [];

  for (const line of lines) {
    const hits = [...line.matchAll(/\b(20[12]\d)\b/g)]
      .map(m => parseInt(m[1]))
      .filter(y => y >= 2015 && y <= 2030);
    const unique = [...new Set(hits)].sort((a, b) => a - b);
    if (unique.length >= 2) { headerYears = unique; break; }
  }

  if (!headerYears.length) {
    const allY = new Set();
    lines.forEach(l => {
      [...l.matchAll(/\b(20[12]\d)\b/g)].forEach(m => allY.add(parseInt(m[1])));
    });
    headerYears = [...allY].filter(y => y >= 2015 && y <= 2030).sort((a, b) => a - b);
  }

  if (!headerYears.length) return { years: [], meta: {} };

  const nYears = headerYears.length;

  // ── Step 2: Multi-year table fields ──────────────────────────────────
  const MULTI_FIELDS = [
    { key: 'revenue',          labels: ['total net revenue','total net sales','net revenue','net sales','total revenue','revenues','net product revenue'] },
    { key: 'cogs',             labels: ['cost of revenue','cost of sales','cost of goods sold','total cost of revenue','cost of products sold'] },
    { key: 'grossProfit',      labels: ['gross profit'] },
    { key: 'researchDev',      labels: ['research and development','r&d expense','research & development'] },
    { key: 'sgaExpense',       labels: ['selling, general and administrative','sg&a','selling general and administrative'] },
    { key: 'ebitda',           labels: ['ebitda','adjusted ebitda'] },
    { key: 'da',               labels: ['depreciation and amortization','depreciation & amortization','depreciation, amortization','total depreciation','amortization and depreciation'] },
    { key: 'ebit',             labels: ['operating income','income from operations','total operating income','operating profit','operating earnings'] },
    { key: 'interestExpense',  labels: ['interest expense','net interest expense','interest and other expense','interest, net'] },
    { key: 'incomeTax',        labels: ['provision for income taxes','income tax expense','income taxes'] },
    { key: 'netIncome',        labels: ['net income','net earnings','net profit','net income attributable to','consolidated net income'] },
    { key: 'eps',              labels: ['diluted earnings per share','earnings per diluted share','net income per diluted share','diluted net income per share','diluted eps','earnings per share, diluted'] },
    { key: 'epsBasic',         labels: ['basic earnings per share','net income per basic share','earnings per share, basic'] },
    { key: 'sharesOutstanding',labels: ['diluted shares','weighted-average diluted shares','diluted weighted average shares','shares used in computing diluted','diluted weighted-average shares'] },
    { key: 'dividendsPerShare',labels: ['cash dividends declared per share','dividends declared per share','dividends per common share','dividends per share'] },
    { key: 'cash',             labels: ['cash and cash equivalents','cash, cash equivalents','cash and equivalents'] },
    { key: 'shortTermInvest',  labels: ['short-term investments','short term investments','marketable securities, current'] },
    { key: 'currentAssets',    labels: ['total current assets'] },
    { key: 'totalAssets',      labels: ['total assets'] },
    { key: 'currentLiabilities',labels: ['total current liabilities','current liabilities, total'] },
    { key: 'totalDebt',        labels: ['long-term debt','total debt','total long-term debt','long term debt, net','term debt'] },
    { key: 'totalLiabilities', labels: ['total liabilities','total liabilities, non-controlling'] },
    { key: 'equity',           labels: ["total stockholders' equity","total shareholders' equity","stockholders' equity","shareholders' equity",'total equity'] },
    { key: 'operatingCF',      labels: ['net cash provided by operating activities','cash provided by operating','net cash from operating activities','cash flows from operations'] },
    { key: 'capex',            labels: ['purchases of property, plant','capital expenditures','additions to property','purchase of property and equipment','capex'] },
    { key: 'freeCashFlow',     labels: ['free cash flow'] },
    { key: 'stockBasedComp',   labels: ['stock-based compensation','share-based compensation','stock based compensation'] },
    { key: 'netDebtIssuance',  labels: ['repayments of debt','proceeds from issuance of debt'] },
    { key: 'dividendsPaid',    labels: ['payments for dividends','dividends paid','cash dividends paid'] },
    { key: 'buybacks',         labels: ['repurchases of common stock','share repurchases','common stock repurchased'] },
  ];

  const yearData = Object.fromEntries(headerYears.map(y => [y, { year: y }]));
  let columnDescending = false;

  MULTI_FIELDS.forEach(({ key, labels }, fieldIdx) => {
    for (const label of labels) {
      let foundIdx = -1;
      for (let i = 0; i < linesLower.length; i++) {
        if (linesLower[i].includes(label)) { foundIdx = i; break; }
      }
      if (foundIdx === -1) continue;

      const searchText = [lines[foundIdx], lines[foundIdx + 1] || '', lines[foundIdx + 2] || ''].join(' ');
      const nums = extractFinancialNumbers(searchText, true);
      const candidates = nums.filter(n => Math.abs(n) > 0.01);
      if (candidates.length < nYears) continue;

      const slice = candidates.slice(candidates.length - nYears);

      if (fieldIdx === 0 && slice[0] > slice[slice.length - 1]) columnDescending = true;

      const ordered = columnDescending ? [...slice].reverse() : slice;
      headerYears.forEach((y, i) => {
        if (ordered[i] !== undefined) yearData[y][key] = ordered[i];
      });
      break;
    }
  });

  // ── Step 3: Derive calculated fields per year ─────────────────────────
  const years = Object.values(yearData)
    .filter(r => r.revenue)
    .sort((a, b) => a.year - b.year);

  years.forEach((r, i) => {
    if (r.cogs && !r.grossProfit)                          r.grossProfit   = r.revenue - r.cogs;
    if (r.ebitda && r.da && !r.ebit)                       r.ebit          = r.ebitda - r.da;
    if (!r.ebitda && r.ebit && r.da)                       r.ebitda        = r.ebit + r.da;
    if (r.operatingCF && r.capex && !r.freeCashFlow)       r.freeCashFlow  = r.operatingCF - Math.abs(r.capex);
    if (!r.totalLiabilities && r.totalAssets && r.equity)  r.totalLiabilities = r.totalAssets - r.equity;

    r.grossMarginPct  = r.grossProfit ? r.grossProfit / r.revenue * 100 : undefined;
    r.ebitdaMarginPct = r.ebitda      ? r.ebitda      / r.revenue * 100 : undefined;
    r.ebitMarginPct   = r.ebit        ? r.ebit        / r.revenue * 100 : undefined;
    r.netMarginPct    = r.netIncome   ? r.netIncome   / r.revenue * 100 : undefined;
    r.fcfMarginPct    = r.freeCashFlow? r.freeCashFlow/ r.revenue * 100 : undefined;
    r.rAndDPct        = r.researchDev ? r.researchDev / r.revenue * 100 : undefined;

    r.roe             = (r.netIncome && r.equity && r.equity > 0)       ? r.netIncome / r.equity       * 100 : undefined;
    r.roa             = (r.netIncome && r.totalAssets && r.totalAssets > 0) ? r.netIncome / r.totalAssets * 100 : undefined;
    r.debtEquityRatio = (r.totalDebt  && r.equity && r.equity !== 0)    ? r.totalDebt  / r.equity             : undefined;
    r.currentRatio    = (r.currentAssets && r.currentLiabilities && r.currentLiabilities > 0)
                        ? r.currentAssets / r.currentLiabilities : undefined;
    r.netDebt         = (r.totalDebt && r.cash) ? r.totalDebt - r.cash : undefined;
    r.interestCoverage= (r.ebit && r.interestExpense && r.interestExpense !== 0)
                        ? Math.abs(r.ebit / r.interestExpense) : undefined;

    r.revGrowthPct    = (i > 0 && years[i - 1].revenue)
      ? (r.revenue - years[i - 1].revenue) / years[i - 1].revenue * 100 : undefined;
    r.netIncomeGrowthPct = (i > 0 && years[i-1].netIncome)
      ? (r.netIncome - years[i-1].netIncome) / Math.abs(years[i-1].netIncome) * 100 : undefined;
    r.epsGrowthPct    = (i > 0 && years[i-1].eps)
      ? (r.eps - years[i-1].eps) / Math.abs(years[i-1].eps) * 100 : undefined;
  });

  // ── Step 4: Single-value / scalar meta fields ─────────────────────────
  const meta = {};

  // Company name and ticker from cover page
  Object.assign(meta, extractCompanyMeta(lines));

  // Shares outstanding (in millions) — look for the scalar value on cover or footnote
  meta.sharesOutstanding = findSingleValue(linesLower, lines,
    ['shares outstanding','common shares outstanding','shares of common stock outstanding'],
    v => v > 10 && v < 500000);

  // Prefer the latest-year table value if available (more reliable)
  const lastYear = years[years.length - 1];
  if (lastYear?.sharesOutstanding) meta.sharesOutstandingLatest = lastYear.sharesOutstanding;

  // 52-week high / low (Part II of 10-K)
  meta.weekHigh52 = findSingleValue(linesLower, lines,
    ['52-week high','52 week high','fifty-two week high','stock price high','high stock price'],
    v => v > 0.5 && v < 100000);
  meta.weekLow52 = findSingleValue(linesLower, lines,
    ['52-week low','52 week low','fifty-two week low','stock price low','low stock price'],
    v => v > 0.5 && v < 100000);

  // Dividends per share (latest — look for the scalar near "per share" language)
  meta.dividendsPerShare = findSingleValue(linesLower, lines,
    ['cash dividends per share','dividends declared per share','dividends per common share','annual dividend per share'],
    v => v >= 0 && v < 500);

  // Market cap ($B) — may appear on cover of proxy or earnings release
  meta.marketCap = findSingleValue(linesLower, lines,
    ['market capitalization','market cap','aggregate market value'],
    v => v > 0.001 && v < 100000000);

  // P/E ratio — rarely in annual report, but check
  meta.peRatio = findSingleValue(linesLower, lines,
    ['price-to-earnings ratio','p/e ratio','price/earnings ratio','trailing p/e','p/e multiple'],
    v => v > 0 && v < 1000);

  // Beta — may appear in risk section
  meta.beta = findSingleValue(linesLower, lines,
    ['beta of','beta coefficient','stock beta'],
    v => v > -5 && v < 10);

  // ── Step 5: Compute derived fundamentals from latest year ─────────────
  if (lastYear) {
    const L = lastYear;

    // Shares to use: prefer extracted table shares (usually in millions)
    const shares = L.sharesOutstanding || meta.sharesOutstandingLatest || meta.sharesOutstanding;

    // EPS: prefer directly extracted; fallback to net income / shares
    if (!meta.eps) {
      meta.eps = L.eps
        || (L.netIncome && shares ? L.netIncome / shares : undefined);
    } else {
      meta.eps = L.eps;
    }

    // Margins from latest year
    meta.grossMargin  = L.grossMarginPct;
    meta.netMargin    = L.netMarginPct;
    meta.ebitdaMargin = L.ebitdaMarginPct;

    // Return metrics
    meta.roe          = L.roe;
    meta.roa          = L.roa;

    // Leverage / liquidity
    meta.debtEquity   = L.debtEquityRatio;
    meta.currentRatio = L.currentRatio;

    // Revenue growth (latest YoY)
    meta.revenueGrowth = L.revGrowthPct;

    // Computed P/E if we have EPS and current price already exists in form
    const existingPrice = parseFloat(document.getElementById('currentPrice').value);
    if (!meta.peRatio && meta.eps && meta.eps > 0 && existingPrice > 0) {
      meta.peRatio = existingPrice / meta.eps;
    }

    // Price/Book: needs shares and price
    if (shares && L.equity) {
      meta.bookValuePerShare = L.equity / shares;
    }

    // Net debt per share
    if (shares && L.netDebt) {
      meta.netDebtPerShare = L.netDebt / shares;
    }

    // Dividend yield needs current price — compute if both available
    const price = existingPrice || null;
    if (meta.dividendsPerShare && price && price > 0) {
      meta.dividendYield = (meta.dividendsPerShare / price) * 100;
    }
  }

  return { years, meta };
}

// ── Extracted data preview table ──────────────────────────────────────────
function buildExtractedPreview(data, meta = {}) {
  const table = document.getElementById('extractedTable');
  if (!data.length) return;

  const yearCols = data.map(d => d.year);

  // Section helper
  const sec = label => `<tr class="row-section"><td colspan="${yearCols.length + 1}">${label}</td></tr>`;

  const PREVIEW_FIELDS = [
    // Income statement
    { section: 'Income Statement' },
    { label: 'Revenue',                key: 'revenue' },
    { label: 'Revenue Growth %',       key: 'revGrowthPct',      pct: true, colorGrowth: true },
    { label: 'COGS',                   key: 'cogs' },
    { label: 'Gross Profit',           key: 'grossProfit' },
    { label: 'Gross Margin %',         key: 'grossMarginPct',    pct: true },
    { label: 'R&D Expense',            key: 'researchDev' },
    { label: 'SG&A Expense',           key: 'sgaExpense' },
    { label: 'EBITDA',                 key: 'ebitda' },
    { label: 'EBITDA Margin %',        key: 'ebitdaMarginPct',   pct: true },
    { label: 'D&A',                    key: 'da' },
    { label: 'EBIT / Op. Income',      key: 'ebit' },
    { label: 'EBIT Margin %',          key: 'ebitMarginPct',     pct: true },
    { label: 'Interest Expense',       key: 'interestExpense' },
    { label: 'Interest Coverage (x)',  key: 'interestCoverage',  ratio: true },
    { label: 'Income Tax',             key: 'incomeTax' },
    { label: 'Net Income',             key: 'netIncome',          colorSign: true },
    { label: 'Net Income Growth %',    key: 'netIncomeGrowthPct', pct: true, colorGrowth: true },
    { label: 'Net Margin %',           key: 'netMarginPct',       pct: true },
    { label: 'EPS (Diluted)',          key: 'eps',                eps: true },
    { label: 'EPS Growth %',           key: 'epsGrowthPct',       pct: true, colorGrowth: true },
    { label: 'EPS (Basic)',            key: 'epsBasic',           eps: true },
    { label: 'Shares Outstanding (M)', key: 'sharesOutstanding',  ratio: true },
    { label: 'Dividends Per Share',    key: 'dividendsPerShare',  eps: true },
    // Balance sheet
    { section: 'Balance Sheet' },
    { label: 'Cash & Equivalents',     key: 'cash' },
    { label: 'Short-Term Investments', key: 'shortTermInvest' },
    { label: 'Total Current Assets',   key: 'currentAssets' },
    { label: 'Total Assets',           key: 'totalAssets' },
    { label: 'Total Current Liabilities', key: 'currentLiabilities' },
    { label: 'Current Ratio (x)',      key: 'currentRatio',       ratio: true },
    { label: 'Total Debt',             key: 'totalDebt' },
    { label: 'Net Debt',               key: 'netDebt',            colorSign: true },
    { label: "Stockholders' Equity",   key: 'equity',             colorSign: true },
    { label: 'Debt / Equity',          key: 'debtEquityRatio',    ratio: true },
    // Returns
    { section: 'Returns & Profitability' },
    { label: 'Return on Equity %',     key: 'roe',                pct: true },
    { label: 'Return on Assets %',     key: 'roa',                pct: true },
    // Cash flow
    { section: 'Cash Flow Statement' },
    { label: 'Operating Cash Flow',    key: 'operatingCF',        colorSign: true },
    { label: 'Capital Expenditures',   key: 'capex' },
    { label: 'Free Cash Flow',         key: 'freeCashFlow',       colorSign: true },
    { label: 'FCF Margin %',           key: 'fcfMarginPct',       pct: true },
    { label: 'Stock-Based Comp.',      key: 'stockBasedComp' },
    { label: 'Dividends Paid',         key: 'dividendsPaid' },
    { label: 'Share Buybacks',         key: 'buybacks' },
  ];

  table.querySelector('thead').innerHTML =
    `<tr><th>Metric</th>${yearCols.map(y => `<th>${y}</th>`).join('')}</tr>`;

  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';

  PREVIEW_FIELDS.forEach(f => {
    if (f.section) {
      tbody.innerHTML += sec(f.section);
      return;
    }
    const vals = data.map(d => d[f.key]);
    if (vals.every(v => v === undefined)) return;

    let cells = `<td>${f.label}</td>`;
    vals.forEach(v => {
      if (v === undefined || v === null) { cells += '<td class="cell-dim">—</td>'; return; }
      const txt = f.pct   ? fmtPct(v)
                : f.eps   ? '$' + v.toFixed(2)
                : f.ratio ? v.toFixed(2) + 'x'
                : fmtFin(v);
      let cls = '';
      if (f.colorSign)   cls = v >= 0 ? 'cell-positive' : 'cell-negative';
      if (f.colorGrowth) cls = v >= 10 ? 'cell-positive' : v >= 0 ? '' : 'cell-negative';
      cells += `<td class="${cls}">${txt}</td>`;
    });
    tbody.innerHTML += `<tr>${cells}</tr>`;
  });

  // Scalar meta section
  const metaRows = [
    { label: '52-Week High',         val: meta.weekHigh52,       fmt: v => '$' + v.toFixed(2) },
    { label: '52-Week Low',          val: meta.weekLow52,        fmt: v => '$' + v.toFixed(2) },
    { label: 'Annual Dividend/Share',val: meta.dividendsPerShare,fmt: v => '$' + v.toFixed(2) },
    { label: 'Dividend Yield %',     val: meta.dividendYield,    fmt: v => fmtPct(v) },
    { label: 'Shares Outstanding (M)',val: meta.sharesOutstandingLatest || meta.sharesOutstanding, fmt: v => v.toFixed(1) },
    { label: 'Book Value/Share',     val: meta.bookValuePerShare,fmt: v => '$' + v.toFixed(2) },
    { label: 'P/E Ratio',            val: meta.peRatio,          fmt: v => v.toFixed(1) + 'x' },
    { label: 'Beta',                 val: meta.beta,             fmt: v => v.toFixed(2) },
  ].filter(r => r.val !== undefined && r.val !== null);

  if (metaRows.length) {
    tbody.innerHTML += sec('Extracted Scalar / Ratio Metrics');
    metaRows.forEach(r => {
      tbody.innerHTML += `<tr><td>${r.label}</td><td colspan="${yearCols.length}" style="text-align:left">${r.fmt(r.val)}</td></tr>`;
    });
  }
}

// ── Populate all input form fields from PDF extraction ────────────────────
function populateFormFromPDF(years, meta) {
  function setField(id, val) {
    if (val === undefined || val === null || isNaN(val)) return;
    const el = document.getElementById(id);
    if (el) el.value = typeof val === 'number' ? parseFloat(val.toFixed(4)) : val;
  }
  const last = years[years.length - 1];

  // ── Company Info ─────────────────────────────────────────────────────
  if (meta.companyName) setField('companyName', meta.companyName);
  if (meta.ticker)      setField('tickerSymbol', meta.ticker);

  // ── Pricing ─────────────────────────────────────────────────────────
  setField('weekHigh52',  meta.weekHigh52);
  setField('weekLow52',   meta.weekLow52);

  // ── Fundamentals: Valuation ─────────────────────────────────────────
  setField('eps',         meta.eps ?? last?.eps);
  setField('peRatio',     meta.peRatio);

  // P/B: book value per share needs current price — compute if price is filled
  const currentPriceVal = parseFloat(document.getElementById('currentPrice').value);
  if (meta.bookValuePerShare && currentPriceVal > 0) {
    setField('pbRatio', currentPriceVal / meta.bookValuePerShare);
  }

  // ── Fundamentals: Growth & Profitability ────────────────────────────
  setField('revenueGrowth', meta.revenueGrowth ?? last?.revGrowthPct);
  setField('grossMargin',   meta.grossMargin   ?? last?.grossMarginPct);
  setField('netMargin',     meta.netMargin     ?? last?.netMarginPct);
  setField('roe',           meta.roe           ?? last?.roe);
  setField('roa',           meta.roa           ?? last?.roa);

  // ── Fundamentals: Financial Health ─────────────────────────────────
  setField('debtEquity',    meta.debtEquity    ?? last?.debtEquityRatio);
  setField('currentRatio',  meta.currentRatio  ?? last?.currentRatio);

  // ── Fundamentals: Income ────────────────────────────────────────────
  setField('dividendYield', meta.dividendYield ?? last?.dividendYield);

  // ── DCF helpers (shares outstanding, net debt) ───────────────────────
  const shares = meta.sharesOutstandingLatest ?? meta.sharesOutstanding ?? last?.sharesOutstanding;
  if (shares) setField('dcfShares', shares);

  if (last?.netDebt) setField('dcfNetDebt', last.netDebt);
}

// ── Count how many fundamentals form fields now have a value ─────────────
function countAutoFilledFields() {
  const ids = [
    'companyName','tickerSymbol','eps','peRatio','pbRatio',
    'revenueGrowth','grossMargin','netMargin','roe','roa',
    'debtEquity','currentRatio','dividendYield',
    'weekHigh52','weekLow52','dcfShares','dcfNetDebt',
  ];
  return ids.filter(id => {
    const el = document.getElementById(id);
    return el && el.value.trim() !== '';
  }).length;
}

// ── File upload & drop zone ───────────────────────────────────────────────
const dropZone = document.getElementById('fileDropZone');
const fileInput = document.getElementById('financialFileInput');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

dropZone.addEventListener('dragover', e => {
  e.preventDefault(); dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFinancialFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFinancialFile(fileInput.files[0]);
});

function isPDFUploadPanelActive() {
  return document.getElementById('fin-panel-pdf')?.classList.contains('active');
}

function getPDFFileFromClipboard(event) {
  const clipboard = event.clipboardData;
  if (!clipboard) return null;

  const directFile = Array.from(clipboard.files || []).find(file =>
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
  if (directFile) return directFile;

  const fileItem = Array.from(clipboard.items || []).find(item =>
    item.kind === 'file' && item.type === 'application/pdf'
  );
  return fileItem ? fileItem.getAsFile() : null;
}

dropZone.addEventListener('paste', e => {
  const file = getPDFFileFromClipboard(e);
  if (!file) return;
  e.preventDefault();
  handleFinancialFile(file);
});

document.addEventListener('paste', e => {
  if (!isPDFUploadPanelActive()) return;
  if (document.activeElement === dropZone) return;

  const file = getPDFFileFromClipboard(e);
  if (!file) return;

  e.preventDefault();
  handleFinancialFile(file);
});

async function handleFinancialFile(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showFinBadge('Please upload a PDF file.', false);
    return;
  }

  if (typeof pdfjsLib === 'undefined') {
    showFinBadge('PDF.js library not loaded — check your internet connection.', false);
    return;
  }

  // Show parsing state
  setPDFState('parsing', 'Loading PDF…');

  try {
    const text = await extractTextFromPDF(file, (page, total) => {
      setPDFState('parsing', `Reading page ${page} of ${total}…`);
    });

    // Store raw text globally for Report Chat
    pdfRawText  = text;
    pdfFileName = file.name;
    pdfSections = parsePDFSections(text);

    setPDFState('parsing', 'Extracting financial data…');

    const { years: parsed, meta } = parseFinancialsFromText(text);

    if (!parsed.length) {
      setPDFState('idle');
      showFinBadge('Could not find financial data in this PDF. Try the Manual CSV tab.', false);
      return;
    }

    financialData = parsed;
    const yearRange = `${parsed[0].year}–${parsed[parsed.length - 1].year}`;
    // Count non-empty raw fields in the latest year (exclude computed pct/ratio keys)
    const lastYr = parsed[parsed.length - 1];
    const rawKeys = Object.keys(lastYr).filter(k =>
      k !== 'year' && !k.endsWith('Pct') && !k.endsWith('Ratio') &&
      !['roe','roa','debtEquityRatio','currentRatio','netDebt','interestCoverage',
        'netIncomeGrowthPct','epsGrowthPct'].includes(k)
    );
    const fieldsFound = rawKeys.filter(k => lastYr[k] !== undefined).length;

    // Populate every form field from extracted data + computed meta
    populateFormFromPDF(parsed, meta);

    const autoFilled = countAutoFilledFields();
    setPDFState('done',
      `${parsed.length} fiscal years (${yearRange}) · ${fieldsFound} statement metrics · ${autoFilled} form fields auto-filled`);
    showFinBadge(`${parsed.length} years loaded from PDF (${yearRange}) — form fields updated`, true);

    buildExtractedPreview(parsed, meta);
    populateDCFDefaults();
    renderThreeStatement(financialData);
    document.getElementById('modelsEmpty').style.display = 'none';
    document.getElementById('modelsContent').style.display = 'block';

  } catch (err) {
    setPDFState('idle');
    showFinBadge('Error reading PDF: ' + err.message, false);
    console.error('PDF parse error:', err);
  }
}

function setPDFState(state, message = '') {
  document.getElementById('pdfIdle').style.display    = state === 'idle'    ? 'block' : 'none';
  document.getElementById('pdfParsing').style.display = state === 'parsing' ? 'flex'  : 'none';
  document.getElementById('pdfDone').style.display    = state === 'done'    ? 'flex'  : 'none';
  if (state === 'parsing') document.getElementById('pdfParseStatus').textContent = message;
  if (state === 'done')    document.getElementById('pdfDoneSummary').textContent = message;
}

document.getElementById('viewExtractedBtn').addEventListener('click', () => {
  document.getElementById('extractedPreview').style.display = 'block';
  buildExtractedPreview(financialData);
});

document.getElementById('closePreviewBtn').addEventListener('click', () => {
  document.getElementById('extractedPreview').style.display = 'none';
});

// ── Fin input tab switching (PDF vs CSV) ──────────────────────────────────
document.querySelectorAll('#finInputTabs .pill-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#finInputTabs .pill-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.finTab;
    document.querySelectorAll('.fin-input-panel').forEach(p => {
      p.classList.toggle('active', p.id === 'fin-panel-' + target);
    });
  });
});

// ── Manual CSV parsing (fallback) ─────────────────────────────────────────
document.getElementById('parseFinancialsBtn').addEventListener('click', triggerParseFinancialsCSV);

function triggerParseFinancialsCSV() {
  const text = document.getElementById('financialCSV').value;
  const parsed = parseFinancials(text);  // existing CSV parser
  if (!parsed.length) {
    showFinBadge('Could not parse — check columns. Required: Year, Revenue', false);
    return;
  }
  financialData = parsed;
  showFinBadge(`${parsed.length} fiscal years loaded (${parsed[0].year}–${parsed[parsed.length-1].year})`, true);
  populateDCFDefaults();
  renderThreeStatement(financialData);
  document.getElementById('modelsEmpty').style.display = 'none';
  document.getElementById('modelsContent').style.display = 'block';
}

function showFinBadge(text, ok) {
  const badge = document.getElementById('financialBadge');
  badge.style.display = 'inline-flex';
  badge.style.background = ok ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)';
  badge.style.borderColor = ok ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)';
  badge.style.color = ok ? '#6ee7b7' : '#fca5a5';
  document.getElementById('financialBadgeText').textContent = text;
}

// ── Sample CSV download ───────────────────────────────────────────────────
const SAMPLE_FINANCIALS_CSV = `Year,Revenue,COGS,EBITDA,DA,NetIncome,EPS,Cash,TotalAssets,TotalDebt,Equity,OperatingCF,CapEx
2019,260174,161782,76477,12547,55256,3.00,48844,338516,108047,90488,69391,6383
2020,274515,169559,77344,11289,57411,3.28,38016,323888,112436,65339,80674,7309
2021,365817,212981,120233,12519,94680,5.67,62639,351002,124719,63090,104038,11085
2022,394328,223546,130541,11284,99803,6.15,23646,352755,120069,50672,122151,10708
2023,383285,214137,123507,11519,96995,6.16,29965,352583,111135,62146,110543,11248`;

document.getElementById('downloadSampleCSVBtn').addEventListener('click', () => {
  const blob = new Blob([SAMPLE_FINANCIALS_CSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'sample_financials.csv';
  a.click(); URL.revokeObjectURL(url);
});

// ── Load AAPL sample into financials ─────────────────────────────────────
document.getElementById('loadSampleFinancialsBtn').addEventListener('click', () => {
  document.getElementById('financialCSV').value = SAMPLE_FINANCIALS_CSV;
  triggerParseFinancialsCSV();
});

// ── Models sub-tab switching ──────────────────────────────────────────────
document.querySelectorAll('.models-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.models-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.models-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.modelsTab).classList.add('active');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// DCF MODEL
// ══════════════════════════════════════════════════════════════════════════

function populateDCFDefaults() {
  if (!financialData.length) return;
  const last = financialData[financialData.length - 1];

  // EBITDA margin default = average of last 3 years
  const margins = financialData.slice(-3).map(r => r.ebitdaMarginPct).filter(v => v !== undefined);
  if (margins.length) {
    document.getElementById('dcfEBITDAMargin').value = (margins.reduce((a,b)=>a+b,0)/margins.length).toFixed(1);
  }

  // D&A % default
  const daRatios = financialData.slice(-3).filter(r=>r.da&&r.revenue).map(r=>r.da/r.revenue*100);
  if (daRatios.length) document.getElementById('dcfDA').value = (daRatios.reduce((a,b)=>a+b,0)/daRatios.length).toFixed(1);

  // CapEx % default
  const cxRatios = financialData.slice(-3).filter(r=>r.capex&&r.revenue).map(r=>r.capex/r.revenue*100);
  if (cxRatios.length) document.getElementById('dcfCapEx').value = (cxRatios.reduce((a,b)=>a+b,0)/cxRatios.length).toFixed(1);

  // Revenue growth: CAGR of available history
  if (financialData.length >= 2) {
    const first = financialData[0], n = financialData.length - 1;
    const cagr = (Math.pow(last.revenue / first.revenue, 1/n) - 1) * 100;
    buildGrowthInputs(parseInt(document.getElementById('dcfYears').value), Math.max(0, cagr).toFixed(1));
  }
}

function buildGrowthInputs(years, defaultRate = '5.0') {
  const container = document.getElementById('growthRateInputs');
  container.innerHTML = '';
  for (let i = 1; i <= years; i++) {
    container.innerHTML += `
      <label class="form-field">
        <span>Year ${i} (%)</span>
        <input type="number" id="dcfGrowth${i}" value="${defaultRate}" step="0.1">
      </label>`;
  }
}

document.getElementById('dcfYears').addEventListener('change', function() {
  buildGrowthInputs(parseInt(this.value));
});

// Initialize with 5 years of growth inputs
buildGrowthInputs(5, '5.0');

document.getElementById('runDCFBtn').addEventListener('click', runDCF);

function runDCF() {
  if (!financialData.length) {
    alert('Load financial data first on the Data Input tab.');
    return;
  }

  const wacc    = parseFloat(document.getElementById('dcfWACC').value) / 100;
  const tgr     = parseFloat(document.getElementById('dcfTGR').value)  / 100;
  const taxRate = parseFloat(document.getElementById('dcfTaxRate').value) / 100;
  const nYears  = parseInt(document.getElementById('dcfYears').value);
  const ebitdaM = parseFloat(document.getElementById('dcfEBITDAMargin').value) / 100;
  const daPct   = parseFloat(document.getElementById('dcfDA').value)     / 100;
  const cxPct   = parseFloat(document.getElementById('dcfCapEx').value)  / 100;
  const wcPct   = parseFloat(document.getElementById('dcfDeltaWC').value) / 100;
  const shares  = parseFloat(document.getElementById('dcfShares').value);
  const netDebt = parseFloat(document.getElementById('dcfNetDebt').value) || 0;

  if (isNaN(wacc) || isNaN(tgr) || isNaN(taxRate) || isNaN(ebitdaM) || isNaN(daPct) || isNaN(cxPct)) {
    alert('Please fill in all DCF assumptions.');
    return;
  }

  if (wacc <= tgr) {
    alert('WACC must be greater than the Terminal Growth Rate.');
    return;
  }

  const growthRates = [];
  for (let i = 1; i <= nYears; i++) {
    const g = parseFloat(document.getElementById(`dcfGrowth${i}`)?.value);
    growthRates.push(isNaN(g) ? 0.05 : g / 100);
  }

  const lastRevenue = financialData[financialData.length - 1].revenue;
  const projections = [];
  let prevRev = lastRevenue;

  for (let i = 0; i < nYears; i++) {
    const rev     = prevRev * (1 + growthRates[i]);
    const ebitda  = rev * ebitdaM;
    const da      = rev * daPct;
    const ebit    = ebitda - da;
    const nopat   = ebit * (1 - taxRate);
    const capex   = rev * cxPct;
    const deltaWC = (rev - prevRev) * wcPct;
    const fcff    = nopat + da - capex - deltaWC;
    const disc    = Math.pow(1 + wacc, i + 1);
    const pvFCFF  = fcff / disc;

    projections.push({ year: 'Y' + (i+1), rev, ebitda, da, ebit, nopat, capex, deltaWC, fcff, disc, pvFCFF, growth: growthRates[i] });
    prevRev = rev;
  }

  const lastFCFF  = projections[projections.length - 1].fcff;
  const termVal   = lastFCFF * (1 + tgr) / (wacc - tgr);
  const pvTermVal = termVal / Math.pow(1 + wacc, nYears);
  const pvFCFFSum = projections.reduce((s, p) => s + p.pvFCFF, 0);
  const ev        = pvFCFFSum + pvTermVal;
  const equityVal = ev - netDebt;
  const impliedPrice = !isNaN(shares) && shares > 0 ? equityVal / shares : null;

  // Update KPIs
  document.getElementById('dcfEV').textContent      = '$' + fmtFin(ev);
  document.getElementById('dcfEquity').textContent  = '$' + fmtFin(equityVal);
  document.getElementById('dcfImplied').textContent = impliedPrice ? '$' + impliedPrice.toFixed(2) : 'N/A';

  const currentP = stockData?.inputs?.currentPrice;
  if (impliedPrice && currentP) {
    const upside = (impliedPrice - currentP) / currentP * 100;
    const upsideEl = document.getElementById('dcfUpside');
    upsideEl.textContent = (upside >= 0 ? '+' : '') + upside.toFixed(1) + '%';
    upsideEl.style.color = upside >= 0 ? 'var(--green)' : 'var(--red)';
  } else {
    document.getElementById('dcfUpside').textContent = 'N/A';
  }

  // Build projection table
  const dcfTable = document.getElementById('dcfTable');
  const hdrCols  = projections.map(p => `<th>${p.year}</th>`).join('');
  dcfTable.querySelector('thead').innerHTML = `<tr><th>Metric</th>${hdrCols}<th>Terminal</th></tr>`;
  const dcfRows = [
    ['Revenue',         p => fmtFin(p.rev)],
    ['Rev Growth %',    p => fmtPct(p.growth * 100)],
    ['EBITDA',          p => fmtFin(p.ebitda)],
    ['EBITDA Margin %', p => fmtPct((p.ebitda/p.rev)*100)],
    ['D&A',             p => fmtFin(p.da)],
    ['EBIT',            p => fmtFin(p.ebit)],
    ['NOPAT',           p => fmtFin(p.nopat)],
    ['CapEx',           p => fmtFin(p.capex)],
    ['ΔWorking Capital',p => fmtFin(p.deltaWC)],
    ['FCFF',            p => fmtFin(p.fcff)],
    ['Discount Factor', p => p.disc.toFixed(3)],
    ['PV of FCFF',      p => fmtFin(p.pvFCFF)],
  ];
  const tBody = dcfTable.querySelector('tbody');
  tBody.innerHTML = '';
  dcfRows.forEach(([label, fn], ri) => {
    const cls = ri === 9 ? 'row-subtotal' : ri === 11 ? 'row-total' : ri === 1 ? 'row-margin' : '';
    const termCell = ri === 9 ? `<td>${fmtFin(termVal)}</td>`
                   : ri === 11 ? `<td>${fmtFin(pvTermVal)}</td>` : '<td>—</td>';
    tBody.innerHTML += `<tr class="${cls}"><td>${label}</td>${projections.map(p=>`<td>${fn(p)}</td>`).join('')}${termCell}</tr>`;
  });
  // Summary row
  tBody.innerHTML += `<tr class="row-total"><td>Enterprise Value</td>${projections.map(()=>'<td></td>').join('')}<td>$${fmtFin(ev)}</td></tr>`;

  document.getElementById('dcfTableWrap').style.display = 'block';

  // Sensitivity table
  buildSensitivityTable(impliedPrice, nYears, lastFCFF, wacc, tgr, netDebt, shares, pvFCFFSum);
  document.getElementById('sensitivityWrap').style.display = 'block';
}

function buildSensitivityTable(base, nYears, lastFCFF, baseWACC, baseTGR, netDebt, shares, pvFCFFBase) {
  const waccRange = [-0.02, -0.015, -0.01, -0.005, 0, 0.005, 0.01, 0.015, 0.02];
  const tgrRange  = [-0.01, -0.005, 0, 0.005, 0.01];

  const table = document.getElementById('sensitivityTable');
  table.querySelector('thead').innerHTML =
    `<tr><th>WACC \\ TGR</th>${tgrRange.map(t => `<th>${((baseTGR + t)*100).toFixed(1)}%</th>`).join('')}</tr>`;

  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';

  waccRange.forEach(wd => {
    const w = baseWACC + wd;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${(w*100).toFixed(1)}%</td>`;
    tgrRange.forEach(td => {
      const g = baseTGR + td;
      if (w <= g) { tr.innerHTML += '<td class="cell-dim">n/a</td>'; return; }
      const tv = lastFCFF * (1 + g) / (w - g);
      const pvTV = tv / Math.pow(1 + w, nYears);
      const evNew = pvFCFFBase + pvTV;  // simplified: reuse PV of FCFFs
      const implNew = (shares && shares > 0) ? (evNew - netDebt) / shares : null;
      const txt = implNew ? '$' + implNew.toFixed(2) : 'N/A';
      const cls = (wd === 0 && td === 0) ? 'sens-base'
                : implNew && base && implNew > base * 1.1 ? 'sens-high'
                : implNew && base && implNew < base * 0.9 ? 'sens-low' : 'sens-mid';
      tr.innerHTML += `<td class="${cls}">${txt}</td>`;
    });
    tbody.appendChild(tr);
  });
}

// ══════════════════════════════════════════════════════════════════════════
// TRADING COMPS
// ══════════════════════════════════════════════════════════════════════════

let compRows = [];

function addCompRow(data = {}) {
  const id = Date.now() + Math.random();
  compRows.push(id);
  const tbody = document.getElementById('compsBody');
  const tr = document.createElement('tr');
  tr.dataset.rowId = id;
  tr.innerHTML = `
    <td><input type="text" placeholder="Company name" value="${data.name||''}"></td>
    <td><input type="number" step="0.1" placeholder="—" value="${data.evRev||''}"></td>
    <td><input type="number" step="0.1" placeholder="—" value="${data.evEBITDA||''}"></td>
    <td><input type="number" step="0.1" placeholder="—" value="${data.pe||''}"></td>
    <td><input type="number" step="0.1" placeholder="—" value="${data.evEBIT||''}"></td>
    <td><button class="btn-icon-remove" title="Remove">✕</button></td>
  `;
  tr.querySelector('.btn-icon-remove').addEventListener('click', () => {
    tr.remove();
    compRows = compRows.filter(r => r !== id);
  });
  tbody.appendChild(tr);
}

document.getElementById('addCompBtn').addEventListener('click', () => addCompRow());

// Seed 3 example comps for AAPL context
function seedSampleComps() {
  addCompRow({ name: 'Microsoft', evRev: 13.2, evEBITDA: 28.1, pe: 35.4, evEBIT: 30.2 });
  addCompRow({ name: 'Alphabet',  evRev: 6.8,  evEBITDA: 18.4, pe: 24.1, evEBIT: 20.5 });
  addCompRow({ name: 'Meta',      evRev: 8.1,  evEBITDA: 21.3, pe: 27.8, evEBIT: 23.1 });
}

document.querySelector('[data-models-tab="comps"]').addEventListener('click', () => {
  if (document.getElementById('compsBody').rows.length === 0) seedSampleComps();
  if (financialData.length) renderComps();
});

document.querySelector('[data-models-tab="precedent"]').addEventListener('click', () => {
  if (document.getElementById('txnBody').rows.length === 0) seedSampleTxns();
  if (financialData.length) renderTxns();
});

function getCompMultiples() {
  const rows = document.querySelectorAll('#compsBody tr');
  return Array.from(rows).map(tr => {
    const inputs = tr.querySelectorAll('input');
    return {
      name:     inputs[0].value || 'Unnamed',
      evRev:    parseFloat(inputs[1].value),
      evEBITDA: parseFloat(inputs[2].value),
      pe:       parseFloat(inputs[3].value),
      evEBIT:   parseFloat(inputs[4].value),
    };
  }).filter(r => !isNaN(r.evRev) || !isNaN(r.evEBITDA) || !isNaN(r.pe));
}

function impliedRange(vals, targetMetric) {
  const implied = vals.filter(v => !isNaN(v) && v > 0).map(v => v * targetMetric);
  if (!implied.length) return null;
  implied.sort((a,b) => a-b);
  return {
    min:    implied[0],
    max:    implied[implied.length-1],
    median: implied[Math.floor(implied.length/2)],
  };
}

function renderComps() {
  if (!financialData.length) return;
  const last    = financialData[financialData.length - 1];
  const comps   = getCompMultiples();
  if (!comps.length) return;

  const netDebt = parseFloat(document.getElementById('dcfNetDebt').value) || 0;
  const shares  = parseFloat(document.getElementById('dcfShares').value);

  const ranges = [];
  const impliedEl = document.getElementById('compsImplied');
  impliedEl.innerHTML = '';

  const metrics = [
    { label: 'EV / Revenue',  key: 'evRev',    base: last.revenue },
    { label: 'EV / EBITDA',   key: 'evEBITDA', base: last.ebitda },
    { label: 'P/E',           key: 'pe',        base: last.eps ? last.eps * (shares||1) : null, isEquity: true },
    { label: 'EV / EBIT',     key: 'evEBIT',   base: last.ebit },
  ];

  metrics.forEach(m => {
    if (!m.base) return;
    const vals = comps.map(c => c[m.key]);
    const range = impliedRange(vals, m.base);
    if (!range) return;

    let eqMin, eqMax, eqMed;
    if (m.isEquity) {
      eqMin = range.min; eqMax = range.max; eqMed = range.median;
    } else {
      eqMin = range.min - netDebt; eqMax = range.max - netDebt; eqMed = range.median - netDebt;
    }

    ranges.push({ label: m.label, min: eqMin, max: eqMax, median: eqMed });

    const priceMed = (shares && shares > 0) ? eqMed / shares : null;
    const hasPrice = (shares && shares > 0);

    impliedEl.innerHTML += `
      <div class="implied-card">
        <p>${m.label}</p>
        <div class="impl-range">$${fmtFin(eqMin)} – $${fmtFin(eqMax)}</div>
        <div class="impl-median">Median: $${fmtFin(eqMed)}${hasPrice ? ` · Per share: $${priceMed?.toFixed(2)}` : ''}</div>
      </div>`;
  });

  document.getElementById('compsResults').style.display = 'block';

  // Football field
  if (ranges.length) renderFootballField('footballChart', ranges, stockData?.inputs?.currentPrice);
}

// ══════════════════════════════════════════════════════════════════════════
// PRECEDENT TRANSACTIONS
// ══════════════════════════════════════════════════════════════════════════

function addTxnRow(data = {}) {
  const tbody = document.getElementById('txnBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" placeholder="Target" value="${data.target||''}"></td>
    <td><input type="text" placeholder="Acquirer" value="${data.acquirer||''}"></td>
    <td><input type="number" step="1" placeholder="Year" value="${data.year||''}"></td>
    <td><input type="number" step="0.1" placeholder="—" value="${data.evRev||''}"></td>
    <td><input type="number" step="0.1" placeholder="—" value="${data.evEBITDA||''}"></td>
    <td><input type="number" step="0.1" placeholder="—" value="${data.premium||''}"></td>
    <td><button class="btn-icon-remove" title="Remove">✕</button></td>
  `;
  tr.querySelector('.btn-icon-remove').addEventListener('click', () => tr.remove());
  tbody.appendChild(tr);
}

document.getElementById('addTxnBtn').addEventListener('click', () => addTxnRow());

function seedSampleTxns() {
  addTxnRow({ target: 'LinkedIn',   acquirer: 'Microsoft',  year: 2016, evRev: 11.4, evEBITDA: 79.2, premium: 49.5 });
  addTxnRow({ target: 'GitHub',     acquirer: 'Microsoft',  year: 2018, evRev: 18.0, evEBITDA: null,  premium: null });
  addTxnRow({ target: 'Instagram',  acquirer: 'Facebook',   year: 2012, evRev: null, evEBITDA: null,  premium: null });
  addTxnRow({ target: 'WhatsApp',   acquirer: 'Facebook',   year: 2014, evRev: 190.0, evEBITDA: null, premium: null });
}

function getTxnMultiples() {
  const rows = document.querySelectorAll('#txnBody tr');
  return Array.from(rows).map(tr => {
    const inputs = tr.querySelectorAll('input');
    return {
      target:   inputs[0].value,
      acquirer: inputs[1].value,
      year:     inputs[2].value,
      evRev:    parseFloat(inputs[3].value),
      evEBITDA: parseFloat(inputs[4].value),
      premium:  parseFloat(inputs[5].value),
    };
  }).filter(r => !isNaN(r.evRev) || !isNaN(r.evEBITDA));
}

function renderTxns() {
  if (!financialData.length) return;
  const last  = financialData[financialData.length - 1];
  const txns  = getTxnMultiples();
  if (!txns.length) return;

  const netDebt = parseFloat(document.getElementById('dcfNetDebt').value) || 0;
  const shares  = parseFloat(document.getElementById('dcfShares').value);

  const ranges = [];
  const impliedEl = document.getElementById('txnImplied');
  impliedEl.innerHTML = '';

  const metrics = [
    { label: 'EV / Revenue',  key: 'evRev',    base: last.revenue },
    { label: 'EV / EBITDA',   key: 'evEBITDA', base: last.ebitda },
  ];

  metrics.forEach(m => {
    if (!m.base) return;
    const vals = txns.map(t => t[m.key]);
    const range = impliedRange(vals, m.base);
    if (!range) return;

    const eqMin = range.min - netDebt, eqMax = range.max - netDebt, eqMed = range.median - netDebt;
    ranges.push({ label: m.label + ' (Precedent)', min: eqMin, max: eqMax, median: eqMed });

    const priceMed = (shares && shares > 0) ? eqMed / shares : null;

    impliedEl.innerHTML += `
      <div class="implied-card">
        <p>${m.label} — Precedent</p>
        <div class="impl-range">$${fmtFin(eqMin)} – $${fmtFin(eqMax)}</div>
        <div class="impl-median">Median: $${fmtFin(eqMed)}${priceMed ? ` · Per share: $${priceMed?.toFixed(2)}` : ''}</div>
      </div>`;
  });

  // Control premium if shares known
  const premiums = txns.map(t => t.premium).filter(v => !isNaN(v));
  if (premiums.length && stockData?.inputs?.currentPrice && shares > 0) {
    const mktCap = stockData.inputs.currentPrice * shares;
    const medPrem = premiums.sort((a,b)=>a-b)[Math.floor(premiums.length/2)] / 100;
    const impliedEq = mktCap * (1 + medPrem);
    impliedEl.innerHTML += `
      <div class="implied-card">
        <p>Control Premium (median: ${(medPrem*100).toFixed(1)}%)</p>
        <div class="impl-range">Implied Mkt Cap</div>
        <div class="impl-median">$${fmtFin(impliedEq)} ($${(impliedEq/shares).toFixed(2)} / share)</div>
      </div>`;
    ranges.push({ label: 'Control Premium', min: mktCap*(1+premiums[0]/100), max: mktCap*(1+premiums[premiums.length-1]/100), median: impliedEq });
  }

  document.getElementById('txnResults').style.display = 'block';
  if (ranges.length) renderFootballField('txnFootballChart', ranges, stockData?.inputs?.currentPrice);
}

// ── Football field chart ─────────────────────────────────────────────────
function renderFootballField(canvasId, ranges, currentPrice) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');

  const allVals = ranges.flatMap(r => [r.min, r.max]).filter(v => !isNaN(v));
  const globalMin = Math.min(...allVals) * 0.95;
  const globalMax = Math.max(...allVals) * 1.05;

  const datasets = ranges.map((r, i) => {
    const colors = ['rgba(59,130,246,.7)', 'rgba(16,185,129,.7)', 'rgba(139,92,246,.7)', 'rgba(245,158,11,.7)', 'rgba(239,68,68,.7)'];
    return {
      label: r.label,
      data: [{ x: [r.min, r.max], y: r.label }],
      backgroundColor: colors[i % colors.length],
      borderColor:     colors[i % colors.length].replace('.7', '1'),
      borderWidth: 2,
      borderRadius: 4,
    };
  });

  // Current price reference line plugin
  const currentPriceLine = {
    id: 'cpLine',
    beforeDraw(chart) {
      if (!currentPrice) return;
      const { ctx: c, chartArea: a, scales: { x } } = chart;
      if (!a || !x) return;
      const xPos = x.getPixelForValue(currentPrice);
      if (xPos < a.left || xPos > a.right) return;
      c.save();
      c.strokeStyle = '#f59e0b';
      c.lineWidth = 2;
      c.setLineDash([5, 4]);
      c.beginPath(); c.moveTo(xPos, a.top); c.lineTo(xPos, a.bottom); c.stroke();
      c.fillStyle = '#f59e0b'; c.font = '10px Segoe UI';
      c.fillText('Current $' + currentPrice.toFixed(0), xPos + 4, a.top + 12);
      c.restore();
    },
  };

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { datasets },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const [lo, hi] = ctx.parsed._custom;
              return `$${fmtFin(lo)} – $${fmtFin(hi)}`;
            },
          },
        },
      },
      scales: {
        x: {
          min: globalMin, max: globalMax,
          ticks: { callback: v => '$' + fmtFin(v) },
          grid: { color: 'rgba(148,163,184,.08)' },
        },
        y: { grid: { display: false } },
      },
    },
    plugins: [currentPriceLine],
  });
}
