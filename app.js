const GOOGLE_SHEETS_BASE = "https://docs.google.com/spreadsheets/d";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

function displayValue(v) {
  if (v === true) return "✓";
  if (v === false) return "";
  return v ?? "";
}

function rgbToHex(r, g, b) {
  const toHex = (c) => {
    const n = Math.round(c * 255);
    return n.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

async function fetchHeaderColors(sheetConfig) {
  const apiKey = CONFIG.apiKey;
  if (!apiKey || apiKey === "YOUR_GOOGLE_SHEETS_API_KEY") return null;
  const range = encodeURIComponent(`${sheetConfig.sheet}!F1:H1`);
  const url = `${SHEETS_API_BASE}/${sheetConfig.id}?ranges=${range}&fields=sheets.data.rowData.values.effectiveFormat.backgroundColor&key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const values = data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values;
    if (!values || values.length < 3) return null;
    return values.map((v) => {
      const bg = v.effectiveFormat?.backgroundColor;
      if (!bg) return null;
      return rgbToHex(bg.red ?? 1, bg.green ?? 1, bg.blue ?? 1);
    });
  } catch {
    return null;
  }
}

async function fetchSheetData(sheetConfig) {
  const params = `tqx=out:json&sheet=${encodeURIComponent(sheetConfig.sheet)}`;
  const url = `${GOOGLE_SHEETS_BASE}/${sheetConfig.id}/gviz/tq?${params}`;
  const response = await fetch(url);
  const text = await response.text();
  const json = JSON.parse(text.substring(47, text.length - 2));
  const rows = json.table.rows;
  const c = sheetConfig.columns;
  const colLabels = json.table.cols;

  const fLabel = colLabels[c.inStock]?.label ?? "In Stock";
  const gLabel = colLabels[c.lowStock]?.label ?? "Low Stock";
  const hLabel = colLabels[c.outOfStock]?.label ?? "Out of Stock";

  const items = rows
    .filter((row) => row.c[c.inStock] || row.c[c.lowStock] || row.c[c.outOfStock])
    .map((row) => ({
      inStock: displayValue(row.c[c.inStock]?.v),
      lowStock: displayValue(row.c[c.lowStock]?.v),
      outOfStock: displayValue(row.c[c.outOfStock]?.v),
    }));

  return { items, labels: [fLabel, gLabel, hLabel] };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showError(sheetName, error) {
  const container = document.getElementById("sheets-container");
  const card = document.createElement("div");
  card.className = "sheet-card error";
  card.innerHTML = `
    <div class="sheet-header" style="border-left: 4px solid #ef4444">
      <h2>${sheetName}</h2>
      <p class="error-msg">Failed to load: ${escapeHtml(error.message)}</p>
    </div>
  `;
  container.appendChild(card);
}

function updateLastUpdated() {
  document.getElementById("last-updated").textContent =
    new Date().toLocaleString();
}

function renderTabs(sheetsData) {
  const tabsContainer = document.getElementById("tabs-container");
  tabsContainer.innerHTML = "";

  const tabBar = document.createElement("div");
  tabBar.className = "tab-bar";

  sheetsData.forEach((data, index) => {
    const tab = document.createElement("button");
    tab.className = `tab-btn${index === 0 ? " active" : ""}`;
    tab.style.setProperty("--tab-color", CONFIG.sheets[index].color);
    tab.textContent = CONFIG.sheets[index].name;
    tab.dataset.index = index;
    tab.addEventListener("click", () => switchTab(index, sheetsData));
    tabBar.appendChild(tab);
  });

  tabsContainer.appendChild(tabBar);
}

function switchTab(index, sheetsData) {
  document.querySelectorAll(".tab-btn").forEach((btn, i) => {
    btn.classList.toggle("active", i === index);
  });

  const container = document.getElementById("sheets-container");
  container.innerHTML = "";
  renderSheetContent(index, sheetsData[index]);
}

function renderSheetContent(index, data) {
  if (!data) {
    showError(CONFIG.sheets[index]?.name ?? "Unknown", new Error("No data"));
    return;
  }

  const { items, labels } = data;
  const sheet = CONFIG.sheets[index];
  const container = document.getElementById("sheets-container");
  const defaultColors = ["#22c55e", "#eab308", "#ef4444"];

  const card = document.createElement("div");
  card.className = "sheet-card";
  card.innerHTML = `
    <div class="sheet-header" style="border-left: 4px solid ${sheet.color}">
      <h2>${sheet.name}</h2>
      <span class="row-count">${items.length} items</span>
    </div>
    <div class="sheet-table-wrapper">
      <table class="sheet-table">
        <thead>
          <tr>
            ${labels
              .map(
                (label, i) =>
                  `<th style="background:${defaultColors[i]};color:#fff">${escapeHtml(label)}</th>`
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `<tr>
              <td>${escapeHtml(item.inStock)}</td>
              <td>${escapeHtml(item.lowStock)}</td>
              <td>${escapeHtml(item.outOfStock)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  container.appendChild(card);
}

async function loadAllSheets() {
  const container = document.getElementById("sheets-container");
  container.innerHTML = "";
  document.getElementById("loading").style.display = "flex";

  const results = await Promise.allSettled(
    CONFIG.sheets.map(async (s, i) => {
      const data = await fetchSheetData(s);
      return { i, data };
    })
  );

  document.getElementById("loading").style.display = "none";

  const sheetsData = [];
  let hasError = false;

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      sheetsData[result.value.i] = result.value.data;
    } else {
      sheetsData[result.value?.i] = null;
      hasError = true;
    }
  });

  renderTabs(sheetsData);
  switchTab(0, sheetsData);
  updateLastUpdated();
}

document.addEventListener("DOMContentLoaded", () => {
  loadAllSheets();
  setInterval(loadAllSheets, CONFIG.refreshIntervalMs);
  document.getElementById("refresh-btn").addEventListener("click", loadAllSheets);
});
