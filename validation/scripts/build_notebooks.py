"""Build and execute the validation notebooks in validation/notebooks/.

The notebooks are generated here, not edited by hand, so their code and outputs
always come from the current reference implementations.

    uv run scripts/build_notebooks.py
"""

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


def build(name: str, cells: list) -> None:
    notebook = new_notebook(cells=cells, metadata={"kernelspec": {"name": "python3", "display_name": "Python 3", "language": "python"}})
    NotebookClient(notebook, timeout=900, kernel_name="python3", resources={"metadata": {"path": str(NOTEBOOK_DIR)}}).execute()
    path = NOTEBOOK_DIR / f"{name}.ipynb"
    nbformat.write(notebook, path)
    print(f"wrote {path.relative_to(ROOT.parent)} ({path.stat().st_size / 1024:.0f} KB)")


def main() -> None:
    NOTEBOOK_DIR.mkdir(exist_ok=True)
    build("garch", garch_notebook())
    build("value_at_risk", var_notebook())


if __name__ == "__main__":
    main()
