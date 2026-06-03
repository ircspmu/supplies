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

  return rows
    .filter((row) => row.c[c.inStock] || row.c[c.lowStock] || row.c[c.outOfStock])
    .map((row) => ({
      inStock: displayValue(row.c[c.inStock]?.v),
      lowStock: displayValue(row.c[c.lowStock]?.v),
      outOfStock: displayValue(row.c[c.outOfStock]?.v),
    }));
}

function renderSheet(sheetIndex, items, colors) {
  const sheet = CONFIG.sheets[sheetIndex];
  const container = document.getElementById("sheets-container");
  const labels = ["In Stock", "Low Stock", "Out of Stock"];

  const defaultColors = ["#22c55e", "#eab308", "#ef4444"];
  const headerStyle = (i) => {
    if (colors && colors[i]) return `background:${colors[i]};color:#fff;`;
    return `background:${defaultColors[i]};color:#fff;`;
  };

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
              .map((label, i) => `<th style="${headerStyle(i)}">${label}</th>`)
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${items
            .map((item) => `<tr>
              <td>${escapeHtml(item.inStock)}</td>
              <td>${escapeHtml(item.lowStock)}</td>
              <td>${escapeHtml(item.outOfStock)}</td>
            </tr>`)
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  container.appendChild(card);
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

async function loadAllSheets() {
  const container = document.getElementById("sheets-container");
  container.innerHTML = "";
  document.getElementById("loading").style.display = "flex";

  const results = await Promise.allSettled(
    CONFIG.sheets.map(async (s, i) => {
      const [headerColors, data] = await Promise.all([
        fetchHeaderColors(s),
        fetchSheetData(s),
      ]);
      return { i, data, headerColors };
    })
  );

  document.getElementById("loading").style.display = "none";

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      renderSheet(result.value.i, result.value.data, result.value.headerColors);
    } else {
      showError(CONFIG.sheets[result.value?.i]?.name ?? "Unknown", result.reason);
    }
  });

  updateLastUpdated();
}

document.addEventListener("DOMContentLoaded", () => {
  loadAllSheets();
  setInterval(loadAllSheets, CONFIG.refreshIntervalMs);
  document.getElementById("refresh-btn").addEventListener("click", loadAllSheets);
});
