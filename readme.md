# Historical Stock Strategy Backtester

A browser-based educational backtester for running simple trading strategies against real historical stock data.

## What It Does

- Fetches historical stock prices from Alpha Vantage
- Lets you enter a real ticker symbol and choose daily, weekly, or monthly data
- Supports date ranges from short windows to multi-year tests
- Compares several beginner-friendly trading strategies against buy and hold
- Shows price action, strategy signals, equity curves, and a trade log

## Included Strategies

- Buy and hold
- Moving average crossover
- RSI reversal
- Breakout

## How to Use It

- Open `index.html` in a browser.
- If the browser blocks external API requests from `file://`, serve the folder locally with a simple tool such as VS Code Live Server.
- Enter an Alpha Vantage API key.
- Enter a stock symbol such as `AAPL`, `MSFT`, or `IBM`.
- Pick a frequency and date range.
- Choose a strategy and set its parameters.
- Click `Run Backtest`.

## Run It On GitHub

- This repo now includes a GitHub Pages workflow at `.github/workflows/deploy-pages.yml`.
- Push the repository to GitHub on the `main` branch.
- In the repository settings, open `Pages` and set the source to `GitHub Actions`.
- After the workflow finishes, GitHub will publish the site with `index.html`, `styles.css`, and `script.js`.
- The deployed site will still need a valid Alpha Vantage API key for symbols other than `IBM`.

## API Notes

- The default `demo` key works best with `IBM`.
- For other tickers, use your own Alpha Vantage API key.
- Daily data on standard keys is often limited to the latest 100 bars.
- Weekly and monthly data are better choices for longer historical ranges.

## Files

- `index.html` contains the app structure and controls
- `styles.css` contains the visual design and responsive layout
- `script.js` contains data fetching, backtesting logic, metrics, and chart rendering

## Note

This project is for learning purposes only and should not be treated as financial advice. The backtest assumes bar-close execution with no slippage, commissions, or taxes.
