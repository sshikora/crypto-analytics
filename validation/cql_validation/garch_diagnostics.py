"""Reference GARCH(1,1) diagnostics matching backend/src/models/garchDiagnostics.ts.

Conventions:
- Standardized residuals z[t] = e[t] / sqrt(h[t]) for t = 1..n-1, the terms in
  the likelihood (e is the demeaned log return, h the conditional variance).
- AIC = 2k - 2LL and BIC = k ln(n) - 2LL with k = 4 (mean, omega, alpha, beta;
  the mean is estimated by demeaning) and n the number of likelihood terms.
- Ljung-Box at 10 lags on z (left-over autocorrelation) and on z^2 (left-over
  volatility clustering), as statsmodels computes it.
- Normal QQ points pair the sorted z with normal quantiles at (i - 0.5) / n.
"""

import numpy as np
from scipy import stats
from statsmodels.stats.diagnostic import acorr_ljungbox

from . import garch

PARAMETERS = 4
LJUNG_BOX_LAGS = 10


def standardized_residuals(prices: np.ndarray, f: garch.GarchFit) -> np.ndarray:
    resid = garch.demeaned_log_returns(prices)
    return resid[1:] / np.sqrt(f.variance)


def information_criteria(f: garch.GarchFit, n: int) -> dict:
    return {
        "aic": 2 * PARAMETERS - 2 * f.log_likelihood,
        "bic": PARAMETERS * np.log(n) - 2 * f.log_likelihood,
    }


def ljung_box(x: np.ndarray, lags: int = LJUNG_BOX_LAGS) -> dict:
    result = acorr_ljungbox(x, lags=[lags])
    return {"statistic": float(result["lb_stat"].iloc[0]), "pValue": float(result["lb_pvalue"].iloc[0])}


def normal_qq(z: np.ndarray) -> list[dict]:
    n = len(z)
    theoretical = stats.norm.ppf((np.arange(1, n + 1) - 0.5) / n)
    return [{"theoretical": float(t), "sample": float(s)} for t, s in zip(theoretical, np.sort(z))]
