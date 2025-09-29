class CurrencyConverter {
  constructor() {
    this.currencyData = null;
    this.conversionHistory = [];
    this.apiURL = "https://api.exchangerate-api.com/v4/latest/USD";
    this.init();
  }

  async init() {
    await this.loadCurrencyData();
    this.setupUI();
    this.attachEventListeners();
    this.loadHistoryFromStorage();
  }

  async loadCurrencyData() {
    try {
      showLoading(true);

      const response = await fetch(this.apiURL);

      if (!response.ok) {
        throw new Error("Error al cargar los datos de las monedas");
      }

      const data = await response.json();

      this.currencyData = this.transformAPIData(data);
      showLoading(false);
    } catch (error) {
      showLoading(false);
      showError("Error al cargar las tasas de cambio. Usando las de respaldo.");
      console.error("Error:", error);
      try {
        const localResponse = await fetch("currencies.json");
        if (localResponse.ok) {
          this.currencyData = await localResponse.json();
        } else {
          this.currencyData = this.getFallbackData();
        }
      } catch {
        this.currencyData = this.getFallbackData();
      }
    }
  }

  transformAPIData(apiData) {
    const currencyNames = {
      USD: { name: "Dólar Estadounidense", symbol: "$" },
      EUR: { name: "Euro", symbol: "€" },
      GBP: { name: "Libra Esterlina", symbol: "£" },
      JPY: { name: "Yen Japonés", symbol: "¥" },
      ARS: { name: "Peso Argentino", symbol: "$" },
      BRL: { name: "Real Brasileño", symbol: "R$" },
      CAD: { name: "Dólar Canadiense", symbol: "C$" },
      CHF: { name: "Franco Suizo", symbol: "Fr" },
      CNY: { name: "Yuan Chino", symbol: "¥" },
      MXN: { name: "Peso Mexicano", symbol: "$" },
      AUD: { name: "Dólar Australiano", symbol: "A$" },
      INR: { name: "Rupia India", symbol: "₹" },
      RUB: { name: "Rublo Ruso", symbol: "₽" },
      KRW: { name: "Won Surcoreano", symbol: "₩" },
      CLP: { name: "Peso Chileno", symbol: "$" },
      COP: { name: "Peso Colombiano", symbol: "$" },
      PEN: { name: "Sol Peruano", symbol: "S/" },
      UYU: { name: "Peso Uruguayo", symbol: "$U" },
      NZD: { name: "Dólar Neozelandés", symbol: "NZ$" },
      SGD: { name: "Dólar de Singapur", symbol: "S$" },
      HKD: { name: "Dólar de Hong Kong", symbol: "HK$" },
      SEK: { name: "Corona Sueca", symbol: "kr" },
      NOK: { name: "Corona Noruega", symbol: "kr" },
      DKK: { name: "Corona Danesa", symbol: "kr" },
      ZAR: { name: "Rand Sudafricano", symbol: "R" },
      PLN: { name: "Zloty Polaco", symbol: "zł" },
      THB: { name: "Baht Tailandés", symbol: "฿" },
      MYR: { name: "Ringgit Malayo", symbol: "RM" },
    };

    const transformed = {
      base: apiData.base,
      lastUpdate: apiData.date || new Date().toISOString().split("T")[0],
      currencies: {},
    };

    Object.keys(currencyNames).forEach((code) => {
      if (apiData.rates[code]) {
        transformed.currencies[code] = {
          name: currencyNames[code].name,
          symbol: currencyNames[code].symbol,
          rate: apiData.rates[code],
        };
      }
    });

    return transformed;
  }

  simulateNetworkDelay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getFallbackData() {
    return {
      base: "USD",
      lastUpdate: new Date().toISOString().split("T")[0],
      currencies: {
        USD: { name: "Dólar Estadounidense", symbol: "$", rate: 1 },
        EUR: { name: "Euro", symbol: "€", rate: 0.92 },
        ARS: { name: "Peso Argentino", symbol: "$", rate: 850.0 },
      },
    };
  }

  setupUI() {
    if (this.populateCurrencySelects());
    this.updateSymbols();
  }

  populateCurrencySelects() {
    const fromSelect = document.getElementById("fromCurrency");
    const toSelect = document.getElementById("toCurrency");

    if (!fromSelect || !toSelect) {
      console.error("Selectores no encontrados en el DOM");
      return false;
    }

    fromSelect.innerHTML = "";
    toSelect.innerHTML = "";

    const sortedCodes = Object.keys(this.currencyData.currencies).sort();

    sortedCodes.forEach((code) => {
      const currency = this.currencyData.currencies[code];

      const optionFrom = document.createElement("option");
      optionFrom.value = code;
      optionFrom.textContent = `${code} - ${currency.name}`;
      fromSelect.appendChild(optionFrom);

      const optionTo = document.createElement("option");
      optionTo.value = code;
      optionTo.textContent = `${code} - ${currency.name}`;
      toSelect.appendChild(optionTo);
    });

    fromSelect.value = "USD";
    toSelect.value = "ARS";

    return true;
  }

  updateRateInfo() {
    const rateInfo = document.getElementById("rateInfo");
    const fromSelect = document.getElementById("fromCurrency");
    const toSelect = document.getElementById("toCurrency");

    if (!fromSelect || !toSelect || !rateInfo) return;

    const fromCode = fromSelect.value;
    const toCode = toSelect.value;

    if (fromCode && toCode) {
      const rate = this.calculateRate(fromCode, toCode);
      rateInfo.innerHTML = `
                <div class="date">Última actualización: ${this.formatDate(
                  this.currencyData.lastUpdate
                )}</div>
                <div class="rate">1 ${fromCode} = ${rate.toFixed(
        4
      )} ${toCode}</div>
            `;
    }
  }

  calculateRate(from, to) {
    const fromRate = this.currencyData.currencies[from].rate;
    const toRate = this.currencyData.currencies[to].rate;
    return toRate / fromRate;
  }

  performCoversion() {
    const amount = parseFloat(document.getElementById("amount").value);
    const fromCode = document.getElementById("fromCurrency").value;
    const toCode = document.getElementById("toCurrency").value;

    if (!amount || amount <= 0) {
      showError("Por favor ingresa una cantidad válida mayor a 0.");
      return;
    }

    if (fromCode === toCode) {
      showError("Por favor seleccione monedas diferentes.");
      return;
    }

    hideError();
    document.getElementById("convertBtn").classList.add("clicked");
    setTimeout(() => {
      document.getElementById("convertBtn").classList.remove("clicked");
    }, 300);
    showLoading(true);

    const rate = this.calculateRate(fromCode, toCode);
    const result = amount * rate;

    this.displayResult(amount, fromCode, result, toCode, rate);
    this.addToHistory(amount, fromCode, result, toCode, rate);
    showLoading(false);
  }

  displayResult(amount, from, result, to, rate) {
    const resultDiv = document.getElementById("result");
    const resultAmount = document.getElementById("resultAmount");
    const resultDetail = document.getElementById("resultDetail");

    const fromSymbol = this.currencyData.currencies[from].symbol;
    const toSymbol = this.currencyData.currencies[to].symbol;

    resultAmount.textContent = `${toSymbol} ${result.toFixed(2)}`;
    resultDetail.textContent = `${fromSymbol} ${amount.toFixed(
      2
    )} ${from} = ${toSymbol} ${result.toFixed(2)} ${to}`;

    resultDiv.classList.add("show");
  }

  addToHistory(amount, from, result, to, rate) {
    const historyItem = {
      id: Date.now(),
      timestamp: new Date().toLocaleString("es-AR"),
      amount: amount,
      from: from,
      to: to,
      result: result,
      rate: rate,
    };

    this.conversionHistory.unshift(historyItem);

    if (this.conversionHistory.length > 10) {
      this.conversionHistory.pop();
    }

    this.saveHistoryToStorage();
    this.renderHistory();
  }

  renderHistory() {
    const historyList = document.getElementById("historyList");
    const clearBtn = document.getElementById("clearHistory");

    if (this.conversionHistory.length === 0) {
      historyList.innerHTML =
        '<div class="history-empty">No hay conversiones aún</div>';
      clearBtn.style.display = "none";
      return;
    }

    historyList.innerHTML = "";
    clearBtn.style.display = "block";

    this.conversionHistory.forEach((item) => {
      const historyItem = document.createElement("div");
      historyItem.className = "history-item";

      const fromSymbol = this.currencyData.currencies[item.from].symbol;
      const toSymbol = this.currencyData.currencies[item.to].symbol;

      historyItem.innerHTML = `
                <strong>${fromSymbol} ${item.amount.toFixed(2)} ${
        item.from
      }</strong> 
                → <strong>${toSymbol} ${item.result.toFixed(2)} ${
        item.to
      }</strong>
                <br>
                <small>Tasa: ${item.rate.toFixed(4)} | ${item.timestamp}</small>
            `;

      historyList.appendChild(historyItem);
    });
  }

  saveHistoryToStorage() {
    try {
      localStorage.setItem(
        "currencyHistory",
        JSON.stringify(this.conversionHistory)
      );
    } catch (e) {
      console.warn("No se pudo guardar en localStorage:", e);
    }
  }

  loadHistoryFromStorage() {
    try {
      const saved = localStorage.getItem("currencyHistory");
      if (saved) {
        this.conversionHistory = JSON.parse(saved);
        this.renderHistory();
      }
    } catch (e) {
      console.error("Error al cargar historial:", e);
    }
  }

  clearHistory() {
    this.conversionHistory = [];
    this.saveHistoryToStorage();
    this.renderHistory();
  }

  formatNumber(num) {
    return num.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  updateSymbols() {
    const fromCode = document.getElementById("fromCurrency").value;
    const toCode = document.getElementById("toCurrency").value;

    document.getElementById("fromSymbol").value =
      this.currencyData.currencies[fromCode].symbol;
    document.getElementById("toSymbol").value =
      this.currencyData.currencies[toCode].symbol;

    this.updateRateInfo();
  }

  swapCurrencies() {
    const fromSelect = document.getElementById("fromCurrency");
    const toSelect = document.getElementById("toCurrency");

    const temp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = temp;

    this.updateSymbols();
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  attachEventListeners() {
    document.getElementById("convertBtn").addEventListener("click", () => {
      this.performCoversion();
    });

    document.getElementById("amount").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.performCoversion();
      }
    });

    document.getElementById("swapBtn").addEventListener("click", () => {
      this.swapCurrencies();
    });

    document.getElementById("fromCurrency").addEventListener("change", () => {
      this.updateSymbols();
    });

    document.getElementById("toCurrency").addEventListener("change", () => {
      this.updateSymbols();
    });

    document.getElementById("clearHistory").addEventListener("click", () => {
      if (confirm("¿Estás seguro de que quieres limpiar todo el historial?")) {
        this.clearHistory();
      }
    });
  }
}

function showLoading(show) {
  const loading = document.getElementById("loading");
  const btn = document.getElementById("convertBtn");

  if (show) {
    loading.classList.add("show");
    btn.disabled = true;
  } else {
    loading.classList.remove("show");
    btn.disabled = false;
  }
}

function showError(message) {
  const error = document.getElementById("error");
  error.textContent = message;
  error.classList.add("show");

  setTimeout(() => {
    hideError();
  }, 5000);
}

function hideError() {
  const error = document.getElementById("error");
  error.classList.remove("show");
}

let converterApp;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    converterApp = new CurrencyConverter();
  });
} else {
  converterApp = new CurrencyConverter();
}

window.CurrencyConverter = CurrencyConverter;
