"""Build and execute the validation notebooks in validation/notebooks/.

The notebooks are generated here, not edited by hand, so their code and outputs
always come from the current reference implementations.

    uv run scripts/build_notebooks.py             # all of them
    uv run scripts/build_notebooks.py hmm         # one
"""

import sys
from pathlib import Path

import nbformat
from nbclient import NotebookClient
from nbformat.v4 import new_code_cell, new_markdown_cell, new_notebook

ROOT = Path(__file__).resolve().parent.parent
NOTEBOOK_DIR = ROOT / "notebooks"

SETUP = """\
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.stats.diagnostic import acorr_ljungbox

sys.path.insert(0, str(Path.cwd().parent))
from cql_validation import garch, garch_diagnostics, returns, var

plt.rcParams.update({"figure.figsize": (9, 3.4), "figure.dpi": 100, "axes.grid": True, "grid.alpha": 0.3})
pd.set_option("display.float_format", lambda x: f"{x:.6g}")

btc = pd.read_csv("../data/bitcoin_usd_daily.csv", parse_dates=["date"])
prices = btc["price_usd"].to_numpy()
dates = btc["date"]
periods_per_year = returns.periods_per_year(btc["timestamp_ms"].to_numpy())
print(f"{len(prices)} daily closes, {dates.iloc[0]:%Y-%m-%d} to {dates.iloc[-1]:%Y-%m-%d}; {periods_per_year:.2f} observations per year")"""

REFERENCES_GARCH = """\
## References

- Bollerslev, T. (1986). Generalized autoregressive conditional heteroskedasticity. *Journal of Econometrics*, 31(3), 307–327.
- Engle, R. F. (1982). Autoregressive conditional heteroscedasticity with estimates of the variance of United Kingdom inflation. *Econometrica*, 50(4), 987–1007.
- Jarque, C. M. and Bera, A. K. (1980). Efficient tests for normality, homoscedasticity and serial independence of regression residuals. *Economics Letters*, 6(3), 255–259.
- Ljung, G. M. and Box, G. E. P. (1978). On a measure of lack of fit in time series models. *Biometrika*, 65(2), 297–303.
- Sheppard, K. *arch*: autoregressive conditional heteroskedasticity models in Python. https://github.com/bashtage/arch"""

REFERENCES_VAR = """\
## References

- Barone-Adesi, G., Giannopoulos, K. and Vosper, L. (1999). VaR without correlations for portfolios of derivative securities. *Journal of Futures Markets*, 19(5), 583–602.
- Christoffersen, P. F. (1998). Evaluating interval forecasts. *International Economic Review*, 39(4), 841–862.
- Kupiec, P. H. (1995). Techniques for verifying the accuracy of risk measurement models. *Journal of Derivatives*, 3(2), 73–84.
- McNeil, A. J., Frey, R. and Embrechts, P. (2015). *Quantitative Risk Management: Concepts, Techniques and Tools*, revised edition. Princeton University Press."""


REFERENCES_HMM = """\
## References

- Baum, L. E., Petrie, T., Soules, G. and Weiss, N. (1970). A maximization technique occurring in the statistical analysis of probabilistic functions of Markov chains. *Annals of Mathematical Statistics*, 41(1), 164–171.
- Dempster, A. P., Laird, N. M. and Rubin, D. B. (1977). Maximum likelihood from incomplete data via the EM algorithm. *Journal of the Royal Statistical Society B*, 39(1), 1–38.
- Hamilton, J. D. (1989). A new approach to the economic analysis of nonstationary time series and the business cycle. *Econometrica*, 57(2), 357–384.
- Rabiner, L. R. (1989). A tutorial on hidden Markov models and selected applications in speech recognition. *Proceedings of the IEEE*, 77(2), 257–286.
- Schwarz, G. (1978). Estimating the dimension of a model. *Annals of Statistics*, 6(2), 461–464."""


REFERENCES_MONTE_CARLO = """\
## References

- Barone-Adesi, G., Giannopoulos, K. and Vosper, L. (1999). VaR without correlations for portfolios of derivative securities. *Journal of Futures Markets*, 19(5), 583–602.
- Box, G. E. P. and Muller, M. E. (1958). A note on the generation of random normal deviates. *Annals of Mathematical Statistics*, 29(2), 610–611.
- Glasserman, P. (2004). *Monte Carlo Methods in Financial Engineering*. Springer.
- Hammersley, J. M. and Morton, K. W. (1956). A new Monte Carlo technique: antithetic variates. *Mathematical Proceedings of the Cambridge Philosophical Society*, 52(3), 449–475.
- Kupiec, P. H. (1995). Techniques for verifying the accuracy of risk measurement models. *Journal of Derivatives*, 3(2), 73–84.
- Marsaglia, G. and Tsang, W. W. (2000). A simple method for generating gamma variables. *ACM Transactions on Mathematical Software*, 26(3), 363–372.
- NumPy. SFC64 bit generator. https://numpy.org/doc/stable/reference/random/bit_generators/sfc64.html"""


REFERENCES_PORTFOLIO = """\
## References

- DeMiguel, V., Garlappi, L. and Uppal, R. (2009). Optimal versus naive diversification: how inefficient is the 1/N portfolio strategy? *Review of Financial Studies*, 22(5), 1915–1953.
- Jagannathan, R. and Ma, T. (2003). Risk reduction in large portfolios: why imposing the wrong constraints helps. *Journal of Finance*, 58(4), 1651–1683.
- Ledoit, O. and Wolf, M. (2004a). A well-conditioned estimator for large-dimensional covariance matrices. *Journal of Multivariate Analysis*, 88(2), 365–411.
- Ledoit, O. and Wolf, M. (2004b). Honey, I shrunk the sample covariance matrix. *Journal of Portfolio Management*, 30(4), 110–119.
- Martin, R. A. (2021). PyPortfolioOpt: portfolio optimization in Python. *Journal of Open Source Software*, 6(61), 3066.
- Maillard, S., Roncalli, T. and Teïletche, J. (2010). The properties of equally weighted risk contribution portfolios. *Journal of Portfolio Management*, 36(4), 60–70.
- Markowitz, H. (1952). Portfolio selection. *Journal of Finance*, 7(1), 77–91.
- Nocedal, J. and Wright, S. J. (2006). *Numerical Optimization*, 2nd edition. Springer.
- Pedregosa, F. et al. (2011). Scikit-learn: machine learning in Python. *Journal of Machine Learning Research*, 12, 2825–2830.
- Spinu, F. (2013). An algorithm for computing risk parity weights. SSRN 2297383."""


REFERENCES_BACKTEST = """\
## References

- Bailey, D. H., Borwein, J. M., López de Prado, M. and Zhu, Q. J. (2014). Pseudo-mathematics and financial charlatanism: the effects of backtest overfitting on out-of-sample performance. *Notices of the American Mathematical Society*, 61(5), 458–471.
- Bailey, D. H. and López de Prado, M. (2012). The Sharpe ratio efficient frontier. *Journal of Risk*, 15(2), 3–44.
- Bailey, D. H. and López de Prado, M. (2014). The deflated Sharpe ratio: correcting for selection bias, backtest overfitting and non-normality. *Journal of Portfolio Management*, 40(5), 94–107.
- Brock, W., Lakonishok, J. and LeBaron, B. (1992). Simple technical trading rules and the stochastic properties of stock returns. *Journal of Finance*, 47(5), 1731–1764.
- Lo, A. W. (2002). The statistics of Sharpe ratios. *Financial Analysts Journal*, 58(4), 36–52.
- White, H. (2000). A reality check for data snooping. *Econometrica*, 68(5), 1097–1126."""


def garch_notebook() -> list:
    md, code = new_markdown_cell, new_code_cell
    return [
        md("""\
# GARCH(1,1) on daily Bitcoin returns

This notebook documents the GARCH(1,1) model behind CryptoQuantLab's Risk tab: the data, the model and its likelihood, \
how the parameters are estimated, whether the estimator recovers known parameters, what the fitted model says about \
Bitcoin, and what the diagnostics leave unexplained.

The reference implementation is [`cql_validation/garch.py`](../cql_validation/garch.py). The TypeScript model in \
[`backend/src/models/garch.ts`](../../backend/src/models/garch.ts) is tested against fixtures written from it: \
log-likelihood within 1e-4, parameters within 1e-3, and the conditional volatility path within 0.1% relative."""),
        code(SETUP),
        md("""\
## 1. Data

Daily closes are CoinGecko's 00:00 UTC snapshots for one year. GARCH works on log returns \
$r_t = \\ln(P_t / P_{t-1})$. Before modelling, the returns' summary statistics show why a constant-volatility model \
is a poor description: the excess kurtosis is far from the normal distribution's 0, and Jarque-Bera rejects normality."""),
        code("""\
r = returns.log_returns(prices)
m = returns.moments(r)
jb = stats.jarque_bera(r)
pd.DataFrame(
    {
        "value": [
            len(r),
            m.mean * periods_per_year,
            m.standard_deviation,
            m.standard_deviation * np.sqrt(periods_per_year),
            m.skewness,
            m.excess_kurtosis,
            jb.statistic,
            jb.pvalue,
        ]
    },
    index=[
        "returns",
        "mean (annualized)",
        "standard deviation (daily)",
        "standard deviation (annualized)",
        "skewness (G1)",
        "excess kurtosis (G2)",
        "Jarque-Bera statistic",
        "Jarque-Bera p-value",
    ],
)"""),
        code("""\
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(9, 5.5), sharex=True)
ax1.plot(dates, prices, color="tab:blue")
ax1.set_ylabel("USD")
ax1.set_title("Bitcoin daily close")
ax2.plot(dates[1:], r * 100, color="tab:gray", linewidth=0.8)
ax2.set_ylabel("log return, %")
ax2.set_title("Daily log returns: calm and turbulent periods cluster")
fig.tight_layout()"""),
        md("""\
## 2. Model and likelihood

Returns are demeaned by their sample mean, $\\varepsilon_t = r_t - \\bar r$, and the conditional variance follows

$$h_t = \\omega + \\alpha\\,\\varepsilon_{t-1}^2 + \\beta\\,h_{t-1}, \\qquad \\omega > 0,\\ \\alpha, \\beta \\ge 0,\\ \\alpha + \\beta < 1.$$

With Gaussian innovations $\\varepsilon_t = \\sqrt{h_t}\\,z_t$, $z_t \\sim N(0, 1)$, the log-likelihood conditional on \
$h_0$ is

$$\\ln L(\\omega, \\alpha, \\beta) = -\\tfrac{1}{2}\\sum_{t=1}^{n-1}\\left(\\ln 2\\pi + \\ln h_t + \\frac{\\varepsilon_t^2}{h_t}\\right).$$

Two conventions matter when comparing implementations. Here $h_0$ is the sample variance and the $t = 0$ term is \
left out. The `arch` package instead backcasts the pre-sample variance and includes every term, so its estimates \
differ slightly on the same data.

The unconditional variance is $\\bar\\sigma^2 = \\omega / (1 - \\alpha - \\beta)$. A shock's effect on the variance \
decays by the persistence $\\alpha + \\beta$ each day, giving a half-life of $\\ln 0.5 / \\ln(\\alpha + \\beta)$."""),
        md("""\
## 3. Estimation

The reference maximises the likelihood in percent units, so the three parameters have similar scales. It starts SLSQP \
from a grid of starting points under the stationarity constraint, then polishes the best result with Nelder-Mead. The \
TypeScript model uses Nelder-Mead on $(\\ln\\omega, \\ln\\alpha, \\ln\\beta)$ from a single start; the tests check it \
reaches the same maximum.

The likelihood surface below fixes $\\omega$ by variance targeting, $\\omega = (1 - \\alpha - \\beta)\\,s^2$, so the \
picture shows how sharply the data pin down $\\alpha$ and $\\beta$. The estimate is marked."""),
        code("""\
fit = garch.fit(prices)
check = garch.arch_cross_check(prices, horizon=30)
pd.DataFrame(
    {
        "reference": [fit.omega, fit.alpha, fit.beta, fit.alpha + fit.beta, fit.log_likelihood],
        "arch": [check["omega"], check["alpha"], check["beta"], check["alpha"] + check["beta"], np.nan],
        "arch std. error": [check["stdErrors"]["omega"], check["stdErrors"]["alpha"], check["stdErrors"]["beta"], np.nan, np.nan],
    },
    index=["ω", "α", "β", "α + β", "log-likelihood"],
)"""),
        code("""\
resid = garch.demeaned_log_returns(prices)
s2 = float(np.mean(resid**2))
alphas = np.linspace(0.02, 0.45, 60)
betas = np.linspace(0.30, 0.95, 60)
surface = np.full((len(betas), len(alphas)), np.nan)
for i, b in enumerate(betas):
    for j, a in enumerate(alphas):
        if a + b < 0.995:
            surface[i, j] = garch.log_likelihood((1 - a - b) * s2, a, b, resid, s2)

fig, ax = plt.subplots(figsize=(6.5, 5))
levels = np.nanmax(surface) - np.array([40, 20, 10, 5, 2, 0.5])
contour = ax.contour(alphas, betas, surface, levels=levels, cmap="viridis")
ax.clabel(contour, fmt=lambda v: f"{v - np.nanmax(surface):.1f}", fontsize=8)
ax.plot(fit.alpha, fit.beta, "r*", markersize=12, label="maximum likelihood")
ax.set_xlabel("α")
ax.set_ylabel("β")
ax.set_title("Log-likelihood relative to its maximum (variance targeting)")
ax.legend()"""),
        md("""\
## 4. Does the estimator recover known parameters?

A year of daily data is a small sample for GARCH. To see how well the estimator works at this size, the cell below \
simulates 30 paths of 1,000 days from a GARCH(1,1) with known parameters, fits each, and compares the estimates with \
the truth."""),
        code("""\
true = {"omega": 4.5e-5, "alpha": 0.10, "beta": 0.85}
rng = np.random.default_rng(20261026)


def simulate(n, omega, alpha, beta):
    h, prev, out = omega / (1 - alpha - beta), 0.0, np.empty(n)
    for t in range(n):
        h = omega + alpha * prev**2 + beta * h
        prev = np.sqrt(h) * rng.standard_normal()
        out[t] = prev
    return 100 * np.exp(np.concatenate([[0.0], np.cumsum(out)]))


estimates = pd.DataFrame([vars(garch.fit(simulate(1000, **true)))  for _ in range(30)])[["omega", "alpha", "beta"]]
estimates["persistence"] = estimates["alpha"] + estimates["beta"]
truth = pd.Series({**true, "persistence": true["alpha"] + true["beta"]})
pd.DataFrame(
    {
        "true": truth,
        "mean estimate": estimates.mean(),
        "bias": estimates.mean() - truth,
        "std. dev.": estimates.std(ddof=1),
        "RMSE": np.sqrt(((estimates - truth) ** 2).mean()),
    }
)"""),
        code("""\
fig, axes = plt.subplots(1, 3, figsize=(9, 3))
for ax, name in zip(axes, ["alpha", "beta", "persistence"]):
    ax.hist(estimates[name], bins=12, color="tab:blue", alpha=0.7)
    ax.axvline(truth[name], color="red", linestyle="--", label="true")
    ax.set_title(name)
axes[0].legend()
fig.suptitle("Estimates from 30 simulated paths of 1,000 days")
fig.tight_layout()"""),
        code("""\
cv = estimates[["alpha", "beta", "persistence"]].std(ddof=1) / truth[["alpha", "beta", "persistence"]]
print(f"coefficient of variation: α {cv['alpha']:.1%}, β {cv['beta']:.1%}, α + β {cv['persistence']:.1%}")
print(f"correlation of the α and β estimates: {estimates['alpha'].corr(estimates['beta']):.2f}")"""),
        md("""\
The estimator is close to unbiased at this sample size. Relative to its size, $\\alpha$ is the least precise \
estimate and the persistence $\\alpha + \\beta$ the most: $\\alpha$ and $\\beta$ are strongly negatively \
correlated across samples, along the ridge visible in the likelihood surface above, so their errors partly cancel in \
the sum. That matters for interpretation, because the half-life and the forecasts depend mainly on the persistence."""),
        md("""\
## 5. The fitted model on Bitcoin"""),
        code("""\
annualize = np.sqrt(periods_per_year) * 100
persistence = fit.alpha + fit.beta
pd.DataFrame(
    {
        "value": [
            persistence,
            np.log(0.5) / np.log(persistence),
            np.sqrt(fit.omega / (1 - persistence)) * annualize,
            np.sqrt(fit.variance[-1]) * annualize,
            np.sqrt(fit.next_variance) * annualize,
        ]
    },
    index=[
        "persistence α + β",
        "half-life (days)",
        "long-run volatility (% a year)",
        "latest conditional volatility (% a year)",
        "next-day forecast (% a year)",
    ],
)"""),
        code("""\
fig, ax = plt.subplots()
ax.plot(dates[2:], np.abs(r[1:]) * annualize, color="tab:gray", linewidth=0.6, alpha=0.6, label="|daily return|, annualized")
ax.plot(dates[2:], np.sqrt(fit.variance) * annualize, color="tab:orange", linewidth=1.8, label="GARCH conditional volatility")
ax.axhline(np.sqrt(fit.omega / (1 - persistence)) * annualize, color="tab:blue", linestyle="--", label="long-run level")
ax.set_ylabel("% a year")
ax.set_title("Conditional volatility tracks the size of recent returns")
ax.legend(loc="upper right")"""),
        md("""\
## 6. Diagnostics

If the model is adequate, the standardized residuals $z_t = \\varepsilon_t / \\sqrt{h_t}$ should be serially \
uncorrelated, their squares should show no remaining volatility clustering, and for the Gaussian likelihood to be \
correctly specified they should be normal. Ljung-Box at several lags tests the first two, on the raw returns for \
comparison."""),
        code("""\
z = garch_diagnostics.standardized_residuals(prices, fit)
rows = {}
for name, series in {"r": resid[1:], "r²": resid[1:] ** 2, "z": z, "z²": z**2}.items():
    lb = acorr_ljungbox(series, lags=[5, 10, 20])
    rows[name] = lb["lb_pvalue"].to_numpy()
pd.DataFrame(rows, index=["p-value, 5 lags", "p-value, 10 lags", "p-value, 20 lags"]).T"""),
        code("""\
jb_z = stats.jarque_bera(z)
info = garch_diagnostics.information_criteria(fit, len(z))
pd.DataFrame(
    {"value": [stats.kurtosis(z, fisher=True, bias=False), jb_z.statistic, jb_z.pvalue, info["aic"], info["bic"]]},
    index=["excess kurtosis of z", "Jarque-Bera statistic", "Jarque-Bera p-value", "AIC (k = 4)", "BIC (k = 4)"],
)"""),
        code("""\
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9, 3.8))
stats.probplot(z, dist="norm", plot=ax1)
ax1.set_title("Standardized residuals against the normal")
t_dof = stats.t.fit(z)[0]
stats.probplot(z, dist=stats.t, sparams=(t_dof,), plot=ax2)
ax2.set_title(f"…and against a Student-t with ν = {t_dof:.1f}")
for ax in (ax1, ax2):
    ax.get_lines()[0].set_markersize(3)
fig.tight_layout()"""),
        md("""\
GARCH removes the volatility clustering: the Ljung-Box tests reject strongly on the squared returns and not on the \
squared standardized residuals. It does not make the residuals normal. Their excess kurtosis stays well above zero, \
Jarque-Bera rejects, and the QQ plot shows the tails bending away from the normal line while following a Student-t \
far more closely. The volatility dynamics are captured; the Gaussian likelihood is not quite right."""),
        md("""\
## 7. Forecasts

The variance forecast $k$ days ahead decays from the one-step-ahead variance to the long-run level, \
$h_{T+k} = \\bar\\sigma^2 + (\\alpha + \\beta)^{k-1}(h_{T+1} - \\bar\\sigma^2)$. The Risk tab reports the volatility of \
the average daily variance over 1, 7 and 30 days."""),
        code("""\
horizon = np.arange(1, 61)
point = np.array([garch.forecast_variance(fit, k) for k in horizon])
average = np.cumsum(point) / horizon
fig, ax = plt.subplots()
ax.plot(horizon, np.sqrt(point) * annualize, label="variance on day k")
ax.plot(horizon, np.sqrt(average) * annualize, label="average over the first k days")
ax.axhline(np.sqrt(fit.omega / (1 - persistence)) * annualize, color="tab:blue", linestyle="--", linewidth=1, label="long-run level")
ax.set_xlabel("days ahead")
ax.set_ylabel("% a year")
ax.set_title("Volatility term structure")
ax.legend()"""),
        md("""\
## 8. Limitations

- **Gaussian errors.** The residual kurtosis says a Student-t or skewed-t likelihood would fit better. The Risk tab's \
GARCH-filtered VaR avoids the issue by drawing tomorrow's shape from the residuals themselves.
- **Symmetric response.** GARCH(1,1) treats falls and rises alike; GJR-GARCH or EGARCH would test for leverage effects.
- **Sample size.** One year of daily data identifies the persistence well, but $\\alpha$ and $\\beta$ individually much \
less so, as the simulation shows.
- **Daily closes only.** Intraday data would allow realized-variance measures and range-based estimators, which are \
far less noisy than squared daily returns."""),
        md(REFERENCES_GARCH),
    ]


def var_notebook() -> list:
    md, code = new_markdown_cell, new_code_cell
    return [
        md("""\
# One-day Value at Risk and expected shortfall, with backtests

This notebook documents how CryptoQuantLab estimates one-day VaR and expected shortfall, and how it tests them. \
Four methods are estimated from a 180-day window and each is backtested out of sample on every later day.

The reference implementation is [`cql_validation/var.py`](../cql_validation/var.py). The TypeScript models in \
[`valueAtRisk.ts`](../../backend/src/models/valueAtRisk.ts) and [`varBacktest.ts`](../../backend/src/models/varBacktest.ts) \
reproduce every exception day below exactly, and the test statistics to 1e-10."""),
        code(SETUP),
        md("""\
## 1. Definitions

VaR and ES are computed on simple returns $R_t = P_t / P_{t-1} - 1$, so a position's dollar loss is exactly \
$-R_t$ times its size. At tail probability $\\alpha = 1 - c$,

$$\\text{VaR}_\\alpha = -Q_\\alpha(R), \\qquad \\text{ES}_\\alpha = -\\mathbb{E}\\left[R \\mid R \\le Q_\\alpha(R)\\right].$$

The four estimators:

| Method | VaR | ES |
|---|---|---|
| Historical | empirical quantile (linear interpolation) | mean of returns at or below it |
| Normal | $-(\\mu + \\sigma z_\\alpha)$ | $-(\\mu - \\sigma\\,\\varphi(z_\\alpha)/\\alpha)$ |
| Student-t, maximum likelihood | $-(\\mu + s\\,q)$, $q = t_\\nu^{-1}(\\alpha)$ | $-\\left(\\mu - s\\,\\frac{f_\\nu(q)}{\\alpha}\\cdot\\frac{\\nu + q^2}{\\nu - 1}\\right)$ |
| GARCH-filtered historical simulation | $1 - e^{\\mu + \\sigma_{T+1} Q_\\alpha(z)}$ | mean of $1 - e^{\\mu + \\sigma_{T+1} z}$ over $z \\le Q_\\alpha(z)$ |

In the filtered method, a GARCH(1,1) fitted to the window's log returns gives tomorrow's volatility $\\sigma_{T+1}$ and \
the standardized residuals $z$ give the shape of a bad day."""),
        code("""\
WINDOW = 180
R = returns.simple_returns(prices)
latest = R[-WINDOW:]
t_fit = var.fit_student_t(latest)
filtered = var.fit_filtered(latest)
estimates = {}
for confidence in (0.95, 0.99):
    a = 1 - confidence
    estimates[("historical", confidence)] = var.historical(latest, a)
    estimates[("normal", confidence)] = var.normal(latest, a)
    estimates[("Student-t", confidence)] = var.student_t(latest, a, t_fit)
    estimates[("GARCH-filtered", confidence)] = var.filtered_historical(latest, a, filtered)
table = pd.DataFrame(estimates, index=["VaR", "ES"]).T * 100
table.index.names = ["method", "confidence"]
table.round(2).unstack("confidence")"""),
        md("""\
Expected shortfall rises much faster than VaR from the normal to the Student-t: with roughly three degrees of freedom \
the fitted tail is heavy, so the average loss beyond the 99% VaR is far above the VaR itself."""),
        code("""\
scipy_dof, scipy_loc, scipy_scale = stats.t.fit(latest)
pd.DataFrame(
    {
        "reference (scipy, polished)": [t_fit.dof, t_fit.location, t_fit.scale, t_fit.log_likelihood],
        "scipy t.fit": [scipy_dof, scipy_loc, scipy_scale, float(np.sum(stats.t.logpdf(latest, scipy_dof, scipy_loc, scipy_scale)))],
    },
    index=["degrees of freedom ν", "location", "scale", "log-likelihood"],
)"""),
        code("""\
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9, 3.8))
stats.probplot(latest, dist="norm", plot=ax1)
ax1.set_title("Window returns against the normal")
stats.probplot(latest, dist=stats.t, sparams=(t_fit.dof, t_fit.location, t_fit.scale), plot=ax2)
ax2.set_title(f"…and against the fitted Student-t (ν = {t_fit.dof:.1f})")
for ax in (ax1, ax2):
    ax.get_lines()[0].set_markersize(3)
fig.tight_layout()"""),
        md("""\
## 2. Out-of-sample backtest

For each day $t$ after the first 180, VaR is estimated from the 180 returns before $t$ only, and an exception is a \
day whose loss exceeds it. The fits are cached per day so both confidence levels share them."""),
        code("""\
methods = {"historical": "historical", "normal": "normal", "Student-t": "studentT", "GARCH-filtered": "filteredHistorical"}
cache = {name: {} for name in methods.values()}
test_dates = dates.iloc[WINDOW + 1 :].reset_index(drop=True)
paths, hits = {}, {}
for label, name in methods.items():
    for confidence in (0.95, 0.99):
        a = 1 - confidence
        series = []
        for t in range(WINDOW, len(R)):
            sample = R[t - WINDOW : t]
            if name == "studentT":
                cache[name].setdefault(t, var.fit_student_t(sample))
                series.append(var.student_t(sample, a, cache[name][t])[0])
            elif name == "filteredHistorical":
                cache[name].setdefault(t, var.fit_filtered(sample))
                series.append(var.filtered_historical(sample, a, cache[name][t])[0])
            else:
                series.append(var.METHODS[name](sample, a)[0])
        paths[(label, confidence)] = np.array(series)
        hits[(label, confidence)] = R[WINDOW:] < -paths[(label, confidence)]
print(f"{len(test_dates)} test days, {test_dates.iloc[0]:%Y-%m-%d} to {test_dates.iloc[-1]:%Y-%m-%d}")"""),
        code("""\
fig, axes = plt.subplots(4, 1, figsize=(9, 10), sharex=True, sharey=True)
loss = -R[WINDOW:] * 100
for ax, label in zip(axes, methods):
    path = paths[(label, 0.95)] * 100
    exceptions = hits[(label, 0.95)]
    ax.bar(test_dates, loss, color="tab:gray", width=1.0, alpha=0.5, label="daily loss")
    ax.plot(test_dates, path, color="tab:blue", linewidth=1.5, label="95% VaR, estimated the day before")
    ax.plot(test_dates[exceptions], loss[exceptions], "rv", markersize=6, label="exception")
    ax.set_title(f"{label}: {exceptions.sum()} exceptions in {len(exceptions)} days ({0.05 * len(exceptions):.1f} expected)")
    ax.set_ylabel("loss, %")
axes[0].legend(loc="upper right", fontsize=8)
fig.tight_layout()"""),
        md("""\
The historical and Student-t lines move slowly because every day in the window counts equally. The GARCH-filtered \
line reacts within days of a large move and falls back in calm periods, which is why its exceptions are closest to \
the expected count.

## 3. Coverage tests

With $x$ exceptions in $n$ days, Kupiec's unconditional coverage test compares the exception rate with $\\alpha$:

$$LR_{uc} = -2\\ln\\left[(1-\\alpha)^{n-x}\\alpha^{x}\\right] + 2\\ln\\left[\\left(1-\\tfrac{x}{n}\\right)^{n-x}\\left(\\tfrac{x}{n}\\right)^{x}\\right] \\sim \\chi^2_1.$$

Christoffersen's test asks whether an exception makes another one tomorrow more likely, from the counts $n_{ij}$ of \
days in state $j$ after a day in state $i$, and $LR_{cc} = LR_{uc} + LR_{ind} \\sim \\chi^2_2$ tests both at once. A \
method passes on the Risk tab when both the Kupiec and conditional coverage p-values are at least 0.05."""),
        code("""\
rows = []
for (label, confidence), h in hits.items():
    a = 1 - confidence
    lr_uc, p_uc = var.kupiec(list(h), a)
    lr_ind, p_ind = var.christoffersen(list(h))
    p_cc = float(stats.chi2.sf(lr_uc + lr_ind, 2))
    rows.append({
        "method": label, "confidence": confidence, "exceptions": int(h.sum()), "expected": a * len(h),
        "Kupiec p": p_uc, "Christoffersen p": p_ind, "conditional coverage p": p_cc,
        "passes": p_uc >= 0.05 and p_cc >= 0.05,
    })
pd.DataFrame(rows).set_index(["confidence", "method"]).sort_index()"""),
        md("""\
## 4. How much can a one-year backtest tell us?

With about 185 test days, few exceptions are expected at 99%, so the test can only detect large errors. The cell \
below computes the probability that Kupiec's test rejects, at the 5% level, when the true exception rate differs from \
the nominal one. Exceptions are binomial when the model's exception days are independent."""),
        code("""\
n = len(test_dates)


def rejection_probability(nominal, true_rate):
    x = np.arange(n + 1)
    p_values = np.array([var.kupiec([True] * k + [False] * (n - k), nominal)[1] for k in x])
    return float(stats.binom.pmf(x[p_values < 0.05], n, true_rate).sum())


true_rates = [0.005, 0.01, 0.02, 0.03, 0.05, 0.075, 0.10]
pd.DataFrame(
    {"95% VaR": [rejection_probability(0.05, q) for q in true_rates], "99% VaR": [rejection_probability(0.01, q) for q in true_rates]},
    index=pd.Index([f"{q:.1%}" for q in true_rates], name="true exception rate"),
).round(3)"""),
        md("""\
A 99% VaR that is actually breached on 2% of days, twice as often as it should be, is rejected only a minority of the \
time with one year of data. A pass at 99% is therefore weak evidence, which is why the Risk tab says so. The 95% test \
has more power, and it is the level at which the methods differ: the normal model fails by being too cautious and \
the GARCH-filtered method comes closest to the nominal rate.

## 5. Limitations

- **Short history.** CoinGecko's demo key reaches back 365 days, leaving about 185 test days after the first window. \
The history grows by a day each night.
- **One day only.** Ten-day VaR needs simulation (bootstrapped GARCH paths), not the square-root-of-time rule, given \
these tails.
- **Single assets.** Portfolio VaR needs a covariance model; Ledoit-Wolf shrinkage is planned.
- **Backtest power,** as section 4 shows."""),
        md(REFERENCES_VAR),
    ]


def hmm_notebook() -> list:
    md, code = new_markdown_cell, new_code_cell
    return [
        md("""\
# A two-state hidden Markov model of daily crypto returns

This notebook documents the hidden Markov model behind the regime panel on CryptoQuantLab's Risk tab: the model and \
its likelihood, how it is fitted and checked, how many states a year of returns supports, how well a year identifies \
the parameters, and whether the state says anything about the next day using only data available at the time.

The model is in [`batch/cql_batch/hmm.py`](../../batch/cql_batch/hmm.py). Unlike the other models it is fitted in \
Python, by the nightly `fit-regimes` job, so its tests in \
[`batch/tests/test_hmm.py`](../../batch/tests/test_hmm.py) compare it with independent libraries rather than with a \
reference written here.

**The main result is mixed.** The model gives a better one-day distribution than a normal with constant or EWMA \
variance, but it does not predict the size of the next move better than a simple volatility percentile. That is why \
it sits beside the threshold badge on the site rather than replacing it."""),
        code("""\
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import statsmodels.api as sm
from arch import arch_model

sys.path.insert(0, str(Path.cwd().parent.parent / "batch"))
from cql_batch import hmm

plt.rcParams.update({"figure.figsize": (9, 3.4), "figure.dpi": 100, "axes.grid": True, "grid.alpha": 0.3})
pd.set_option("display.float_format", lambda x: f"{x:.6g}")

def load(coin):
    frame = pd.read_csv(f"../data/{coin}_usd_daily.csv", parse_dates=["date"])
    return frame["date"].iloc[1:].reset_index(drop=True), np.diff(np.log(frame["price_usd"].to_numpy()))

dates, r = load("bitcoin")
n = len(r)
print(f"{n} daily log returns, {dates.iloc[0]:%Y-%m-%d} to {dates.iloc[-1]:%Y-%m-%d}")"""),
        md("""\
## 1. Why states

Daily returns barely correlate with their own past, but their size does. The squared returns below are \
autocorrelated at lag 1, so quiet and violent days cluster. GARCH models that with a variance that moves continuously. \
A hidden Markov model asks instead whether the data looks like a few discrete conditions with switches between them."""),
        code("""\
series = pd.Series(r)
pd.DataFrame(
    {"returns": [series.autocorr(k) for k in (1, 2, 5)], "squared returns": [(series**2).autocorr(k) for k in (1, 2, 5)]},
    index=pd.Index([1, 2, 5], name="lag"),
)"""),
        md(r"""\
## 2. The model

Each day has a hidden state $S_t \in \{1, \dots, k\}$ following a Markov chain with transition matrix \
$A = (a_{ij})$, and the log return is normal given the state:

$$r_t \mid S_t = j \sim N(\mu_j, \sigma_j^2), \qquad P(S_{t+1} = j \mid S_t = i) = a_{ij}.$$

The likelihood sums over every path of states, which the forward recursion computes in $O(nk^2)$ rather than $O(k^n)$. \
With $b_j(r) = N(r; \mu_j, \sigma_j^2)$:

$$\alpha_t(j) = \frac{b_j(r_t) \sum_i \alpha_{t-1}(i)\, a_{ij}}{c_t}, \qquad \log L = \sum_{t=1}^{n} \log c_t.$$

$\alpha_t$ is the **filtered** probability $P(S_t \mid r_1, \dots, r_t)$. The backward recursion adds the later data to \
give the **smoothed** probability $P(S_t \mid r_1, \dots, r_n)$.

The parameters are fitted by expectation-maximization (Baum-Welch). The E step computes the smoothed probabilities \
$\gamma_t(j)$ and expected transitions $\xi_t(i,j)$. The M step is closed-form:

$$\hat a_{ij} = \frac{\sum_t \xi_t(i,j)}{\sum_t \gamma_t(i)}, \quad \hat\mu_j = \frac{\sum_t \gamma_t(j)\, r_t}{\sum_t \gamma_t(j)}, \quad \hat\sigma_j^2 = \frac{\sum_t \gamma_t(j)(r_t - \hat\mu_j)^2}{\sum_t \gamma_t(j)}.$$

A normal likelihood is unbounded as a state's variance shrinks onto a few similar returns, so each variance is floored \
at $10^{-3}$ of the sample variance. EM runs from ten starts and keeps the highest likelihood. States are numbered by \
variance, so the labels stay comparable between refits."""),
        md("""\
## 3. Fit to Bitcoin"""),
        code("""\
fit = hmm.fit_hmm(r)
pd.DataFrame(
    {
        "daily mean": fit.means,
        "daily volatility": np.sqrt(fit.variances),
        "annualized volatility": np.sqrt(fit.variances * 365.25),
        "stay probability": np.diag(fit.transition),
        "expected days": hmm.expected_duration(fit.transition),
        "long-run share": hmm.stationary_distribution(fit.transition),
    },
    index=pd.Index(["calm", "turbulent"], name="state"),
).T"""),
        md("""\
The states differ in volatility by a factor of about 2.7. The calm state is the persistent one, with spells of about \
15 days. The turbulent state lasts about 3 days, so it behaves more like a cluster of bad days than a long market \
phase.

Both daily means are small and negative, and section 6 shows they can't be told apart. **The states describe \
volatility, not direction.**

### Checks

The tests in `batch/tests/test_hmm.py` run these on Bitcoin and Ethereum, and also confirm that the recursions match \
enumerating all $3^8$ paths of a short series to 1e-12 and that EM iterates match hmmlearn to 1e-9. The cell below \
repeats the comparison with statsmodels, which maximizes the likelihood directly rather than by EM."""),
        code("""\
model = sm.tsa.MarkovRegression(r, k_regimes=2, trend="c", switching_variance=True)
model.initialize_steady_state()

params = np.r_[fit.transition[0, 0], fit.transition[1, 0], fit.means, fit.variances]
stationary = hmm.stationary_distribution(fit.transition)
ours = hmm.forward_backward(hmm.log_densities(r, fit.means, fit.variances), stationary, fit.transition)[0]
theirs = model.loglike(params)
restarts = model.fit(search_reps=40, search_iter=20, disp=False)

print(f"same parameters, stationary start: ours {ours:.8f}, statsmodels {theirs:.8f}")
print(f"best statsmodels fit from 40 random starts: {restarts.llf:.6f}")
print(f"our fit, which also estimates the initial state: {fit.log_likelihood:.6f}")"""),
        md("""\
The two likelihood functions agree at the same parameters. statsmodels ties the initial state to the stationary \
distribution while this model estimates it, which accounts for the small difference between the two maxima. \
statsmodels' random restarts find nothing higher.

## 4. Filtered and smoothed probabilities"""),
        code("""\
fig, ax = plt.subplots()
ax.fill_between(dates, fit.filtered[:, 1], step="post", alpha=0.45, color="tab:orange", label="filtered: returns up to that day")
ax.plot(dates, fit.smoothed[:, 1], color="0.3", lw=0.9, label="smoothed: all returns")
ax.set_ylabel("P(turbulent)")
ax.legend(loc="upper right")
plt.show()

print(f"days above 50%: filtered {(fit.filtered[:, 1] > 0.5).sum()}, smoothed {(fit.smoothed[:, 1] > 0.5).sum()}")
print(f"correlation between the two: {np.corrcoef(fit.filtered[:, 1], fit.smoothed[:, 1])[0, 1]:.3f}")"""),
        md("""\
The smoothed line is sharper because it uses later returns, so it could not have been known on the day. The filtered \
area doesn't use later returns, but the parameters behind it come from the whole year, so the history on the site is \
**not** a true out-of-sample record. Section 7 is the out-of-sample test.

## 5. How many states"""),
        code("""\
log_likelihood_1 = -0.5 * n * (np.log(2 * np.pi * r.var()) + 1)
fit_3 = hmm.fit_hmm(r, k=3)
display(pd.DataFrame(
    {
        "parameters": [2, fit.parameter_count, fit_3.parameter_count],
        "log-likelihood": [log_likelihood_1, fit.log_likelihood, fit_3.log_likelihood],
        "AIC": [4 - 2 * log_likelihood_1, fit.aic(), fit_3.aic()],
        "BIC": [2 * np.log(n) - 2 * log_likelihood_1, fit.bic(n), fit_3.bic(n)],
    },
    index=pd.Index([1, 2, 3], name="states"),
))

cross_section = pd.read_csv("../data/hmm_cross_section.csv")
cross_section.best_bic_states.value_counts().sort_index().rename("coins preferring this many states, by BIC").to_frame()"""),
        md("""\
BIC clearly prefers two states on Bitcoin. AIC barely separates two from three, and its small preference for three is \
not worth doubling the parameters on 363 returns. The third state's volatility of about 0.3% a day also looks like it \
is fitting a few unusually quiet days rather than a market condition.

The cross-section comes from \
[`scripts/hmm_cross_section.py`](../scripts/hmm_cross_section.py), run on a year of every stored coin. Two states wins \
for most coins, so the site fixes two. Where two states don't beat one normal by BIC, the site says so and shows no \
state.

## 6. What a year of data can identify

The cell below simulates 300 years from the fitted Bitcoin model and refits each one."""),
        code("""\
rng = np.random.default_rng(7)
sds = np.sqrt(fit.variances)
stationary = hmm.stationary_distribution(fit.transition)

def simulate():
    states = np.empty(n, dtype=int)
    states[0] = rng.choice(2, p=stationary)
    for t in range(1, n):
        states[t] = rng.choice(2, p=fit.transition[states[t - 1]])
    return fit.means[states] + sds[states] * rng.standard_normal(n), states

rows = []
for _ in range(300):
    x, states = simulate()
    g = hmm.fit_hmm(x, starts=3)
    one_state = 2 * np.log(n) + n * (np.log(2 * np.pi * x.var()) + 1)
    rows.append({
        "calm stay": g.transition[0, 0], "turbulent stay": g.transition[1, 1],
        "calm daily vol": np.sqrt(g.variances[0]), "turbulent daily vol": np.sqrt(g.variances[1]),
        "calm mean": g.means[0], "turbulent mean": g.means[1],
        "supported": g.bic(n) < one_state, "accuracy": (g.smoothed.argmax(axis=1) == states).mean(),
    })
sims = pd.DataFrame(rows)

truth = pd.Series({
    "calm stay": fit.transition[0, 0], "turbulent stay": fit.transition[1, 1],
    "calm daily vol": sds[0], "turbulent daily vol": sds[1],
    "calm mean": fit.means[0], "turbulent mean": fit.means[1],
})
display(pd.DataFrame({
    "true": truth, "mean estimate": sims[truth.index].mean(), "std dev": sims[truth.index].std(),
    "5%": sims[truth.index].quantile(0.05), "95%": sims[truth.index].quantile(0.95),
}))
print(f"BIC prefers two states in {sims.supported.mean():.0%} of simulations; smoothed state correct on {sims.accuracy.mean():.0%} of days")"""),
        md("""\
Three things follow, even though the simulated data really does come from this model:

- **Volatilities are well identified.** Each state's volatility is estimated to within about 6–14%.
- **The turbulent state's persistence is not.** The 90% range for its stay probability is roughly 0.4 to 0.85, which \
is an expected spell of under 2 days or nearly 7. The site's "lasts about 3 days" is rough.
- **The means can't be separated.** The turbulent mean's standard error is about five times the estimate itself, so \
nothing here supports reading the states as bull and bear.

## 7. Does the state say anything about the next day?

This is the test that decided how the model is used. For Bitcoin and Ethereum, each model is refitted weekly on the \
previous 180 returns and scored on each following day, using only data available at the time. The score is the mean \
log density of the realized return under the one-day forecast, so higher is better.

GARCH is the natural rival, so it joins here using `arch`, with parameters frozen between refits in the same way."""),
        code("""\
TRAIN, REFIT = 180, 7

def log_normal(x, mean, variance):
    return -0.5 * (np.log(2 * np.pi * variance) + (x - mean) ** 2 / variance)

def garch_step(history, params):
    mu, omega, alpha, beta = params
    variance = history.var()
    for x in history:
        variance = omega + alpha * (x - mu) ** 2 + beta * variance
    return mu, variance

def walk_forward(x):
    rows = []
    for t in range(TRAIN, len(x)):
        history = x[t - TRAIN : t]
        if (t - TRAIN) % REFIT == 0:
            fitted = hmm.fit_hmm(history, starts=5)
            result = arch_model(history * 100, mean="Constant", vol="GARCH", p=1, q=1).fit(disp="off")
            garch_params = result.params["mu"] / 100, result.params["omega"] / 1e4, result.params["alpha[1]"], result.params["beta[1]"]

        _, filtered, _, _ = hmm.forward_backward(hmm.log_densities(history, fitted.means, fitted.variances), fitted.initial, fitted.transition)
        predicted = filtered[-1] @ fitted.transition
        weights = 0.94 ** np.arange(TRAIN - 1, -1, -1)
        mu, garch_variance = garch_step(history, garch_params)

        rows.append({
            "hidden Markov": np.logaddexp.reduce(log_normal(x[t], fitted.means, fitted.variances) + np.log(predicted + 1e-300)),
            "constant normal": log_normal(x[t], history.mean(), history.var(ddof=1)),
            "EWMA normal": log_normal(x[t], 0.0, (weights * history**2).sum() / weights.sum()),
            "GARCH normal": log_normal(x[t], mu, garch_variance),
        })
    return pd.DataFrame(rows)

scores = {coin: walk_forward(load(coin)[1]) for coin in ["bitcoin", "ethereum"]}
pd.DataFrame({coin: frame.mean() for coin, frame in scores.items()}).rename_axis("mean log score")"""),
        md("""\
On both coins the hidden Markov model scores above GARCH with normal innovations as well as the two simpler rivals. \
That is two coins and about 180 days each, and a normal GARCH has thin tails, so it isn't evidence against GARCH in \
general. The next table asks the same question across every coin, without GARCH, along with whether the state predicts \
the size of the next move."""),
        code("""\
walk = cross_section[cross_section.test_days.notna()]

def summarize(frame):
    turbulent = frame[frame.turbulent_days >= 5]
    return {
        "coins": len(frame),
        "better than constant normal": int((frame.hmm_score > frame.normal_score).sum()),
        "better than EWMA normal": int((frame.hmm_score > frame.ewma_score).sum()),
        "next-day move, turbulent / calm (median)": (turbulent.move_after_turbulent / turbulent.move_after_calm).median(),
        "next-day move, high / low percentile (median)": (frame.move_after_high_percentile / frame.move_after_low_percentile).median(),
        "correlation with next move, hidden Markov (median)": frame.hmm_move_correlation.median(),
        "correlation with next move, percentile (median)": frame.percentile_move_correlation.median(),
    }

pd.DataFrame({
    "every coin": summarize(walk),
    "daily volatility of at least 0.5%": summarize(walk[walk.daily_volatility >= 0.005]),
})"""),
        md("""\
Removing stablecoins and tokenized funds, the second column, changes little.

- **As a distribution, the model does better.** It beats a normal with constant or EWMA variance for most coins. A \
two-state mixture has fat tails, which a single normal lacks, so at least part of this advantage is simply a better \
tail shape rather than knowing the state.
- **As a predictor of move size, it adds nothing over a percentile.** The next day's move is about 1.47 times larger \
after a turbulent day, against 1.43 times after a high-percentile day, and the percentile correlates more strongly \
with the size of the next move.

So the threshold badge stays as the headline, because it is simpler and at least as predictive. The hidden Markov \
panel adds what the threshold can't give: a probability, a day-by-day state and the speed of switching.

## 8. Limitations

- **Normal within each state.** Fat tails come only from the mixture, so a large move is read as a state switch even \
when it is a one-off. A Student-t emission is the obvious extension.
- **Constant duration.** Time in a state is geometric, so the chance of leaving doesn't depend on how long the state \
has lasted.
- **A year of data.** Section 6 shows what that leaves uncertain. The history grows by a day each night.
- **Stored history isn't out of sample.** The chart uses this year's parameters. Each night's row is kept, so a true \
out-of-sample record is building up from the first run.
- **Walk-forward sample.** About 180 test days, overlapping across coins that move together, so these counts are \
descriptive rather than a formal test."""),
        md(REFERENCES_HMM),
    ]


def monte_carlo_notebook() -> list:
    md, code = new_markdown_cell, new_code_cell
    return [
        md("""\
# Monte Carlo price paths

This notebook documents CryptoQuantLab's Monte Carlo engine: three models of daily returns, how paths are drawn and \
checked, how much a given number of paths can be trusted, what the models say about Bitcoin's next 30 days, and \
whether their 10-day VaR held up out of sample. The engine will drive a Scenario tab with fan charts and loss \
distributions; it is not on the site yet.

The engine is [`backend/src/models/monteCarlo.ts`](../../backend/src/models/monteCarlo.ts), with its random numbers \
in [`random.ts`](../../backend/src/models/random.ts). The reference here, \
[`cql_validation/monte_carlo.py`](../cql_validation/monte_carlo.py), draws the same numbers in the same order, so the \
tests compare whole paths: they match to 1e-12, and the generator matches numpy bit for bit.

**The main result is that all three models overstated 10-day risk over the test period, the GARCH bootstrap least.** \
It broke its 95% VaR about three quarters as often as it should have, the normal model about half as often and the \
Student-t less still. About half of all exceptions came in two market-wide falls, so the test has far fewer \
independent observations than its forecast count suggests."""),
        code("""\
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

sys.path.insert(0, str(Path.cwd().parent))
from cql_validation import garch, monte_carlo as mc, returns, var

plt.rcParams.update({"figure.figsize": (9, 3.4), "figure.dpi": 100, "axes.grid": True, "grid.alpha": 0.3})
pd.set_option("display.float_format", lambda x: f"{x:.6g}")

btc = pd.read_csv("../data/bitcoin_usd_daily.csv", parse_dates=["date"])
r = returns.log_returns(btc["price_usd"].to_numpy())
print(f"{len(r)} daily log returns, {btc.date.iloc[1]:%Y-%m-%d} to {btc.date.iloc[-1]:%Y-%m-%d}")"""),
        md(r"""\
## 1. Three models of daily returns

Each model gives daily log returns $r_t$, and a path's price relative after $d$ days is $\exp(\sum_{t \le d} r_t)$.

- **Normal** (geometric Brownian motion): $r_t = \mu + \sigma z_t$ with $z_t \sim N(0, 1)$, the sample mean and \
standard deviation.
- **Student-t:** $r_t = m + s\, t_\nu$, with location, scale and degrees of freedom fitted by maximum likelihood. \
Fat tails, but no volatility clustering.
- **GARCH bootstrap** (filtered historical simulation): the GARCH(1,1) fit of the GARCH notebook, with shocks \
resampled from its standardized residuals rather than assumed normal:

$$r_t = \mu + \sqrt{h_t}\, z_t, \qquad h_{t+1} = \omega + \alpha (r_t - \mu)^2 + \beta h_t, \qquad z_t \in \{\hat z_1, \dots, \hat z_n\}.$$

$h_1$ is the one-step-ahead variance, so paths start at today's volatility and drift towards the long-run level. This \
keeps both the clustering and the empirical tail shape."""),
        code("""\
models = {"normal": mc.gbm(r), "Student-t": mc.student_t(r), "GARCH bootstrap": mc.garch_bootstrap(r)}
g = models["GARCH bootstrap"]
t_model = models["Student-t"]
pd.DataFrame({
    "parameters": [
        f"mu {models['normal'].mu:.5f}, sigma {models['normal'].sigma:.5f}",
        f"location {t_model.location:.5f}, scale {t_model.scale:.5f}, dof {t_model.dof:.3f}",
        f"omega {g.omega:.3g}, alpha {g.alpha:.3f}, beta {g.beta:.3f}",
    ],
    "daily volatility now": [models["normal"].sigma, t_model.scale * np.sqrt(t_model.dof / (t_model.dof - 2)), np.sqrt(g.next_variance)],
    "long-run daily volatility": [models["normal"].sigma, t_model.scale * np.sqrt(t_model.dof / (t_model.dof - 2)), np.sqrt(g.omega / (1 - g.alpha - g.beta))],
}, index=pd.Index(models, name="model"))"""),
        md("""\
The Student-t fit has about 3.4 degrees of freedom: its variance is finite but its fourth moment is not, so very large \
days are far more likely than under the normal. GARCH puts current volatility below its long-run level, so its paths \
start calm and widen.

## 2. Random numbers

The generator is numpy's SFC64, seeded as its author specifies. A uniform is the top 53 bits of an output, as in \
numpy's `Generator.random()`. Normals come from Box-Muller, gamma variables from Marsaglia and Tsang's method, and a \
Student-t from a normal divided by the square root of a scaled chi-square:

$$z = \\sqrt{-2 \\log u_1} \\cos(2 \\pi u_2), \\qquad t_\\nu = z \\Big/ \\sqrt{\\chi^2_\\nu / \\nu}, \\qquad \\chi^2_\\nu = 2\\, \\Gamma(\\nu / 2, 1).$$

The backend's tests check the raw outputs against numpy for three seeds, bit for bit. The cell below checks the \
distributions against scipy with Kolmogorov-Smirnov tests on 50,000 draws each."""),
        code("""\
stream = mc.Stream(2026)
n = 50_000
draws = {
    "uniform": ([stream.uniform() for _ in range(n)], stats.uniform.cdf),
    "normal": ([stream.normal() for _ in range(n)], stats.norm.cdf),
    "gamma, shape 1.7": ([stream.gamma(1.7) for _ in range(n)], lambda x: stats.gamma.cdf(x, 1.7)),
    "gamma, shape 10": ([stream.gamma(10.0) for _ in range(n)], lambda x: stats.gamma.cdf(x, 10.0)),
    f"Student-t, {t_model.dof:.2f} dof": (
        [stream.normal() * np.sqrt(t_model.dof / (2 * stream.gamma(t_model.dof / 2))) for _ in range(n)],
        lambda x: stats.t.cdf(x, t_model.dof),
    ),
}
pd.DataFrame(
    {name: dict(zip(["KS statistic", "p-value"], stats.kstest(x, cdf))) for name, (x, cdf) in draws.items()}
).T"""),
        md("""\
None of the tests rejects at the 5% level. The backend runs the same kind of test against its own validated CDFs, \
and its tests also confirm that at that sample size the test rejects a normal with 5% too much spread and a gamma \
with shape 4.1 instead of 4.

## 3. Checks against closed forms

The normal model's 30-day log return is exactly $N(30\\mu, 30\\sigma^2)$, so its fan has known quantiles. For the \
GARCH bootstrap, the shock is independent of the variance, so $E[e_d^2] = m_2 E[h_d]$ with $m_2$ the residuals' mean \
square, and

$$E[h_{d+1}] = \\omega + (\\alpha m_2 + \\beta)\\, E[h_d].$$

With $m_2 = 1$ this is the usual GARCH variance forecast."""),
        code("""\
days, paths = 30, 20_000
normal_paths = mc.simulate(models["normal"], paths, days, seed=3)
quantiles = [0.05, 0.25, 0.5, 0.75, 0.95]
simulated = np.quantile(np.exp(normal_paths), quantiles, axis=0)
exact = np.exp(np.arange(1, days + 1) * models["normal"].mu + np.sqrt(np.arange(1, days + 1)) * models["normal"].sigma * stats.norm.ppf(quantiles)[:, None])
print(f"normal fan, largest gap to the lognormal quantiles over 30 days: {np.abs(simulated / exact - 1).max():.2%}")

garch_paths = mc.simulate(g, paths, days, seed=5)
shocks = np.diff(np.c_[np.zeros(paths), garch_paths], axis=1) - g.mu
m2 = (g.residuals**2).mean()
expected = [g.next_variance]
for _ in range(days - 1):
    expected.append(g.omega + (g.alpha * m2 + g.beta) * expected[-1])
standard_error = (shocks**2).std(axis=0, ddof=1) / np.sqrt(paths)
fit = garch.fit_log_returns(r)
pd.DataFrame({
    "simulated E[e^2]": (shocks**2).mean(axis=0),
    "m2 E[h]": m2 * np.array(expected),
    "gap in standard errors": ((shocks**2).mean(axis=0) - m2 * np.array(expected)) / standard_error,
    "GARCH forecast (m2 = 1)": [garch.forecast_variance(fit, d) for d in range(1, days + 1)],
}, index=pd.Index(range(1, days + 1), name="day")).iloc[[0, 1, 4, 9, 19, 29]]"""),
        md("""\
The simulated lognormal fan is within sampling error of the exact quantiles, and the simulated GARCH variances follow \
the recursion within a few standard errors on every day. The residuals' mean square is slightly below 1, so the \
bootstrap's variance sits slightly below the textbook forecast.

## 4. How many paths, and do antithetic pairs help?

Each antithetic pair shares its draws, mirrored, so a pair's errors offset. The cell repeats each simulation 100 \
times with 1,000 paths and measures how much the estimates vary between runs."""),
        code("""\
def spread(model, antithetic, runs=100, paths=1000, days=30):
    rows = []
    for seed in range(runs):
        s = mc.summarize(mc.simulate(model, paths, days, 1000 + seed, antithetic), antithetic, [0.5], 0.05, [])
        rows.append([s["mean"], s["valueAtRisk"], s["expectedShortfall"]])
    return np.std(rows, axis=0, ddof=1)

variance_ratio = {}
for name, model in models.items():
    variance_ratio[name] = (spread(model, False) / spread(model, True)) ** 2
pd.DataFrame(variance_ratio, index=["mean return", "95% VaR", "95% ES"]).rename_axis("variance without pairs / with pairs")"""),
        md("""\
**Antithetic pairs make the mean far more precise but don't help the tail.** The mean is a linear average, so a path \
and its mirror cancel each other's noise. VaR and ES depend only on the worst paths, and a bad path's mirror is a \
good one, which tells the estimate nothing about the tail. So the Scenario tab's tail figures need more paths, not \
pairs. Their error falls as $1/\\sqrt{N}$:"""),
        code("""\
rng = np.random.default_rng(1)
precision = {}
for paths in (1000, 4000, 16000):
    estimates = [var.historical(np.exp(mc.simulate_horizon(g, paths, 30, rng)) - 1, 0.05)[0] for _ in range(100)]
    precision[paths] = {"95% VaR, mean": np.mean(estimates), "standard deviation between runs": np.std(estimates, ddof=1)}
pd.DataFrame(precision).T.rename_axis("paths")"""),
        md("""\
Quadrupling the paths roughly halves the error, as expected. With 10,000 paths, a 30-day 95% VaR is known to within \
about a quarter of a percentage point.

## 5. Bitcoin over the next 30 days"""),
        code("""\
fig, axes = plt.subplots(1, 3, figsize=(10, 3.2), sharey=True)
rows = {}
for ax, (name, model) in zip(axes, models.items()):
    x = mc.simulate(model, 10_000, 30, seed=1, antithetic=True)
    s95 = mc.summarize(x, True, [0.05, 0.25, 0.5, 0.75, 0.95], 0.05, [0.2, 0.3])
    s99 = mc.summarize(x, True, [0.5], 0.01, [])
    fan = np.array(s95["fan"])
    day = np.arange(1, 31)
    ax.fill_between(day, fan[:, 0], fan[:, 4], alpha=0.25, color="tab:blue", label="5–95%")
    ax.fill_between(day, fan[:, 1], fan[:, 3], alpha=0.4, color="tab:blue", label="25–75%")
    ax.plot(day, fan[:, 2], color="tab:blue", lw=1)
    ax.set_title(name)
    ax.set_xlabel("day")
    rows[name] = {
        "95% VaR": s95["valueAtRisk"], "95% ES": s95["expectedShortfall"],
        "99% VaR": s99["valueAtRisk"], "99% ES": s99["expectedShortfall"],
        "P(drawdown >= 20%)": s95["drawdownProbabilities"][0], "P(drawdown >= 30%)": s95["drawdownProbabilities"][1],
    }
axes[0].set_ylabel("price relative")
axes[0].legend(loc="lower left")
plt.tight_layout()
plt.show()
pd.DataFrame(rows).T.map(lambda v: f"{v:.1%}")"""),
        md("""\
The models nearly agree at 95% and part in the far tail. At 99% the two fat-tailed models put expected shortfall \
around 34%, against about 29% for the normal, and they make a 30% drawdown within the month about twice as likely. \
GARCH's fan starts narrower than the others, because current volatility is below its long-run level.

## 6. Did 10-day VaR hold out of sample?

[`scripts/monte_carlo_cross_section.py`](../scripts/monte_carlo_cross_section.py) refits each model on every stored \
coin's previous 180 returns, simulates 10 days ahead with 5,000 paths, and counts how often the realized loss beat \
VaR. Periods don't overlap. Each model also runs with zero drift, a common choice for risk because a window's mean \
return is mostly noise. Only coins with daily volatility of at least 0.5% are counted, which removes stablecoins and \
tokenized funds."""),
        code("""\
cross_section = pd.read_csv("../data/monte_carlo_cross_section.csv")
coins = cross_section[cross_section.daily_volatility >= 0.005]
forecasts = coins.forecasts.sum()
names = {"gbm": "normal", "student_t": "Student-t", "garch_bootstrap": "GARCH bootstrap"}

rows = {}
for stem, name in names.items():
    for drift, label in (("", "window mean"), ("_zero_drift", "zero")):
        row = {}
        for level, alpha in (("95", 0.05), ("99", 0.01)):
            exceptions = coins[f"{stem}{drift}_exceptions_{level}"]
            count = int(exceptions.sum())
            hits = [True] * count + [False] * (forecasts - count)
            row[f"{level}% exceptions"] = count / forecasts
            row[f"{level}% Kupiec p"] = var.kupiec(hits, alpha)[1]
            row[f"{level}% loss / ES"] = (coins[f"{stem}{drift}_es_ratio_{level}"].fillna(0) * exceptions).sum() / count
        rows[(name, label)] = row
print(f"{len(coins)} coins, {forecasts} forecasts per model; nominal rates 5% and 1%")
pd.DataFrame(rows).T.rename_axis(["model", "drift"])"""),
        md("""\
Read with section 7's caveat, three things stand out:

- **Every model was conservative, and the GARCH bootstrap least.** It broke 95% VaR on about 3.8% of forecasts and \
99% VaR on 0.6–0.9%. The normal model broke 95% VaR about half as often as it should, and the Student-t less still: \
over this period its heavy tails cost more than they gave.
- **Expected shortfall was about right.** When VaR was broken, the average loss was roughly the ES the model \
predicted, the "loss / ES" columns.
- **Drift changes little.** Setting it to zero moves the rates by under a percentage point, and not in the same \
direction for every model.

The Kupiec p-values assume independent exceptions, which these are not, as the next cell shows."""),
        code("""\
periods = pd.read_csv("../data/monte_carlo_periods.csv", parse_dates=["date"])
periods = periods[periods.coins >= 10]
fig, ax = plt.subplots()
ax.bar(periods.date, periods.garch_bootstrap_exceptions_95 / periods.coins, width=6, color="tab:orange", label="GARCH bootstrap")
ax.bar(periods.date, periods.gbm_exceptions_95 / periods.coins, width=3, color="tab:blue", label="normal")
ax.axhline(0.05, color="0.3", lw=0.8, ls="--", label="nominal 5%")
ax.set_ylabel("share of coins breaking 95% VaR")
ax.set_xlabel("start of the 10-day period")
ax.legend()
plt.show()

top_two = periods.garch_bootstrap_exceptions_95.nlargest(2).sum()
print(f"{len(periods)} common periods; the two worst hold {top_two} of {periods.garch_bootstrap_exceptions_95.sum()} GARCH bootstrap exceptions")"""),
        md("""\
Exceptions come in waves. Crypto coins fall together, so in most 10-day periods almost no coin broke its VaR, and in \
the two market-wide falls 14–20% of coins did. The test therefore has about 18 independent periods rather than 1,467 \
forecasts, and the pooled p-values overstate how sure we can be. A longer history, or a joint model of coins, is \
needed to separate the models properly.

## 7. Limitations

- **One path at a time.** Each coin is simulated alone. A portfolio needs joint paths with correlated shocks, which \
the Scenario tab will need for more than one holding.
- **Parameters are fixed.** Each simulation uses one fitted model and ignores the uncertainty in its parameters, \
which makes the fan too narrow, more so for long horizons.
- **A year of residuals.** The bootstrap can only replay shocks from the past year; a crash larger than any in the \
window can't appear, except through a high variance.
- **A short test.** Six months, with two market-wide falls, so the out-of-sample counts are descriptive rather than a \
formal comparison of the models.
- **Monte Carlo noise in the test.** With 5,000 paths a VaR estimate moves by a few tenths of a percentage point \
between runs, enough to flip borderline exceptions."""),
        md(REFERENCES_MONTE_CARLO),
    ]


def portfolio_notebook() -> list:
    md, code = new_markdown_cell, new_code_cell
    return [
        md("""\
# Covariance shrinkage and long-only portfolios

This notebook documents CryptoQuantLab's portfolio construction: two Ledoit-Wolf covariance estimates, \
minimum-variance and risk-parity portfolios, the efficient frontier, how each is computed and checked, and how they \
did out of sample on the 20 largest coins. They will drive a portfolio page; they are not on the site yet.

The models are [`covariance.ts`](../../backend/src/models/covariance.ts) and \
[`portfolio.ts`](../../backend/src/models/portfolio.ts). The reference, \
[`cql_validation/portfolio.py`](../cql_validation/portfolio.py), uses scipy's optimizers rather than the backend's \
method, and its covariance estimates are checked against scikit-learn and PyPortfolioOpt.

**The main result is that minimum variance cut realized volatility by about 30–40% against a cap-weighted portfolio, \
but by holding the equivalent of two to five coins, and its most concentrated versions understated their own risk by a \
quarter or more.** Which covariance estimate it used mattered little on real coins. In simulation, shrinking towards a \
constant correlation helped and shrinking towards the identity hurt. Optimizing on estimated returns always gave the \
riskiest portfolio."""),
        code("""\
import json
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pypfopt import risk_models
from sklearn.covariance import LedoitWolf

sys.path.insert(0, str(Path.cwd().parent))
from cql_validation import portfolio as pf

plt.rcParams.update({"figure.figsize": (9, 3.4), "figure.dpi": 100, "axes.grid": True, "grid.alpha": 0.3})
pd.set_option("display.float_format", lambda x: f"{x:.6g}")

def load(name):
    return np.array(json.loads(Path(f"../../backend/src/test/fixtures/portfolio/{name}.json").read_text())["returns"])

r, wide = load("factor_250x12"), load("wide_40x30")
print(f"simulated two-factor returns: {r.shape[0]} days by {r.shape[1]} assets, and {wide.shape[0]} days by {wide.shape[1]} assets")"""),
        md(r"""\
## 1. Shrinking the covariance

With $p$ assets and $n$ days, the sample covariance estimates $p(p+1)/2$ numbers. When $n$ is not much larger than \
$p$ its extreme eigenvalues are too spread out, and an optimizer leans hardest on exactly the directions that look \
safest by chance. With $n \le p$ it is singular.

Ledoit and Wolf shrink the maximum-likelihood covariance $S$ towards a structured target $F$,

$$\hat\Sigma = \delta F + (1 - \delta) S,$$

with the intensity $\delta$ estimated to minimize expected squared error. Two targets are implemented:

- **Identity** (Ledoit and Wolf, 2004a): $F = \mu I$ with $\mu$ the average variance. It pulls every correlation \
towards zero. This is scikit-learn's `LedoitWolf`.
- **Constant correlation** (Ledoit and Wolf, 2004b): $F_{ii} = s_{ii}$ and $F_{ij} = \bar r \sqrt{s_{ii} s_{jj}}$, \
with $\bar r$ the average sample correlation. It keeps every variance and the common correlation, and only evens out \
the pairwise differences. PyPortfolioOpt implements it, dividing $S$ by $n - 1$ where the authors divide by $n$; the \
check below gives it the authors' convention."""),
        code("""\
def checks(x):
    identity, identity_shrinkage = pf.ledoit_wolf(x)
    correlated, correlated_shrinkage = pf.constant_correlation(x)
    other = risk_models.CovarianceShrinkage(pd.DataFrame(x), returns_data=True, frequency=1)
    other.S = (x - x.mean(axis=0)).T @ (x - x.mean(axis=0)) / len(x)
    return {
        "identity shrinkage": identity_shrinkage,
        "gap to scikit-learn": np.abs(identity - LedoitWolf().fit(x).covariance_).max() / np.abs(identity).max(),
        "constant-correlation shrinkage": correlated_shrinkage,
        "gap to PyPortfolioOpt": np.abs(correlated - other._ledoit_wolf_constant_correlation()[0]).max() / np.abs(correlated).max(),
        "sample condition number": np.linalg.cond(pf.sample_covariance(x)),
        "identity condition number": np.linalg.cond(identity),
        "constant-correlation condition number": np.linalg.cond(correlated),
    }

pd.DataFrame({"250 days, 12 assets": checks(r), "40 days, 30 assets": checks(wide)})"""),
        md("""\
Both estimates match their libraries to rounding. With 30 assets and 40 days the sample covariance is singular, its \
condition number limited only by rounding, and either shrinkage makes it usable.

Which estimate gives the best portfolio? The next cell draws returns from a known two-factor covariance, like crypto's \
strong common moves, and measures the true variance of the minimum-variance portfolio built from each estimate, as a \
percentage above the best possible."""),
        code("""\
rng = np.random.default_rng(7)
p = 20
loadings = rng.uniform(0.5, 1.5, (2, p))
true_cov = loadings.T @ np.diag([0.03**2, 0.015**2]) @ loadings + np.diag(rng.uniform(0.005, 0.04, p) ** 2)
best = pf.portfolio_variance(pf.minimum_variance(true_cov), true_cov)
chol = np.linalg.cholesky(true_cov)
estimators = {
    "sample": lambda x: pf.sample_covariance(x),
    "identity": lambda x: pf.ledoit_wolf(x)[0],
    "constant correlation": lambda x: pf.constant_correlation(x)[0],
}

rows = {}
for n in (30, 60, 90, 180, 365):
    excess = {name: [] for name in estimators}
    for _ in range(40):
        x = rng.standard_normal((n, p)) @ chol.T
        for name, estimate in estimators.items():
            excess[name].append(pf.portfolio_variance(pf.minimum_variance(estimate(x)), true_cov) / best - 1)
    rows[n] = {f"excess variance, {name}": np.mean(v) for name, v in excess.items()}
pd.DataFrame(rows).T.rename_axis(f"days ({p} assets)").map(lambda v: f"{v:.1%}")"""),
        md("""\
**Shrinking towards the identity made the portfolio worse than no shrinkage at every window length**, and shrinking \
towards a constant correlation roughly halved the sample covariance's excess. With strongly correlated assets, the \
identity target pulls correlations towards zero, so the optimizer sees diversification that isn't there. The \
long-only constraint already does part of the regularizing (Jagannathan and Ma, 2003), which is why the sample \
covariance does reasonably well on its own.

## 2. Long-only portfolios

All portfolios here are fully invested and long-only: $w \\ge 0$, $\\sum_i w_i = 1$.

- **Minimum variance** minimizes $w' \\Sigma w$. At the optimum every held asset has the same marginal variance \
$(\\Sigma w)_i$, and every asset left out has at least as much. The backend uses the primal active-set method \
(Nocedal and Wright, Algorithm 16.3), and the tests check those conditions to 1e-12.
- **Risk parity** gives each asset an equal share of variance, $w_i (\\Sigma w)_i = w'\\Sigma w / n$. Spinu (2013) \
shows this is the minimizer of the convex $\\tfrac12 y'\\Sigma y - \\tfrac1n \\sum_i \\log y_i$ after scaling $y$ to \
sum to 1, so Newton's method finds it reliably.
- **The efficient frontier** is the minimum variance at each target return. The backend finds each point by minimizing \
$\\tfrac12 w'\\Sigma w - t\\, \\mu' w$ and bisecting on $t$, since the portfolio's return rises continuously with $t$.

The reference instead runs scipy's SLSQP, then solves the optimality conditions exactly on the assets SLSQP holds and \
checks them, so the two implementations agree only if both find the true optimum."""),
        code("""\
cov = pf.constant_correlation(r)[0]
mean = r.mean(axis=0)
frontier = pf.efficient_frontier(cov, mean, 25)
marked = {
    "equal weight": np.full(len(mean), 1 / len(mean)),
    "minimum variance": pf.minimum_variance(cov),
    "risk parity": pf.risk_parity(cov),
    "highest Sharpe": max(frontier, key=lambda w: (w @ mean) / np.sqrt(w @ cov @ w)),
}
fig, ax = plt.subplots()
ax.plot([np.sqrt(w @ cov @ w) for w in frontier], [w @ mean for w in frontier], color="0.3", lw=1, label="long-only frontier")
ax.scatter(np.sqrt(np.diag(cov)), mean, s=12, color="0.6", label="single assets")
for name, w in marked.items():
    ax.scatter(np.sqrt(w @ cov @ w), w @ mean, s=40, label=name)
ax.set_xlabel("daily volatility")
ax.set_ylabel("daily mean return")
ax.legend(fontsize=8)
plt.show()

pd.DataFrame({
    name: {"assets held": int((w > 1e-12).sum()), "largest weight": w.max(), "largest risk share": pf.risk_contributions(w, cov).max(), "smallest risk share": pf.risk_contributions(w, cov).min()}
    for name, w in marked.items()
}).T"""),
        md("""\
Minimum variance holds a few assets and gives them very unequal shares of risk. Risk parity holds everything with \
equal risk shares. The highest-Sharpe point depends entirely on the estimated means, which is the problem the backtest \
shows.

## 3. Out of sample on the 20 largest coins

[`scripts/portfolio_backtest.py`](../scripts/portfolio_backtest.py) rebalances every 30 days. At each rebalance it \
takes the 20 largest coins by market cap whose daily volatility over the estimation window is at least 0.5%, which \
removes stablecoins and tokenized funds, sets each strategy's weights from that window, and holds without trading \
until the next rebalance. Minimum variance runs on each of the three covariance estimates; risk parity, the \
highest-Sharpe portfolio and the risk forecasts of the simple weightings use constant-correlation shrinkage. Every \
combination of a 90 or 180-day window and three starting offsets covers the same test days, from late April to early \
November 2026."""),
        code("""\
summary = pd.read_csv("../data/portfolio_backtest_summary.csv")
periods = pd.read_csv("../data/portfolio_backtest_periods.csv")
names = {
    "cap_weight": "cap-weighted", "equal_weight": "equal weight", "inverse_volatility": "inverse volatility",
    "min_variance_sample": "minimum variance, sample", "min_variance_identity": "minimum variance, identity",
    "min_variance_constant_correlation": "minimum variance, constant correlation",
    "risk_parity": "risk parity", "max_sharpe": "highest Sharpe",
}
columns = {
    "annualized_volatility": "annualized volatility", "max_drawdown": "max drawdown", "total_return": "return",
    "mean_turnover": "turnover per rebalance", "mean_effective_holdings": "effective holdings",
    "realized_over_forecast_volatility": "realized / forecast volatility",
}

def table(universe):
    frame = summary[summary.universe == universe].groupby("strategy")[list(columns)].mean()
    largest = periods[periods.universe == universe].groupby("strategy").largest_weight.mean().rename("largest weight")
    return frame.join(largest).rename(index=names, columns=columns).sort_values("annualized volatility")

print(f"{summary.days.iloc[0]} test days; averages over 6 schedules")
print(periods.groupby("window")[["identity_shrinkage", "constant_correlation_shrinkage"]].mean().rename_axis("window, mean shrinkage"))
table("top_20")"""),
        md("""\
Averaged over the six schedules:

- **Minimum variance had the lowest volatility by far,** about 22% a year against 38% for cap-weighted and 45% for \
equal weight, and the smallest drawdown, whichever covariance it used. It did so by holding the equivalent of two to \
four coins.
- **Concentrated portfolios understated their own risk.** On the sample and constant-correlation estimates, minimum \
variance's realized volatility was 25–31% above its own forecast. The identity estimate spread the weights more \
and forecast its risk accurately.
- **The highest-Sharpe portfolio was the riskiest,** with the deepest drawdown and about half the portfolio traded \
each month.
- **Risk parity sat in between,** below every simple weighting on volatility while holding all 20 coins.

Returns are shown for completeness: over six months, they say almost nothing about which strategy is better.

### Is it one coin?

Minimum variance put most of the portfolio into TRON, the least volatile large coin over the period. The same \
backtest without TRON:"""),
        code("""\
table("top_20_without_tron")"""),
        md("""\
Without TRON, minimum variance still has the lowest volatility, 26–28% against 39% for cap-weighted, so the result \
isn't one coin. The covariance estimates now separate a little, in the order the simulation predicts: constant \
correlation lowest and identity highest, about two percentage points apart. Risk parity is now slightly above \
cap-weighted, though still below equal weight and inverse volatility. The highest-Sharpe portfolio had the best \
return here and a middling one with TRON, which is what noise looks like.

The schedules agree closely, so these averages aren't one lucky start date:"""),
        code("""\
grid = summary.pivot_table(index=["universe", "strategy"], columns=["window", "offset"], values="annualized_volatility")
grid.rename(index=names).map(lambda v: f"{v:.1%}")"""),
        md("""\
## 4. What this means for the portfolio page

- **Use constant-correlation shrinkage.** It was best in simulation, about as good as the others on real coins and \
best without TRON, and it works when a user holds more coins than there are days of shared history. The identity target, the common default, \
is the wrong one for assets that move together this much.
- **Cap the weights.** Minimum variance's lower risk is real here, but it comes from very few holdings, and those \
portfolios underestimated their risk. A maximum weight per coin is the usual fix and isn't implemented yet. Until then, \
the page should show weights and each coin's share of risk next to the volatility.
- **Don't recommend the highest-Sharpe portfolio.** Show the frontier as what the past year's averages imply, not as \
advice.
- **Risk parity is the diversified option,** holding every coin with less risk than equal weight or inverse \
volatility, and about the same as cap-weighted.

## 5. Limitations

- **Survivorship.** The coins come from today's top 100, so coins that fell out of the top 20 and then out of the top \
100 are missing from earlier rebalances.
- **A short test.** About six months and seven rebalances, with no transaction costs; turnover is reported instead.
- **Long-only and fully invested.** No cash, no leverage and no shorting, which matches what most holders can do.
- **Daily closes at 00:00 UTC.** Correlations from daily closes understate how assets that trade around the clock \
move together within a day."""),
        md(REFERENCES_PORTFOLIO),
    ]


def backtest_notebook() -> list:
    md, code = new_markdown_cell, new_code_cell
    return [
        md("""\
# Backtesting signals without fooling ourselves

This notebook documents CryptoQuantLab's backtest engine: costed returns from a signal's positions, walk-forward \
selection, and the probabilistic and deflated Sharpe ratios that say how much a backtest's best result is worth after \
trying several variants. It then applies them to the moving-average crossovers the site's alerts already use, on every \
coin with a year of history. The Signals tab will be built on these; it is not on the site yet.

The models are [`signals.ts`](../../backend/src/models/signals.ts), \
[`backtest.ts`](../../backend/src/models/backtest.ts) and \
[`sharpeInference.ts`](../../backend/src/models/sharpeInference.ts). The reference is \
[`cql_validation/backtest.py`](../cql_validation/backtest.py); it is checked against pandas and against the numerical \
example in Bailey and López de Prado (2014), and the backend matches it to 1e-12 or better.

**The main result is that the crossovers show no timing skill.** The best of 15 crossovers looked significant on \
about 9% of coins by the usual test, and on 7% after deflating for the variants tried, but those were coins that \
rose anyway. Tested against the same coin's returns in shuffled order, only one coin in 70 beat chance at the 5% \
level, fewer than chance alone would give. Out of sample, the walk-forward crossover about matched holding the coin \
before costs while spending half its time out of the market, and fell slightly behind it after costs."""),
        code("""\
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

sys.path.insert(0, str(Path.cwd().parent))
from cql_validation import backtest as bt

plt.rcParams.update({"figure.figsize": (9, 3.4), "figure.dpi": 100, "axes.grid": True, "grid.alpha": 0.3})
pd.set_option("display.float_format", lambda x: f"{x:.6g}")

btc = pd.read_csv("../data/bitcoin_usd_daily.csv", parse_dates=["date"])
prices = btc["price_usd"].to_numpy()
dates = btc["date"]
annual = np.sqrt(365.25)
grid = [(s, l) for s in (1, 5, 10, 20) for l in (20, 30, 50, 100) if s < l]
start = 99
print(f"{len(prices)} Bitcoin daily closes, {dates.iloc[0]:%Y-%m-%d} to {dates.iloc[-1]:%Y-%m-%d}; {len(grid)} crossovers")"""),
        md(r"""\
## 1. Costed returns

A signal produces a position $w_t \in [0, 1]$ from closes up to day $t$, held until the next close. Trades happen at \
the close and cost a fraction $c$ of the value traded, fee plus slippage, charged in the period the new position is \
first held:

$$r^{net}_{t+1} = w_t R_{t+1} - c\, |w_t - w_{t-1}|, \qquad w_{-1} = 0.$$

Using the close the signal was computed on is optimistic by however far the price moves while the order fills. A \
crossover is long while the short simple moving average is above the long one and flat otherwise; a short period of \
1 compares the price with its average. Shorts aren't modelled, since most holders can't short spot coins. The default \
cost is 15 basis points a trade, fee plus slippage. Many retail accounts pay more, so 30 is a check, with 0 for \
comparison.

The cell checks the reference against pandas computing the same thing a second way, and plots one crossover on \
Bitcoin."""),
        code("""\
cost = 0.0015
positions = bt.crossover_positions(prices, 1, 20)
net = bt.strategy_returns(prices, positions, cost)
held = pd.Series(positions).shift(1).fillna(0)
library = (held * pd.Series(prices).pct_change() - cost * held.diff().abs().fillna(held)).to_numpy()[1:]
print(f"largest gap to pandas: {np.abs(net - library).max():.1e}")
print(f"trades: {int(np.abs(np.diff(positions)).sum())}, time in the market: {positions[start:].mean():.0%}")

days = dates.iloc[start + 1:]
fig, ax = plt.subplots()
ax.plot(days, np.cumprod(1 + (prices[1:] / prices[:-1] - 1)[start:]), label="hold", color="0.5")
ax.plot(days, np.cumprod(1 + bt.strategy_returns(prices, positions, 0)[start:]), label="price vs 20-day average, no costs")
ax.plot(days, np.cumprod(1 + net[start:]), label="the same, 15 bp a trade")
ax.set_ylabel("growth of 1")
ax.legend(fontsize=8)
plt.show()"""),
        md(r"""\
## 2. How much is the best backtest worth?

The Sharpe ratio $\widehat{SR}$ of $T$ daily returns is an estimate with standard error of about $1/\sqrt{T}$: a \
daily Sharpe ratio of 0.05, 0.95 a year, from a year of data is within one standard error of zero. Two corrections \
make it usable as evidence.

**The probabilistic Sharpe ratio** (Bailey and López de Prado, 2012) is the probability that the true Sharpe ratio \
exceeds a benchmark $SR^*$, allowing for skewed, fat-tailed returns (Lo, 2002):

$$PSR(SR^*) = \Phi\left(\frac{(\widehat{SR} - SR^*)\sqrt{T - 1}}{\sqrt{1 - \hat\gamma_3 \widehat{SR} + \tfrac{\hat\gamma_4 - 1}{4}\widehat{SR}^2}}\right),$$

with $\hat\gamma_3$ the skewness and $\hat\gamma_4$ the kurtosis (3 for a normal distribution) of the returns, and \
Sharpe ratios per period, not annualized.

**The deflated Sharpe ratio** (Bailey and López de Prado, 2014) raises the benchmark to the Sharpe ratio expected from \
the best of $N$ independent trials with no skill,

$$SR_0 = \sqrt{V}\left((1 - \gamma)\,\Phi^{-1}\left(1 - \tfrac1N\right) + \gamma\, \Phi^{-1}\left(1 - \tfrac{1}{N e}\right)\right), \qquad DSR = PSR(SR_0),$$

where $V$ is the variance of the trials' Sharpe ratios and $\gamma$ is Euler's constant. Crossovers with nearby \
periods are nearly the same strategy, so 15 of them are not 15 independent trials. The paper's Appendix A.3 counts \
$M$ trials with average pairwise correlation $\bar\rho$ as $\hat N = \bar\rho + (1 - \bar\rho) M$ independent ones.

The paper's numerical example: 100 trials, annualized Sharpe ratio 2.5 and variance 1/2 across trials, 1,250 daily \
returns with skewness −3 and kurtosis 10. It reports $SR_0 = 0.1132$ and $DSR = 0.9004$, and 0.9505 had there been 46 \
trials."""),
        code("""\
def psr_from_moments(sr, benchmark, t, skew, kurt):
    return stats.norm.cdf((sr - benchmark) * np.sqrt(t - 1) / np.sqrt(1 - skew * sr + (kurt - 1) / 4 * sr**2))

sr, variance = 2.5 / np.sqrt(250), 0.5 / 250
pd.DataFrame({
    "published": [0.1132, 0.9004, 0.9505],
    "reference": [
        bt.expected_maximum_sharpe(100, variance),
        psr_from_moments(sr, bt.expected_maximum_sharpe(100, variance), 1250, -3, 10),
        psr_from_moments(sr, bt.expected_maximum_sharpe(46, variance), 1250, -3, 10),
    ],
}, index=["SR0, 100 trials", "DSR, 100 trials", "DSR, 46 trials"])"""),
        md("""\
Applied to the 15 crossovers on Bitcoin's 264 daily returns after the 100-day average exists:"""),
        code("""\
evaluated = [bt.strategy_returns(prices, bt.crossover_positions(prices, s, l), cost)[start:] for s, l in grid]
sharpes = np.array([bt.sharpe(r) for r in evaluated])
best = int(np.argmax(sharpes))
implied = bt.implied_trials(np.array(evaluated))
pd.Series({
    "best crossover": "{}/{}".format(*grid[best]),
    "annualized Sharpe ratio": sharpes[best] * annual,
    "PSR against 0": bt.probabilistic_sharpe(evaluated[best], 0),
    "DSR, 15 trials": bt.deflated_sharpe(evaluated[best], sharpes),
    "implied independent trials": implied,
    "DSR, implied trials": bt.deflated_sharpe(evaluated[best], sharpes, implied),
}).to_frame("Bitcoin")"""),
        md("""\
On Bitcoin the price-versus-20-day crossover ended well ahead of holding, as the chart above shows, but after \
deflating for the variants tried, a probability of about 0.64 that its Sharpe ratio is really above zero is weak \
evidence.

### Are the tests calibrated?

A test that passes at 0.95 should pass about 5% of the time when nothing is there. The next cell checks this with \
pure noise: $N$ independent strategies of 278 fat-tailed daily returns, as many as each coin has below, (Student-t, 4 degrees of freedom) with a true \
Sharpe ratio of zero, keeping the best."""),
        code("""\
rng = np.random.default_rng(1)
rows = {}
for n in (1, 5, 15, 50):
    psr, dsr = [], []
    for _ in range(2000):
        x = rng.standard_t(4, (n, 278)) * 0.03
        s = np.array([bt.sharpe(r) for r in x])
        b = int(np.argmax(s))
        psr.append(bt.probabilistic_sharpe(x[b], 0))
        dsr.append(bt.deflated_sharpe(x[b], s))
    rows[n] = {"PSR > 0.95": np.mean(np.array(psr) > 0.95), "DSR > 0.95": np.mean(np.array(dsr) > 0.95)}
pd.DataFrame(rows).T.rename_axis("independent trials").map(lambda v: f"{v:.2%}")"""),
        md("""\
With one trial both pass about 5% of the time, a little more because of the fat tails. **Keeping the best of 15 \
undeflated passes more than half the time.** The deflated Sharpe ratio fixes that and overshoots: it passes almost \
never, because $SR_0$ is the *expected* best of $N$, not a high percentile of it, so beating it by 1.645 standard \
errors is far rarer than 5%. DSR is a conservative test rather than an exact one.

Crossovers are not independent trials. [`scripts/crossover_backtest.py`](../scripts/crossover_backtest.py) ran the \
15-crossover search 20 times on each coin's own returns in shuffled order with the mean removed, at 15 bp, so there \
was nothing to earn:"""),
        code("""\
null = pd.read_csv("../data/crossover_backtest_null.csv")
coins = pd.read_csv("../data/crossover_backtest_coins.csv")
print(f"{len(null)} searches on {null.coin.nunique()} coins; median implied trials {null.implied_trials.median():.1f}")
pd.Series({
    "PSR > 0.95": np.mean(null.psr > 0.95),
    "DSR > 0.95, 15 trials": np.mean(null.dsr > 0.95),
    "DSR > 0.95, implied trials": np.mean(null.dsr_implied > 0.95),
}).map(lambda v: f"{v:.1%}").to_frame("passed on shuffled prices")"""),
        md("""\
The undeflated test passes the best crossover two to three times as often as it should. Deflating for all 15 \
overcorrects, and the implied number of trials, about 4, lands closer to 5% while staying conservative.

## 3. Crossovers on 70 coins

Every coin with 378 days of history and daily volatility of at least 0.5%, which leaves out stablecoins, from \
October 2025 to November 2026. Each is tested on the 278 daily returns after the 100-day average exists."""),
        code("""\
costs = ["0bp", "15bp", "30bp"]
pd.DataFrame({
    tag: {
        "PSR > 0.95": np.mean(coins[f"psr_{tag}"] > 0.95),
        "DSR > 0.95, 15 trials": np.mean(coins[f"dsr_{tag}"] > 0.95),
        "DSR > 0.95, implied trials": np.mean(coins[f"dsr_implied_{tag}"] > 0.95),
        "median best Sharpe, annualized": coins[f"in_sample_sharpe_{tag}"].median(),
    }
    for tag in costs
}).map(lambda v: f"{v:.2f}" if v > 0.3 else f"{v:.1%}")"""),
        md("""\
Five coins pass the deflated test at 15 bp, a little more than the 2.6% false-positive rate above would give \
by chance (about two coins). But DSR asks whether the Sharpe ratio is above zero, not whether the timing helped. A \
long-or-flat strategy on a coin that rose steadily has a positive Sharpe ratio without timing anything.

The direct test of timing keeps each coin's trend and shuffles only the order of its returns, 200 times, rerunning \
the whole 15-crossover search each time. The p-value is the share of shuffles whose best Sharpe ratio is at least \
the real one: a permutation test in the spirit of White's (2000) reality check."""),
        code("""\
passed = coins[coins.dsr_implied_15bp > 0.95]
print(passed[["coin", "best_15bp", "in_sample_sharpe_15bp", "hold_in_sample_sharpe", "dsr_implied_15bp", "timing_p_value"]]
      .rename(columns={"best_15bp": "best", "in_sample_sharpe_15bp": "crossover Sharpe", "hold_in_sample_sharpe": "holding Sharpe",
                       "dsr_implied_15bp": "DSR, implied", "timing_p_value": "timing p-value"}).to_string(index=False))
print()
print(f"timing p-value below 0.05: {(coins.timing_p_value < 0.05).sum()} of {len(coins)} coins; below 0.10: {(coins.timing_p_value < 0.10).sum()}")

fig, ax = plt.subplots()
ax.hist(coins.timing_p_value, bins=np.linspace(0, 1, 21), color="0.5")
ax.axhline(len(coins) / 20, color="k", lw=1, ls="--", label="expected with no timing skill")
ax.set_xlabel("timing p-value, 15 bp")
ax.set_ylabel("coins")
ax.legend(fontsize=8)
plt.show()"""),
        md("""\
For JUST and Venice the best crossover's Sharpe ratio is the same as holding the coin: they pass because the coins \
rose. Only GateChain's timing p-value is below 0.05, one coin where chance alone would give three or four. Five \
p-values fall below 0.1 and one above 0.9, where an even spread would put about seven in each. The coins move \
together, so the 70 tests aren't independent, and the shuffle also removes volatility clustering, so the shape says \
little; what matters is that there is no cluster of small p-values.

## 4. Walk-forward

Choosing the best crossover over the whole year and reporting its Sharpe ratio uses the same data twice. Walk-forward \
selection trains on 120 days, holds the best crossover for the next 30, and moves on, so every reported day is out of \
sample, and switching between crossovers pays its trading cost. The comparison is holding the coin over the same \
158 test days, paying the same cost to buy in."""),
        code("""\
pd.DataFrame({
    tag: {
        "median best Sharpe, in sample": coins[f"in_sample_sharpe_{tag}"].median(),
        "median walk-forward Sharpe": coins[f"walk_forward_sharpe_{tag}"].median(),
        "median holding Sharpe": coins.hold_sharpe.median(),
        "walk-forward beats holding": np.mean(coins[f"walk_forward_sharpe_{tag}"] > coins.hold_sharpe),
        "median time in the market": coins[f"walk_forward_exposure_{tag}"].median(),
        "median crossover switches": coins[f"walk_forward_switches_{tag}"].median(),
    }
    for tag in costs
})"""),
        code("""\
fig, ax = plt.subplots(figsize=(5, 4.5))
ax.scatter(coins.hold_sharpe, coins.walk_forward_sharpe_15bp, s=14)
lims = [min(ax.get_xlim()[0], ax.get_ylim()[0]), max(ax.get_xlim()[1], ax.get_ylim()[1])]
ax.plot(lims, lims, color="k", lw=1, ls="--")
ax.set_xlabel("holding, annualized Sharpe")
ax.set_ylabel("walk-forward crossover, 15 bp")
plt.show()"""),
        md("""\
The best in-sample Sharpe ratio roughly halves out of sample, as selection bias predicts, even though holding did \
better on the test days than over the whole year. The walk-forward crossover beat holding on 57% of coins with no \
costs, 53% at 15 bp and 47% at 30 bp, while spending about half its time out of the market. On these days that is a similar Sharpe ratio with less exposure, not an edge. The training \
windows overlap the in-sample year, so only the out-of-sample columns are a fair comparison.

## 5. What this means for the Signals tab

- **Show the deflated Sharpe ratio with the implied number of trials,** and the number of variants tried next to it. \
The undeflated PSR passes the best of 15 crossovers on pure noise two or three times as often as it should.
- **Compare with holding the coin.** A positive Sharpe ratio on a coin that rose is not a signal. Each backtest table \
should show holding over the same days, and the timing p-value is the better test of whether the signal adds \
anything. It needs a few hundred reruns per coin, so it belongs in the nightly job, not the API.
- **Lead with walk-forward results,** with costs, rather than the best in-sample backtest.
- **Present crossovers as descriptions of trend, not predictions.** Over this year they showed no timing skill.

## 6. Limitations

- **One year.** 278 daily returns per coin once the 100-day average exists, and 158 out-of-sample days. A 200-day \
crossover, the classic golden cross, would leave 178 and isn't tested.
- **Survivorship.** The coins come from today's top 100.
- **The coins move together,** so 70 coins are far fewer than 70 independent tests.
- **Shuffling removes volatility clustering** as well as any timing information, so the timing p-value tests both.
- **Costs are a flat rate** at the daily close; spreads widen exactly when crossovers tend to fire."""),
        md(REFERENCES_BACKTEST),
    ]


def build(name: str, cells: list) -> None:
    notebook = new_notebook(cells=cells, metadata={"kernelspec": {"name": "python3", "display_name": "Python 3", "language": "python"}})
    NotebookClient(notebook, timeout=900, kernel_name="python3", resources={"metadata": {"path": str(NOTEBOOK_DIR)}}).execute()
    path = NOTEBOOK_DIR / f"{name}.ipynb"
    nbformat.write(notebook, path)
    print(f"wrote {path.relative_to(ROOT.parent)} ({path.stat().st_size / 1024:.0f} KB)")


def main() -> None:
    NOTEBOOK_DIR.mkdir(exist_ok=True)
    notebooks = {"garch": garch_notebook, "value_at_risk": var_notebook, "hmm": hmm_notebook, "monte_carlo": monte_carlo_notebook, "portfolio": portfolio_notebook, "backtest": backtest_notebook}
    for name in sys.argv[1:] or notebooks:
        build(name, notebooks[name]())


if __name__ == "__main__":
    main()
