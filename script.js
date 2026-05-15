// ============================================================
// LOAN CALCULATOR – script.js
// ============================================================

'use strict';

// ---- State ------------------------------------------------
const state = {
  amount: 250000,
  rate: 6.5,
  term: 30,
  type: 'mortgage',
  schedule: [],
  currentPage: 1,
  rowsPerPage: 12,
};

// ---- DOM Refs --------------------------------------------
const $ = id => document.getElementById(id);

const loanAmountInput   = $('loanAmount');
const loanAmountSlider  = $('loanAmountSlider');
const interestRateInput = $('interestRate');
const interestRateSlider= $('interestRateSlider');
const loanTermInput     = $('loanTerm');
const loanTermSlider    = $('loanTermSlider');
const calculateBtn      = $('calculateBtn');
const exportCsvBtn      = $('exportCsvBtn');

const monthlyPaymentEl  = $('monthlyPayment');
const totalPrincipalEl  = $('totalPrincipal');
const totalInterestEl   = $('totalInterest');
const totalCostEl       = $('totalCost');
const barPrincipal      = $('barPrincipal');
const barInterest       = $('barInterest');

const amortBody         = $('amortBody');
const pageInfo          = $('pageInfo');
const prevPageBtn       = $('prevPage');
const nextPageBtn       = $('nextPage');

// ---- Chart instances ------------------------------------
let balanceChart = null;
let pieChart     = null;
let paymentChart = null;

// ---- Utilities ------------------------------------------
const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
const fmtExact = n => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function monthName(monthIndex) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthIndex);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ---- Core Calculation ------------------------------------
function calcMonthlyPayment(P, annualRate, years) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return P / n;
  return P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function buildSchedule(P, annualRate, years) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  const M = calcMonthlyPayment(P, annualRate, years);
  let balance = P;
  const schedule = [];
  for (let i = 1; i <= n; i++) {
    const interest  = balance * r;
    const principal = M - interest;
    balance -= principal;
    schedule.push({
      month: i,
      payment: M,
      principal: principal,
      interest: interest,
      balance: Math.max(0, balance),
    });
  }
  return schedule;
}

// ---- Render Results --------------------------------------
function renderResults() {
  const { amount, rate, term, schedule } = state;
  const M = calcMonthlyPayment(amount, rate, term);
  const totalPaid = M * term * 12;
  const totalInt  = totalPaid - amount;

  // Animate number counting
  animateValue(monthlyPaymentEl, M, v => fmtExact(v));
  totalPrincipalEl.textContent = fmt(amount);
  totalInterestEl.textContent  = fmt(totalInt);
  totalCostEl.textContent      = fmt(totalPaid);

  // Breakdown bar
  const pPct = (amount / totalPaid * 100).toFixed(1);
  const iPct = (totalInt / totalPaid * 100).toFixed(1);
  barPrincipal.style.width = pPct + '%';
  barInterest.style.width  = iPct + '%';
}

function animateValue(el, target, formatter) {
  const duration = 600;
  const start = Date.now();
  const startVal = parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || 0;

  function tick() {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
    const current = startVal + (target - startVal) * eased;
    el.textContent = formatter(current);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ---- Render Table ----------------------------------------
function renderTable() {
  const { schedule, currentPage, rowsPerPage } = state;
  const total = Math.ceil(schedule.length / rowsPerPage);
  const start = (currentPage - 1) * rowsPerPage;
  const rows  = schedule.slice(start, start + rowsPerPage);

  amortBody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.month}</td>
      <td>${monthName(r.month - 1)}</td>
      <td>${fmtExact(r.payment)}</td>
      <td class="td-principal">${fmtExact(r.principal)}</td>
      <td class="td-interest">${fmtExact(r.interest)}</td>
      <td class="td-balance">${fmt(r.balance)}</td>
    </tr>
  `).join('');

  pageInfo.textContent    = `Page ${currentPage} of ${total}`;
  prevPageBtn.disabled    = currentPage === 1;
  nextPageBtn.disabled    = currentPage === total;
}

// ---- Charts ----------------------------------------------
const CHART_DEFAULTS = {
  color: '#94a3b8',
  font: { family: 'Inter, system-ui, sans-serif', size: 11 },
};

function getBalanceData() {
  const { schedule } = state;
  // Sample every N months for performance (max 60 points)
  const step = Math.max(1, Math.floor(schedule.length / 60));
  const labels = [];
  const balances = [];
  const principals = [];
  const interests = [];

  schedule.forEach((r, i) => {
    if (i % step === 0 || i === schedule.length - 1) {
      labels.push(`Month ${r.month}`);
      balances.push(r.balance.toFixed(2));
      principals.push((state.amount - r.balance).toFixed(2));
      interests.push(schedule.slice(0, i+1).reduce((s, x) => s + x.interest, 0).toFixed(2));
    }
  });
  return { labels, balances, principals, interests };
}

function renderBalanceChart() {
  const ctx = $('balanceChart').getContext('2d');
  if (balanceChart) balanceChart.destroy();

  const { labels, balances } = getBalanceData();

  balanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Remaining Balance',
        data: balances,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2.5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' Balance: ' + fmt(ctx.raw),
          },
          backgroundColor: 'rgba(15,16,32,0.95)',
          borderColor: 'rgba(99,102,241,0.4)',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', maxTicksLimit: 8, font: CHART_DEFAULTS.font },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#64748b',
            font: CHART_DEFAULTS.font,
            callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(0)+'K' : v),
          }
        }
      }
    }
  });
}

function renderPieChart() {
  const ctx = $('pieChart').getContext('2d');
  if (pieChart) pieChart.destroy();

  const { amount, rate, term } = state;
  const M     = calcMonthlyPayment(amount, rate, term);
  const total = M * term * 12;
  const int   = total - amount;

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Principal', 'Interest'],
      datasets: [{
        data: [amount, int],
        backgroundColor: ['rgba(99,102,241,0.8)', 'rgba(139,92,246,0.8)'],
        borderColor: ['#6366f1', '#8b5cf6'],
        borderWidth: 2,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: CHART_DEFAULTS.font, padding: 20 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + ctx.label + ': ' + fmt(ctx.raw),
          },
          backgroundColor: 'rgba(15,16,32,0.95)',
          borderColor: 'rgba(99,102,241,0.4)',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
        }
      }
    }
  });
}

function renderPaymentChart() {
  const ctx = $('paymentChart').getContext('2d');
  if (paymentChart) paymentChart.destroy();

  const { schedule } = state;
  const step = Math.max(1, Math.floor(schedule.length / 36));
  const labels = [];
  const principalData = [];
  const interestData  = [];

  schedule.forEach((r, i) => {
    if (i % step === 0 || i === schedule.length - 1) {
      labels.push(`M${r.month}`);
      principalData.push(r.principal.toFixed(2));
      interestData.push(r.interest.toFixed(2));
    }
  });

  paymentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Principal',
          data: principalData,
          backgroundColor: 'rgba(99,102,241,0.7)',
          borderRadius: 3,
          borderSkipped: false,
        },
        {
          label: 'Interest',
          data: interestData,
          backgroundColor: 'rgba(139,92,246,0.7)',
          borderRadius: 3,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: CHART_DEFAULTS.font, padding: 20 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + ctx.dataset.label + ': ' + fmtExact(+ctx.raw),
          },
          backgroundColor: 'rgba(15,16,32,0.95)',
          borderColor: 'rgba(99,102,241,0.4)',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: CHART_DEFAULTS.font, maxTicksLimit: 12 },
        },
        y: {
          stacked: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#64748b',
            font: CHART_DEFAULTS.font,
            callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(1)+'K' : v),
          }
        }
      }
    }
  });
}

// ---- Chart Tab Switching ---------------------------------
function switchChart(type) {
  const canvasMap = { balance: 'balanceChart', pie: 'pieChart', payment: 'paymentChart' };
  Object.keys(canvasMap).forEach(k => {
    $(canvasMap[k]).style.display = k === type ? 'block' : 'none';
  });
  document.querySelectorAll('.chart-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.chart === type);
  });
  if (type === 'balance') renderBalanceChart();
  if (type === 'pie')     renderPieChart();
  if (type === 'payment') renderPaymentChart();
}

// ---- Main Calculate --------------------------------------
function calculate() {
  state.amount = parseFloat(loanAmountInput.value)   || 0;
  state.rate   = parseFloat(interestRateInput.value) || 0;
  state.term   = parseInt(loanTermInput.value)       || 1;

  if (state.amount <= 0 || state.rate <= 0 || state.term <= 0) return;

  state.schedule    = buildSchedule(state.amount, state.rate, state.term);
  state.currentPage = 1;

  renderResults();
  renderTable();

  // Re-render whichever chart is active
  const activeChartTab = document.querySelector('.chart-tab.active');
  if (activeChartTab) switchChart(activeChartTab.dataset.chart);
}

// ---- Slider ↔ Input Sync ---------------------------------
function syncSliderInput(slider, input, min, max) {
  slider.addEventListener('input', () => {
    input.value = slider.value;
    updateSliderTrack(slider);
    calculate();
  });
  input.addEventListener('input', () => {
    const v = Math.max(min, Math.min(max, parseFloat(input.value) || 0));
    slider.value = v;
    updateSliderTrack(slider);
    calculate();
  });
}

function updateSliderTrack(slider) {
  const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.background = `linear-gradient(to right, #6366f1 ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
}

function initSliderTracks() {
  [loanAmountSlider, interestRateSlider, loanTermSlider].forEach(updateSliderTrack);
}

// ---- Loan Type Tabs --------------------------------------
document.querySelectorAll('.loan-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.loan-tab').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    state.type = btn.dataset.type;

    // Set sensible defaults per loan type
    const defaults = {
      mortgage: { amount: 350000, rate: 6.75, term: 30 },
      auto:     { amount: 35000,  rate: 7.5,  term: 5  },
      personal: { amount: 15000,  rate: 11.5, term: 3  },
      student:  { amount: 40000,  rate: 5.5,  term: 10 },
    };
    const d = defaults[state.type];
    loanAmountInput.value   = d.amount;
    loanAmountSlider.value  = d.amount;
    interestRateInput.value = d.rate;
    interestRateSlider.value= d.rate;
    loanTermInput.value     = d.term;
    loanTermSlider.value    = d.term;

    // Update slider max for term
    const termMax = { mortgage: 30, auto: 10, personal: 7, student: 20 };
    loanTermSlider.max = termMax[state.type];
    loanTermInput.max  = termMax[state.type];

    initSliderTracks();
    calculate();
  });
});

// ---- Chart Tabs ------------------------------------------
document.querySelectorAll('.chart-tab').forEach(btn => {
  btn.addEventListener('click', () => switchChart(btn.dataset.chart));
});

// ---- Pagination ------------------------------------------
prevPageBtn.addEventListener('click', () => {
  if (state.currentPage > 1) {
    state.currentPage--;
    renderTable();
  }
});

nextPageBtn.addEventListener('click', () => {
  const total = Math.ceil(state.schedule.length / state.rowsPerPage);
  if (state.currentPage < total) {
    state.currentPage++;
    renderTable();
  }
});

// ---- Calculate Button ------------------------------------
calculateBtn.addEventListener('click', calculate);

// ---- CSV Export ------------------------------------------
exportCsvBtn.addEventListener('click', () => {
  const { schedule } = state;
  const header = 'Month,Date,Payment,Principal,Interest,Balance\n';
  const rows = schedule.map(r =>
    `${r.month},${monthName(r.month-1)},${r.payment.toFixed(2)},${r.principal.toFixed(2)},${r.interest.toFixed(2)},${r.balance.toFixed(2)}`
  ).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'amortization-schedule.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// ---- FAQ Accordion ---------------------------------------
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    // Collapse all
    document.querySelectorAll('.faq-question').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.faq-answer').forEach(a => {
      a.classList.remove('open');
    });
    // Toggle clicked
    if (!expanded) {
      btn.setAttribute('aria-expanded', 'true');
      document.getElementById(btn.getAttribute('aria-controls')).classList.add('open');
    }
  });
});

// ---- Init -----------------------------------------------
(function init() {
  syncSliderInput(loanAmountSlider,   loanAmountInput,   1000, 2000000);
  syncSliderInput(interestRateSlider, interestRateInput, 0.1,  30);
  syncSliderInput(loanTermSlider,     loanTermInput,     1,    30);
  initSliderTracks();
  calculate();
})();
