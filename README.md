# Supply Stock Dashboard

Real-time dashboard that displays stock status of supplies from multiple Google Sheets. Hosted on GitHub Pages.

## How it works

- **Frontend**: Static site (HTML/CSS/JS) hosted on GitHub Pages
- **Backend**: Google Sheets used as a live data source
- **Data flow**: The app fetches data directly from your Google Sheets using the Google Visualization API (no API key required)

## Setup

### 1. Share your Google Sheets

Each sheet must be shared with **"Anyone with the link can view"** permission.

Your sheets should have this column structure (tab name: **Inventory Monitoring**):

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Code | Item | Stock | Re-order Point | | In Stock | Low Stock | Out of Stock |

Columns F-H are the status indicators (can be checkboxes or text values).

### 2. Configure

The spreadsheet IDs and sheet name are already set in `config.js`. Update the `name` and `color` properties if you want different display names for each warehouse.

### 3. Deploy to GitHub Pages

1. Push this repository to GitHub
2. Go to **Settings > Pages**
3. Under "Source", select **GitHub Actions**
4. The included workflow will deploy automatically on every push to `main`

Or use the manual workflow in **Actions > Deploy to GitHub Pages > Run workflow**.

## Stock Status Logic

Status is read directly from columns F-H in the sheet:

- **In Stock** (green): checked/marked in column F
- **Low Stock** (yellow): checked/marked in column G
- **Out of Stock** (red): checked/marked in column H

## Auto-refresh

The dashboard auto-refreshes every 5 minutes. Click the **Refresh** button to force an update.
