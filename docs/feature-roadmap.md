# CryptoQuantLab — Trader Features Roadmap

Priority order based on trader value vs. implementation effort.
All Phase 1 & 2 features use existing CoinGecko price/volume data — no new data sources.

---

## Phase 1 — High Impact, Straightforward (implement first)

### 1. Technical Indicators
**Status:** Not started
**Scope:** Backend computation on price history; toggleable overlays on price chart
**Indicators to implement:**
- RSI (Relative Strength Index) — momentum oscillator, 14-period default
- MACD (Moving Average Convergence Divergence) — signal line, histogram
- Bollinger Bands — 20-period SMA ± 2 std dev overlaid on price chart
- Stochastic Oscillator — %K and %D lines

**Implementation notes:**
- Create `backend/src/services/indicatorsService.ts` with pure functions for each indicator
- Add `technicalIndicators(symbol, timeRange)` GraphQL query returning all indicators
- Add `TechnicalIndicatorsChart.tsx` frontend component with toggle buttons per indicator
- Overlay Bollinger Bands on PriceChart; separate panel for RSI/MACD/Stochastic

---

### 2. Risk Metrics
**Status:** Not started
**Scope:** Computed from price history returns; displayed as a stat card group on CryptoDetail
**Metrics to implement:**
- Sharpe Ratio (annualized, using risk-free rate ≈ 0 for crypto)
- Sortino Ratio (downside deviation only)
- Maximum Drawdown (and drawdown duration)
- Value-at-Risk (VaR 95% and 99%) — use GARCH conditional variance for accuracy
- Calmar Ratio (annualized return / max drawdown)

**Implementation notes:**
- Add to `backend/src/services/indicatorsService.ts` or separate `riskService.ts`
- Add `riskMetrics(symbol, timeRange)` GraphQL query
- Add `RiskMetricsCard.tsx` frontend component — grid of stat cards like the GARCH stat boxes
- VaR can reuse the GARCH model output (currentVolatility) for parametric VaR

---

### 3. Moving Average Crossover Signals
**Status:** Not started
**Scope:** Extend existing MA feature to generate and display buy/sell signals
**Features:**
- Golden cross (50-day MA crosses above 200-day MA) → buy signal
- Death cross (50-day MA crosses below 200-day MA) → sell signal
- Signal history timeline showing past crossovers with dates and subsequent % move
- Hit rate (% of signals that were profitable over 30/60/90 day horizon)

**Implementation notes:**
- Compute crossovers server-side in `indicatorsService.ts`
- Add signal markers to the MovingAverageChart (vertical lines or up/down arrows)
- Add signal history table below the MA chart

---

### 4. Support & Resistance Levels
**Status:** Not started
**Scope:** Auto-detect key price levels; overlay on price chart
**Methods:**
- Pivot points (classic: High/Low/Close based)
- Local min/max detection (rolling window peaks and troughs)
- Volume-weighted price clusters

**Implementation notes:**
- Compute server-side; return as array of `{ price, strength, type: 'support'|'resistance' }`
- Overlay as horizontal reference lines on PriceChart using Recharts `ReferenceLine`

---

## Phase 2 — Medium Effort, High Value

### 5. Correlation Matrix / Heatmap
**Status:** Not started
**Scope:** New page or dashboard section showing pairwise correlations across top coins
**Features:**
- Rolling correlation (30-day default) between top 10-20 coins
- Color-coded heatmap grid (green = positive correlation, red = negative)
- Click a cell to see correlation over time (line chart)
- Useful for portfolio diversification analysis

**Implementation notes:**
- Fetch price histories for multiple coins in parallel
- Compute Pearson correlation on log returns
- Add `correlationMatrix(symbols, timeRange)` GraphQL query
- New `CorrelationHeatmap.tsx` component — likely SVG/CSS grid since Recharts doesn't have a heatmap
- Add route `/correlation` or section on Dashboard

---

### 6. Seasonality & Pattern Analysis
**Status:** Not started
**Scope:** Show average return patterns by hour-of-day and day-of-week
**Features:**
- Heatmap of average returns: rows = hours (0-23), columns = days (Mon-Sun)
- Bar chart of average return by day-of-week
- Useful for timing entries/exits in 24/7 crypto markets

**Implementation notes:**
- Requires hourly or sub-daily data — CoinGecko provides hourly for timeRange ≤ 90 days
- Compute server-side grouping timestamps by hour/day
- Add `seasonalityAnalysis(symbol)` GraphQL query
- New `SeasonalityChart.tsx` component

---

### 7. Regime Detection
**Status:** Not started
**Scope:** Classify current market state (bull/bear/sideways/high-volatility)
**Approach options:**
- Threshold-based: price vs 200-day MA + volatility level
- Hidden Markov Model (2-3 states) on returns — more sophisticated, fits naturally after GARCH
- Display current regime prominently on CryptoDetail header

**Implementation notes:**
- Simple threshold approach first; HMM as enhancement
- Add `marketRegime` field to volatilityModel query or as separate query
- Display as colored badge on CryptoDetail (e.g., "Bull Market", "High Volatility")

---

### 8. Volume / VWAP Analysis
**Status:** Not started
**Scope:** Volume-Weighted Average Price and volume anomaly detection
**Features:**
- VWAP line overlaid on price chart
- Volume spike detection (flag bars > 2σ above mean volume)
- Price-volume divergence alerts (price rises but volume falls = weak signal)

**Implementation notes:**
- VWAP = cumulative(price × volume) / cumulative(volume)
- Volume data already available in price history response
- Add VWAP as optional line overlay in PriceChart

---

## Phase 3 — Larger Features, High Differentiation

### 9. Fear & Greed Index
**Status:** Not started
**Data source:** Alternative.me Crypto Fear & Greed Index (free API, no key required)
**URL:** `https://api.alternative.me/fng/?limit=30`
**Features:**
- Current score (0-100) with label (Extreme Fear / Fear / Neutral / Greed / Extreme Greed)
- 30-day history line chart
- Gauge/dial visualization

**Implementation notes:**
- Add `fearGreedIndex` GraphQL query; backend fetches and caches from alternative.me
- Simple gauge component on Dashboard — very visible, popular with retail traders

---

### 10. Comparative Analysis
**Status:** Not started
**Scope:** Side-by-side comparison of 2-3 coins on a dedicated page
**Features:**
- Normalized price performance chart (all coins start at 100)
- Side-by-side risk metrics (Sharpe, drawdown, volatility)
- Rolling correlation between the selected coins
- Add route `/compare?symbols=BTC,ETH,SOL`

---

### 11. Portfolio Simulator / Backtester
**Status:** Not started
**Scope:** Hypothetical portfolio with historical performance analysis
**Features:**
- User enters coin weights (e.g., 50% BTC, 30% ETH, 20% SOL)
- See historical portfolio value, drawdown, Sharpe ratio
- Mean-variance optimization suggestion (efficient frontier)
- Compare vs. BTC-only benchmark

**Implementation notes:**
- Largest feature in this list — build after risk metrics and correlation are done
- Can be stateless (no DB needed) — just compute on submitted weights
- New route `/portfolio`

---

### 12. Anomaly Detection / Smart Alerts
**Status:** Not started
**Scope:** Extend existing notification system with model-driven alerts
**Alert types:**
- Price move > N standard deviations (Z-score alert)
- Volatility regime change (GARCH variance jumps significantly)
- Volume spike (> 2σ above rolling mean)
- MA crossover signal triggered

**Implementation notes:**
- Builds on existing NotificationRulesList and GARCH infrastructure
- Add alert type selection to notification rule creation UI

---

## Architecture Notes

- All Phase 1 & 2 features: pure computation on CoinGecko data, no new external APIs
- Phase 3 Fear & Greed: one new free API (alternative.me)
- Keep indicator computations server-side to avoid sending raw price arrays to frontend
- Cache computed indicators in NodeCache (same pattern as GARCH — 300s TTL)
- Follow existing pattern: new service file → schema additions → resolver → query → component
