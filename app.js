const API_BASE = "https://api.exchangerate.host";
const API_BASE_CURRENCY = "ARS";
const LOCAL_DATA_URL = "../currencies.json";

let rates = {};
let history = JSON.parse(localStorage.getItem("history")) || [];
let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
let chart = null;
let currentRange = 30;
let lastResult = null;
let usedFallBack = false;
let isUpdatingChart = false;

const baseSelect = document.getElementById("base");
const targetSelect = document.getElementById("target");
const amountInput = document.getElementById("amount");
const resultValue = document.getElementById("result-value");
const resultCode = document.getElementById("result-code");
const rateOutput = document.getElementById("rate-output");
const inverseRate = document.getElementById("inverse-rate");
const updatedAt = document.getElementById("updated-at");
const includeFees = document.getElementById("include-fees");
const feeMargin = document.getElementById("fee-margin");
const feeOutput = document.getElementById("fee-output");
const roundingMode = document.getElementById("rounding-mode");
const converterForm = document.getElementById("converter-form");
const btnSwap = document.getElementById("btn-swap");
const quickPairs = document.getElementById("quick-pairs");
const historyBody = document.getElementById("history-body");
const btnClearHistory = document.getElementById("btn-clear-history");
const favoritesList = document.getElementById("favorites-list");
const btnAddFavorite = document.getElementById("btn-add-favorites");
const offlineBanner = document.getElementById("offline-banner");
const demoBanner = document.getElementById("demo-banner");
const chartCanvas = document.getElementById("rate-chart");
const chartRangeButtons = document.querySelectorAll(
  "#chart .chart-actions .btn"
);
const btnQuickMax = document.getElementById("btn-quick-max");
const multiBaseLabel = document.getElementById("multi-base-label");
const multiTableBody = document.getElementById("multi-table-body");

function createErrorElement() {
  const errorDiv = document.createElement("div");
  errorDiv.id = "error-message";
  errorDiv.className = "error-banner";
  errorDiv.style.display = "none";
  document.body.insertBefore(errorDiv, document.body.firstChild);
  return errorDiv;
}

function mostrarError(mensaje) {
  const errorDiv =
    document.getElementById("error-message") || createErrorElement();
  errorDiv.textContent = mensaje;
  errorDiv.style.display = "block";
}

function limpiarError() {
  const errorDiv = document.getElementById("error-message");
  if (errorDiv) {
    errorDiv.style.display = "none";
  }
}

function formatNumber(num) {
  const decimals =
    roundingMode.value === "none" ? undefined : parseInt(roundingMode.value);
  return num.toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function updateFeeOutput() {
  feeOutput.textContent = `${feeMargin.value}%`;
}

function setOfflineBanner() {
  offlineBanner.classList.toggle("hidden", navigator.onLine);
}

function setDemoBanner() {
  demoBanner.classList.toggle("hidden", !usedFallBack);
}

async function fetchLatestFromAPI(base = API_BASE_CURRENCY) {
  try {
    const url = `${API_BASE}/latest?base=${encodeURIComponent(base)}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Error HTTP: ${res.status}`);
    }

    const data = await res.json();

    if (data.success === false) {
      throw new Error(data.error?.message || "Error en la API");
    }

    if (!data.rates || typeof data.rates !== "object") {
      throw new Error("No se recibieron tasas de cambio válidas.");
    }

    const map = { ...data.rates };
    map[base] = 1;
    return {
      rates: map,
      updatedAt: data.date || new Date().toISOString().slice(0, 10),
      base: data.base || base,
    };
  } catch (error) {
    console.error("Error en fetchLatestFromAPI:", error);
    throw error;
  }
}

async function fetchTimeseriesFromAPI(base, target, days) {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));

    const url = `${API_BASE}/timeseries?start_date=${start
      .toISOString()
      .slice(0, 10)}&end_date=${end
      .toISOString()
      .slice(0, 10)}&base=${base}&symbols=${target}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error("Error API timeseries");

    const data = await res.json();
    if (!data.rates || typeof data.rates !== "object") {
      throw new Error("No se recibieron datos históricos válidos.");
    }

    const labels = [];
    const points = [];

    Object.keys(data.rates)
      .sort()
      .forEach((date) => {
        labels.push(date);
        points.push(data.rates[date][target]);
      });

    return { labels, points };
  } catch (error) {
    console.error("Error en fetchTimeseriesFromAPI:", error);
    throw error;
  }
}

async function fetchLatestFromLocal() {
  try {
    const res = await fetch(LOCAL_DATA_URL);
    if (!res.ok) throw new Error("No se pudo cargar JSON local");
    const data = await res.json();
    const map = { ...data.rates };
    const updatedAt = new Date().toISOString().slice(0, 10);
    return { rates: map, updatedAt, base: "LOCAL" };
  } catch (error) {
    console.error("Error cargando datos locales", error);
  }
}

function populateSelects() {
  if (!baseSelect || !targetSelect) return;

  const codes = Array.from(new Set(Object.keys(rates))).sort();
  baseSelect.innerHTML = "";
  targetSelect.innerHTML = "";

  for (const code of codes) {
    const o1 = document.createElement("option");
    o1.value = o1.textContent = code;
    baseSelect.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = o2.textContent = code;
    targetSelect.appendChild(o2);
  }

  baseSelect.value = codes.includes("ARS") ? "ARS" : codes[0];
  targetSelect.value = codes.includes("USD")
    ? "USD"
    : codes.find((c) => c !== baseSelect.value) || codes[0];
}

function renderQuickPairs() {
  if (!quickPairs) return;

  quickPairs.innerHTML = "";
  const pairs = [
    { base: "ARS", target: "USD" },
    { base: "ARS", target: "EUR" },
    { base: "USD", target: "ARS" },
    { base: "BRL", target: "ARS" },
  ].filter((p) => rates[p.base] && rates[p.target]);

  for (const p of pairs) {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = `${p.base} → ${p.target}`;
    btn.addEventListener("click", () => {
      baseSelect.value = p.base;
      targetSelect.value = p.target;
      convert();
    });
    quickPairs.appendChild(btn);
  }
}

function renderHistory() {
  if (!historyBody) return;

  historyBody.innerHTML = "";
  history.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.date}</td>
      <td>${item.base} → ${item.target}</td>
      <td>${formatNumber(item.amount)}</td>
      <td>${item.rate}</td>
      <td>${formatNumber(item.result)}</td>
      <td>
        <button class="btn btn-ghost" title="Reusar">↺</button>
        <button class="btn btn-ghost" title="Eliminar">🗑️</button>
      </td>
    `;
    const reuseBtn = tr.querySelector("button[title='Reusar']");
    const deleteBtn = tr.querySelector("button[title='Eliminar']");

    if (reuseBtn) {
      reuseBtn.addEventListener("click", () => {
        if (baseSelect && targetSelect && amountInput) {
          baseSelect.value = item.base;
          targetSelect.value = item.target;
          amountInput.value = item.amount;
          convert();
        }
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        history.splice(idx, 1);
        localStorage.setItem("history", JSON.stringify(history));
        renderHistory();
      });
    }

    historyBody.appendChild(tr);
  });
}

function renderFavorites() {
  if (!favoritesList) return;

  favoritesList.innerHTML = "";
  favorites.forEach((pair, idx) => {
    const div = document.createElement("div");
    div.className = "favorite";
    div.innerHTML = `
      <span class="pair">${pair.base} → ${pair.target}</span>
      <div class="fav-actions">
        <button class="btn btn-secondary btn-use">Usar</button>
        <button class="btn btn-ghost btn-remove" title="Quitar">✕</button>
      </div>
    `;
    const useBtn = div.querySelector(".btn-use");
    const removeBtn = div.querySelector(".btn-remove");

    if (useBtn) {
      useBtn.addEventListener("click", () => {
        if (baseSelect && targetSelect) {
          baseSelect.value = pair.base;
          targetSelect.value = pair.target;
          convert();
        }
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        favorites.splice(idx, 1);
        localStorage.setItem("favorites", JSON.stringify(favorites));
        renderFavorites();
      });
    }

    favoritesList.appendChild(div);
  });
}

function computeRate(base, target) {
  if (!rates[base] || !rates[target]) return null;
  let rate = rates[target] / rates[base];
  if (includeFees && includeFees.checked && feeMargin) {
    rate *= 1 + parseFloat(feeMargin.value || "0") / 100;
  }
  return rate;
}

function renderMultiTable() {
  if (!rates || !multiTableBody || !baseSelect || !amountInput) return;

  const amount = parseFloat(amountInput.value) || 0;
  const base = baseSelect.value;

  if (multiBaseLabel) {
    multiBaseLabel.textContent = base;
  }

  multiTableBody.innerHTML = "";

  Object.keys(rates).forEach((code) => {
    if (code === base) return;
    const rate = computeRate(base, code);
    if (!rate) return;

    const converted = amount * rate;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${code}</td>
      <td>${formatNumber(converted)}</td>
    `;
    multiTableBody.appendChild(row);
  });
}

function convert() {
  if (!baseSelect || !targetSelect || !amountInput) return;

  limpiarError();

  const base = baseSelect.value;
  const target = targetSelect.value;
  const amount = parseFloat(amountInput.value);

  if (!amount || amount <= 0) {
    mostrarError("⚠ Ingresa un monto válido mayor a 0.");
    return;
  }

  const rate = computeRate(base, target);
  if (!rate) {
    mostrarError("⚠ No se pudo obtener la tasa de cambio.");
    return;
  }

  const result = amount * rate;
  lastResult = { base, target, amount, result, rate };

  if (resultValue) resultValue.textContent = formatNumber(result);
  if (resultCode) resultCode.textContent = target;
  if (rateOutput) rateOutput.textContent = rate.toFixed(6);
  if (inverseRate) inverseRate.textContent = (1 / rate).toFixed(6);

  const appliedFeeEl = document.getElementById("applied-fee");
  if (appliedFeeEl) {
    appliedFeeEl.textContent =
      includeFees && includeFees.checked ? `${feeMargin?.value || 0}%` : "0%";
  }

  if (updatedAt) {
    updatedAt.textContent = new Date().toLocaleString();
  }

  history.unshift({
    date: new Date().toLocaleString(),
    base,
    target,
    amount,
    rate: rate.toFixed(6),
    result,
  });
  history = history.slice(0, 10);
  localStorage.setItem("history", JSON.stringify(history));
  renderHistory();
  renderMultiTable();
}

async function loadRates() {
  usedFallBack = false;
  limpiarError();

  try {
    const { rates: map, updatedAt: date } = await fetchLatestFromAPI(
      API_BASE_CURRENCY
    );
    rates = map;
    if (updatedAt) {
      updatedAt.textContent = new Date(date).toLocaleString();
    }
  } catch (err) {
    console.warn("Fallo API, usando JSON local:", err);
    try {
      const { rates: map, updatedAt: date } = await fetchLatestFromLocal();
      rates = map;
      if (updatedAt) {
        updatedAt.textContent = new Date(date).toLocaleString();
      }
      usedFallBack = true;
    } catch (localErr) {
      console.error("Error cargando datos locales:", localErr);
      mostrarError(
        "⚠ No se pudieron cargar las tasas de cambio. Verifica tu conexión."
      );
      return;
    }
  } finally {
    setOfflineBanner();
    setDemoBanner();
  }
}

async function updateChart(days = currentRange) {
  if (!chart || !baseSelect || !targetSelect || isUpdatingChart) return;

  isUpdatingChart = true;
  try {
    currentRange = days;
    const base = baseSelect.value;
    const target = targetSelect.value;

    if (usedFallBack) {
      const rate = computeRate(base, target);
      if (!rate) return;
      const labels = [];
      const points = [];
      const today = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        labels.push(d.toISOString().slice(0, 10));
        points.push(rate);
      }
      chart.data.labels = labels;
      chart.data.datasets[0].data = points;
      chart.update();
      return;
    }

    try {
      const { labels, points } = await fetchTimeseriesFromAPI(
        base,
        target,
        days
      );
      chart.data.labels = labels;
      chart.data.datasets[0].data = points;
      chart.update("none");
    } catch (err) {
      console.warn("Fallo timeseries:", err);
    }
  } finally {
    isUpdatingChart = false;
  }
}

if (converterForm) {
  converterForm.addEventListener("submit", (e) => {
    e.preventDefault();
    convert();
    if (!isUpdatingChart) {
      setTimeout(() => updateChart(currentRange), 100);
    }
  });
}

if (btnSwap) {
  btnSwap.addEventListener("click", () => {
    if (baseSelect && targetSelect) {
      const tmp = baseSelect.value;
      baseSelect.value = targetSelect.value;
      targetSelect.value = tmp;
      convert();
    }
  });
}

const btnReverse = document.getElementById("btn-reverse");
if (btnReverse) {
  btnReverse.addEventListener("click", () => {
    if (!lastResult || !amountInput || !baseSelect || !targetSelect) return;
    amountInput.value = lastResult.result.toFixed(2);
    const prevBase = baseSelect.value;
    baseSelect.value = targetSelect.value;
    targetSelect.value = prevBase;
    convert();
  });
}

if (btnQuickMax) {
  btnQuickMax.addEventListener("click", () => {
    if (amountInput) {
      amountInput.value = "100000";
      convert();
    }
  });
}

const btnClearAmount = document.getElementById("btn-clear-amount");
if (btnClearAmount) {
  btnClearAmount.addEventListener("click", () => {
    if (amountInput) amountInput.value = "";
    if (resultValue) resultValue.textContent = "—";
    if (resultCode) resultCode.textContent = "";
    if (rateOutput) rateOutput.textContent = "—";
    if (inverseRate) inverseRate.textContent = "—";
  });
}

if (feeMargin) {
  feeMargin.addEventListener("input", updateFeeOutput);
}

if (includeFees) {
  includeFees.addEventListener("change", () => {
    if (amountInput && amountInput.value) {
      convert();
    }
  });
}

if (roundingMode) {
  roundingMode.addEventListener("change", () => {
    if (lastResult && resultValue) {
      resultValue.textContent = formatNumber(lastResult.result);
    }
  });
}

if (btnClearHistory) {
  btnClearHistory.addEventListener("click", () => {
    history = [];
    localStorage.removeItem("history");
    renderHistory();
  });
}

if (btnAddFavorite) {
  btnAddFavorite.addEventListener("click", () => {
    if (!baseSelect || !targetSelect) return;

    const base = baseSelect.value;
    const target = targetSelect.value;
    if (!favorites.some((f) => f.base === base && f.target === target)) {
      favorites.push({ base, target });
      localStorage.setItem("favorites", JSON.stringify(favorites));
      renderFavorites();
    }
  });
}

chartRangeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const days = parseInt(btn.dataset.range);
    updateChart(days);
  });
});

window.addEventListener("online", setOfflineBanner);
window.addEventListener("offline", setOfflineBanner);

if (amountInput) {
  amountInput.addEventListener("input", renderMultiTable);
}

(async function init() {
  setOfflineBanner();
  updateFeeOutput();
  await loadRates();
  populateSelects();
  renderQuickPairs();
  renderHistory();
  renderFavorites();
  renderMultiTable();
})();
