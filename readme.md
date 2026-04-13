# InvestIQ

A browser-based stock and investment analysis app that works entirely on the client side.

## Live App

[Open the app](https://simjoe1805.github.io/miniproject2/)

If GitHub Pages shows an older version in your browser, do a hard refresh with `Ctrl+Shift+R` or open the link in a private/incognito window.

## What It Does

- Lets you enter company, price, and fundamentals data manually
- Parses pasted CSV price history
- Uploads annual-report PDFs and extracts financial statement data
- Builds a dashboard with scores, charts, and summary metrics
- Includes DCF, trading comps, and precedent transaction views
- Includes a report-chat view based on extracted PDF text

## Main Files

- `index.html` contains the app structure
- `styles.css` contains the styling and responsive layout
- `script.js` contains parsing, analysis, charting, and PDF logic

## GitHub Pages

- This repo deploys with `.github/workflows/deploy-pages.yml`
- The site is published from the `main` branch through GitHub Actions
- The expected site URL is `https://simjoe1805.github.io/miniproject2/`
