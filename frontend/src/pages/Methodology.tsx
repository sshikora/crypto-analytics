import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { Formula } from '../components/Formula';
import { Disclaimer } from '../components/Disclaimer';
import { SEO } from '../components/SEO';
import { GET_RISK_SUMMARY } from '../services/queries';
import { track } from '../services/analytics';
import { RiskSummary } from '../types/crypto';

const SOURCE = 'https://github.com/sshikora/crypto-analytics/blob/master';

const SECTIONS = [
  { id: 'data', title: 'Data and conventions' },
  { id: 'realized-volatility', title: 'Realized volatility' },
  { id: 'har-rv', title: 'HAR-RV forecast' },
  { id: 'garch', title: 'GARCH(1,1) and diagnostics' },
  { id: 'value-at-risk', title: 'Value at Risk and expected shortfall' },
  { id: 'backtesting', title: 'VaR backtesting' },
  { id: 'performance', title: 'Return, drawdown and beta' },
  { id: 'regime', title: 'Regime' },
  { id: 'validation', title: 'How the models are validated' },
  { id: 'references', title: 'References' },
] as const;

function Section({ id, title, code, children }: { id: string; title: string; code?: string[]; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
      {code && (
        <p className="text-xs text-gray-500">
          Source:{' '}
          {code.map((path, i) => (
            <span key={path}>
              {i > 0 && ', '}
              <a href={`${SOURCE}/${path}`} className="text-primary-600 hover:text-primary-700 font-mono">
                {path.split('/').pop()}
              </a>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

function Live({ summary, children }: { summary: RiskSummary | undefined; children: (s: RiskSummary) => React.ReactNode }) {
  if (!summary?.asOf) return null;
  return (
    <div className="rounded-lg bg-gray-50 p-3 text-sm">
      <p className="text-xs font-medium text-gray-500 mb-2">Live on Bitcoin, daily closes up to {summary.asOf}</p>
      {children(summary)}
    </div>
  );
}

const pct = (x: number, d = 2) => `${(x * 100).toFixed(d)}%`;
const p3 = (p: number) => (p < 0.001 ? '< 0.001' : p.toFixed(3));
const METHOD_LABELS: Record<string, string> = {
  historical: 'Historical',
  normal: 'Normal',
  studentT: 'Student-t',
  filteredHistorical: 'GARCH-filtered',
};

export default function Methodology() {
  const location = useLocation();
  const { data } = useQuery(GET_RISK_SUMMARY, { variables: { coinId: 'bitcoin' } });
  const btc: RiskSummary | undefined = data?.riskSummary;

  useEffect(() => {
    track('view_methodology', { section: location.hash.slice(1) || 'top' });
  }, [location.hash]);

  // The live panels arrive after the first render and push later sections down, so scroll again once they load
  const liveLoaded = Boolean(btc);
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.hash, liveLoaded]);

  return (
    <>
      <SEO
        title="Methodology | CryptoQuantLab"
        description="How CryptoQuantLab estimates volatility, GARCH, Value at Risk, expected shortfall and drawdowns, and how each model is validated against an independent Python reference."
        canonicalUrl="/methodology"
      />
      <div className="lg:grid lg:grid-cols-[14rem_1fr] lg:gap-8">
        <nav aria-label="Methodology sections" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1 text-sm">
            {SECTIONS.map(s => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-gray-600 hover:text-primary-600">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6 min-w-0">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Methodology</h1>
            <p className="text-gray-600">
              How each number on the Risk tab is estimated, what it assumes, and how it is checked. Every model runs
              nightly on stored daily closes and is validated against an independent Python implementation.
            </p>
            <Disclaimer />
          </div>

          <Section id="data" title="Data and conventions" code={['backend/src/models/returns.ts']}>
            <p>
              Prices are CoinGecko's daily snapshots at 00:00 UTC for the 100 largest coins by market cap, stored as they
              arrive. Models use the last 365 days. Log returns are used for volatility models and simple returns for
              losses, since a position's dollar loss is exactly its simple return times its size.
            </p>
            <Formula tex="r_t = \ln\frac{P_t}{P_{t-1}}, \qquad R_t = \frac{P_t}{P_{t-1}} - 1" />
            <p>
              Volatilities are annualized with the number of observations per year implied by the spacing of the data
              (about 365 for daily closes, since crypto trades every day), and shown in percent.
            </p>
            <Formula tex="\sigma_{\text{annual}} = \sigma_{\text{daily}} \sqrt{N}, \qquad N = \frac{365.25 \cdot (n - 1)}{(t_n - t_1)\ \text{in days}}" />
            <p>
              Moments use the sample standard deviation and the bias-adjusted skewness <Formula inline tex="G_1" /> and
              excess kurtosis <Formula inline tex="G_2" />, the defaults in pandas and scipy.
            </p>
          </Section>

          <Section id="realized-volatility" title="Realized volatility" code={['backend/src/models/realizedVolatility.ts']}>
            <p>Close-to-close volatility over a window of <Formula inline tex="w" /> returns (7, 30 and 90 days):</p>
            <Formula tex="\hat\sigma_w = \sqrt{\frac{1}{w-1}\sum_{i=t-w+1}^{t}\left(r_i - \bar r\right)^2}" />
            <p>
              RiskMetrics EWMA with decay <Formula inline tex="\lambda = 0.94" />, zero mean, normalised by the sum of the
              weights so the earliest estimates need no arbitrary starting value:
            </p>
            <Formula tex="\hat\sigma_t^2 = \frac{\sum_{i \ge 0} \lambda^i r_{t-i}^2}{\sum_{i \ge 0} \lambda^i}" />
            <p className="text-sm text-gray-600">
              The last 30 days carry <Formula inline tex="1 - 0.94^{30} \approx 84\%" /> of the weight. Range-based
              estimators (Parkinson, Garman-Klass) need daily highs and lows, which the current data source does not
              provide.
            </p>
            <Live summary={btc}>
              {s => (
                <p>
                  {s.realizedVolatility.map(v => `${v.windowDays}-day ${v.annualizedVolatility?.toFixed(1) ?? '—'}%`).join(' · ')} ·
                  EWMA {s.ewmaVolatility?.toFixed(1)}%
                </p>
              )}
            </Live>
          </Section>

          <Section id="har-rv" title="HAR-RV forecast" code={['backend/src/models/har.ts', 'backend/src/models/linearRegression.ts']}>
            <p>
              The heterogeneous autoregressive model of Corsi (2009) forecasts tomorrow's variance from daily, weekly and
              monthly averages of past variance. Without intraday prices, each day's squared log return stands in for its
              realized variance, and crypto's seven-day week gives 7 and 30-day components instead of 5 and 22:
            </p>
            <Formula tex="RV_{t+1} = \beta_0 + \beta_d RV_t + \beta_w \frac{1}{7}\sum_{i=0}^{6} RV_{t-i} + \beta_m \frac{1}{30}\sum_{i=0}^{29} RV_{t-i} + \varepsilon_{t+1}, \qquad RV_t = r_t^2" />
            <p>
              Coefficients are estimated by ordinary least squares, solved by Householder QR rather than the normal
              equations. Multi-day forecasts feed each day's forecast back in; a horizon's volatility is the square root of
              the average daily variance forecast. Squared daily returns are a noisy proxy, so low R² is expected.
            </p>
            <Live summary={btc}>
              {s =>
                s.volatilityForecast && (
                  <p>
                    β<sub>d</sub> {s.volatilityForecast.coefficients.daily.toFixed(3)} · β<sub>w</sub>{' '}
                    {s.volatilityForecast.coefficients.weekly.toFixed(3)} · β<sub>m</sub>{' '}
                    {s.volatilityForecast.coefficients.monthly.toFixed(3)} · R² {s.volatilityForecast.rSquared.toFixed(3)} ·
                    forecast {s.volatilityForecast.horizons.map(h => `${h.days}d ${h.annualizedVolatility.toFixed(1)}%`).join(', ')}
                  </p>
                )
              }
            </Live>
          </Section>

          <Section id="garch" title="GARCH(1,1) and diagnostics" code={['backend/src/models/garch.ts', 'backend/src/models/garchDiagnostics.ts']}>
            <p>
              Bollerslev's (1986) GARCH(1,1) on log returns demeaned by their sample mean, with Gaussian errors. The
              initial variance <Formula inline tex="h_0" /> is the sample variance and the first term is left out of the
              likelihood:
            </p>
            <Formula tex="\varepsilon_t = r_t - \bar r, \qquad h_t = \omega + \alpha\,\varepsilon_{t-1}^2 + \beta\, h_{t-1}" />
            <Formula tex="\ln L = -\frac{1}{2}\sum_{t=1}^{n-1}\left(\ln 2\pi + \ln h_t + \frac{\varepsilon_t^2}{h_t}\right)" />
            <p>
              Parameters are estimated by maximum likelihood with Nelder-Mead on <Formula inline tex="(\ln\omega, \ln\alpha, \ln\beta)" />,
              which keeps them positive, constrained to <Formula inline tex="\alpha + \beta < 1" />. Forecasts start
              from the one-step-ahead variance and decay to the long-run level:
            </p>
            <Formula tex="h_{T+k} = \bar\sigma^2 + (\alpha+\beta)^{k-1}\left(h_{T+1} - \bar\sigma^2\right), \qquad \bar\sigma^2 = \frac{\omega}{1 - \alpha - \beta}, \qquad t_{1/2} = \frac{\ln 0.5}{\ln(\alpha+\beta)}" />
            <p>
              Diagnostics use the standardized residuals <Formula inline tex="z_t = \varepsilon_t / \sqrt{h_t}" />. AIC and BIC
              count four parameters (the mean, ω, α, β). The Ljung-Box statistic at 10 lags tests for autocorrelation left in{' '}
              <Formula inline tex="z_t" /> and, applied to <Formula inline tex="z_t^2" />, for volatility clustering the
              model missed:
            </p>
            <Formula tex="Q = n(n+2)\sum_{k=1}^{10}\frac{\hat\rho_k^2}{n-k} \sim \chi^2_{10}, \qquad \text{AIC} = 2k - 2\ln L, \qquad \text{BIC} = k\ln n - 2\ln L" />
            <Live summary={btc}>
              {s =>
                s.garch && (
                  <p>
                    α {s.garch.alpha.toFixed(4)} · β {s.garch.beta.toFixed(4)} · persistence {s.garch.persistence.toFixed(4)} ·
                    half-life {s.garch.halfLifeDays.toFixed(1)} days · log L {s.garch.logLikelihood.toFixed(1)} · AIC{' '}
                    {s.garch.aic.toFixed(1)} · Ljung-Box p {p3(s.garch.ljungBoxResiduals.pValue)} (z),{' '}
                    {p3(s.garch.ljungBoxSquaredResiduals.pValue)} (z²) · excess kurtosis of z{' '}
                    {s.garch.standardizedExcessKurtosis.toFixed(2)}
                  </p>
                )
              }
            </Live>
          </Section>

          <Section id="value-at-risk" title="Value at Risk and expected shortfall" code={['backend/src/models/valueAtRisk.ts']}>
            <p>
              One-day VaR is the loss exceeded with probability <Formula inline tex="\alpha = 1 - c" /> (5% or 1%); expected
              shortfall is the average loss beyond it. Both are fractions of the position, estimated from the last 180
              simple returns by four methods:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Historical simulation:</strong> the empirical quantile, interpolated linearly as numpy does.
                <Formula tex="\text{VaR} = -\hat Q_\alpha(R), \qquad \text{ES} = -\mathbb{E}\left[R \mid R \le \hat Q_\alpha(R)\right]" />
              </li>
              <li>
                <strong>Normal:</strong> sample mean and standard deviation.
                <Formula tex="\text{VaR} = -(\mu + \sigma z_\alpha), \qquad \text{ES} = -\left(\mu - \sigma\,\frac{\varphi(z_\alpha)}{\alpha}\right)" />
              </li>
              <li>
                <strong>Student-t:</strong> location, scale and degrees of freedom by maximum likelihood, with{' '}
                <Formula inline tex="\nu > 2" /> so the variance is finite.
                <Formula tex="\text{VaR} = -(\mu + s\,q), \qquad \text{ES} = -\left(\mu - s\,\frac{f_\nu(q)}{\alpha}\cdot\frac{\nu + q^2}{\nu - 1}\right), \qquad q = t_\nu^{-1}(\alpha)" />
              </li>
              <li>
                <strong>GARCH-filtered historical simulation</strong> (Barone-Adesi, Giannopoulos and Vosper, 1999): a
                GARCH(1,1) on the window's log returns sets tomorrow's volatility, and the window's standardized residuals
                set the shape of a bad day.
                <Formula tex="\text{VaR} = 1 - e^{\,\mu + \sigma_{T+1}\hat Q_\alpha(z)}, \qquad \text{ES} = \mathbb{E}\left[1 - e^{\,\mu + \sigma_{T+1} z} \mid z \le \hat Q_\alpha(z)\right]" />
              </li>
            </ul>
            <p className="text-sm text-gray-600">
              The normal and Student-t quantiles, densities and distribution functions are implemented in TypeScript
              (Lanczos log-gamma, continued-fraction incomplete gamma and beta functions, Acklam's normal quantile refined
              by a Halley step) and match scipy to within <Formula inline tex="1.3 \times 10^{-13}" />.
            </p>
          </Section>

          <Section id="backtesting" title="VaR backtesting" code={['backend/src/models/varBacktest.ts', 'backend/src/models/distributions.ts']}>
            <p>
              Each method is backtested out of sample: every day's VaR is estimated from only the 180 returns before it,
              and an exception is a day whose loss exceeds it. With <Formula inline tex="x" /> exceptions in{' '}
              <Formula inline tex="n" /> days, Kupiec (1995) tests whether the exception rate matches α:
            </p>
            <Formula tex="LR_{uc} = -2\ln\left[(1-\alpha)^{n-x}\alpha^{x}\right] + 2\ln\left[\left(1-\tfrac{x}{n}\right)^{n-x}\left(\tfrac{x}{n}\right)^{x}\right] \sim \chi^2_1" />
            <p>
              Christoffersen (1998) tests whether an exception makes another one tomorrow more likely, from the counts{' '}
              <Formula inline tex="n_{ij}" /> of days in state <Formula inline tex="j" /> after a day in state{' '}
              <Formula inline tex="i" />, and the two combine into a test of conditional coverage:
            </p>
            <Formula tex="LR_{ind} = -2\ln\frac{(1-\pi)^{n_{00}+n_{10}}\pi^{n_{01}+n_{11}}}{(1-\pi_0)^{n_{00}}\pi_0^{n_{01}}(1-\pi_1)^{n_{10}}\pi_1^{n_{11}}} \sim \chi^2_1, \qquad LR_{cc} = LR_{uc} + LR_{ind} \sim \chi^2_2" />
            <p>
              A method passes when both the Kupiec and conditional coverage p-values are at least 0.05. With about 185 test
              days, fewer than two exceptions are expected at 99%, so the 99% backtest only catches large errors.
            </p>
            <Live summary={btc}>
              {s =>
                s.valueAtRisk && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500">
                          <th className="pr-4 py-1 font-medium">Method</th>
                          <th className="pr-4 py-1 font-medium">Level</th>
                          <th className="pr-4 py-1 font-medium text-right">VaR</th>
                          <th className="pr-4 py-1 font-medium text-right">ES</th>
                          <th className="pr-4 py-1 font-medium text-right">Exceptions</th>
                          <th className="pr-4 py-1 font-medium text-right">Kupiec p</th>
                          <th className="py-1 font-medium text-right">Coverage p</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.valueAtRisk.levels.flatMap(level =>
                          level.methods.map(m => (
                            <tr key={`${level.confidence}-${m.method}`} className="border-t border-gray-200">
                              <td className="pr-4 py-1">{METHOD_LABELS[m.method]}</td>
                              <td className="pr-4 py-1">{Math.round(level.confidence * 100)}%</td>
                              <td className="pr-4 py-1 text-right">{pct(m.valueAtRisk)}</td>
                              <td className="pr-4 py-1 text-right">{pct(m.expectedShortfall)}</td>
                              <td className="pr-4 py-1 text-right">
                                {m.backtest.exceptions} / {m.backtest.days}
                              </td>
                              <td className="pr-4 py-1 text-right">{p3(m.backtest.kupiecPValue)}</td>
                              <td className="py-1 text-right">{p3(m.backtest.conditionalCoveragePValue)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </Live>
          </Section>

          <Section id="performance" title="Return, drawdown and beta" code={['backend/src/models/performance.ts']}>
            <p>On daily simple returns, with the risk-free rate taken as 0, the usual convention for crypto:</p>
            <Formula tex="\text{Sharpe} = \frac{\bar R}{s_R}\sqrt{N}, \qquad \text{Sortino} = \frac{\bar R}{\sqrt{\frac{1}{n}\sum_t \min(R_t, 0)^2}}\sqrt{N}, \qquad \text{Calmar} = \frac{\left(P_n / P_1\right)^{N/(n-1)} - 1}{\left|\text{MDD}\right|}" />
            <Formula tex="DD_t = \frac{P_t}{\max_{s \le t} P_s} - 1, \qquad \text{MDD} = \min_t DD_t, \qquad \beta = \frac{\operatorname{Cov}(R, R_{\text{BTC}})}{\operatorname{Var}(R_{\text{BTC}})}" />
            <p>
              The longest drawdown is the most consecutive days spent below a previous high. Beta and correlation use only
              the dates both coins have, over the year and the last 90 days.
            </p>
            <Live summary={btc}>
              {s =>
                s.performance && (
                  <p>
                    annualized return {pct(s.performance.annualizedReturn, 1)} · Sharpe {s.performance.sharpeRatio?.toFixed(2)} ·
                    Sortino {s.performance.sortinoRatio?.toFixed(2)} · maximum drawdown{' '}
                    {pct(s.performance.drawdown.maxDrawdown, 1)} ({s.performance.drawdown.peakDate} to{' '}
                    {s.performance.drawdown.troughDate})
                  </p>
                )
              }
            </Live>
          </Section>

          <Section id="regime" title="Regime" code={['backend/src/models/regime.ts']}>
            <p>
              A simple threshold regime, shown as a badge on each coin and on the Markets page. It describes the recent
              state of the market for a coin; it is not a signal to buy or sell.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Trend</strong> compares the latest close with its 200-day simple moving average:
                <Formula tex="\text{trend} = \begin{cases} \text{up} & P_n > \frac{1}{200}\sum_{i=n-199}^{n} P_i \\ \text{down} & \text{otherwise} \end{cases}" />
              </li>
              <li>
                <strong>Volatility level</strong> ranks the latest 30-day realized volatility among every 30-day window in
                the coin's stored history: below the 33rd percentile is low, above the 67th is high.
                <Formula tex="p = \frac{1}{m}\sum_{j=1}^{m} \mathbf{1}\left[\hat\sigma_{30,j} \le \hat\sigma_{30,m}\right]" />
              </li>
            </ul>
            <p className="text-sm text-gray-600">
              Both are relative to the coin itself, so a stablecoin can be in high volatility for a stablecoin. Coins
              with fewer than 200 closes, or a price that never moved, get no regime. A two- or three-state hidden Markov
              model is planned to replace these thresholds.
            </p>
            <Live summary={btc}>
              {s =>
                s.regime && (
                  <p>
                    {s.regime.trend === 'up' ? 'uptrend' : 'downtrend'}: price {s.regime.priceToMovingAverage.toFixed(3)}× its
                    200-day average · 30-day volatility at the {Math.round(s.regime.volatilityPercentile * 100)}th percentile,{' '}
                    {s.regime.volatilityLevel}
                  </p>
                )
              }
            </Live>
          </Section>

          <Section id="validation" title="How the models are validated">
            <p>
              Each model has a reference implementation in Python, written from the formulas above. A script runs it on a
              fixed year of Bitcoin closes, compares it with a standard library and refuses to write a fixture if they
              disagree. The TypeScript tests then compare against the fixture. Each model was also run over every stored
              coin to catch cases the Bitcoin sample never reaches, such as stablecoins whose price barely moves.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="pr-4 py-1 font-medium">Model</th>
                    <th className="pr-4 py-1 font-medium">Reference checked against</th>
                    <th className="py-1 font-medium">TypeScript matches the reference to</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Returns, moments', 'scipy, pandas', '1e-14 (returns), 1e-10 (moments)'],
                    ['Rolling and EWMA volatility', 'pandas rolling and ewm', '1e-12'],
                    ['HAR-RV', 'statsmodels OLS', '1e-9'],
                    ['GARCH(1,1)', 'multi-start maximum likelihood; arch as a cross-check', 'log-likelihood 1e-4, parameters 1e-3'],
                    ['Ljung-Box, AIC, BIC', 'statsmodels acorr_ljungbox', '1e-12'],
                    ['Probability functions', 'scipy, 353 values into the tails', '1.3e-13'],
                    ['Historical and normal VaR/ES', 'numpy, scipy', '1e-12'],
                    ['Student-t VaR/ES', 'scipy t.fit, polished to the maximum', 'likelihood 1e-8, VaR 1e-6'],
                    ['GARCH-filtered VaR/ES', 'the GARCH reference', 'about 1e-6; identical exception days'],
                    ['Kupiec, Christoffersen', 'scipy chi-square', '1e-10'],
                    ['Return, drawdown, beta', 'pandas, numpy, scipy linregress', '1e-12'],
                    ['Regime', 'pandas rolling mean, rolling std and rank', '1e-12'],
                  ].map(([model, against, tolerance]) => (
                    <tr key={model} className="border-t border-gray-100">
                      <td className="pr-4 py-1">{model}</td>
                      <td className="pr-4 py-1">{against}</td>
                      <td className="py-1">{tolerance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500">
              Reference code:{' '}
              <a href={`${SOURCE}/validation`} className="text-primary-600 hover:text-primary-700 font-mono">
                validation/
              </a>
            </p>
          </Section>

          <Section id="references" title="References">
            <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
              <li>Barone-Adesi, G., Giannopoulos, K. and Vosper, L. (1999). VaR without correlations for portfolios of derivative securities. <em>Journal of Futures Markets</em>, 19(5), 583–602.</li>
              <li>Bollerslev, T. (1986). Generalized autoregressive conditional heteroskedasticity. <em>Journal of Econometrics</em>, 31(3), 307–327.</li>
              <li>Christoffersen, P. F. (1998). Evaluating interval forecasts. <em>International Economic Review</em>, 39(4), 841–862.</li>
              <li>Corsi, F. (2009). A simple approximate long-memory model of realized volatility. <em>Journal of Financial Econometrics</em>, 7(2), 174–196.</li>
              <li>J.P. Morgan/Reuters (1996). <em>RiskMetrics — Technical Document</em>, 4th edition.</li>
              <li>Kupiec, P. H. (1995). Techniques for verifying the accuracy of risk measurement models. <em>Journal of Derivatives</em>, 3(2), 73–84.</li>
              <li>Lanczos, C. (1964). A precision approximation of the gamma function. <em>SIAM Journal on Numerical Analysis, Series B</em>, 1, 86–96.</li>
              <li>Ljung, G. M. and Box, G. E. P. (1978). On a measure of lack of fit in time series models. <em>Biometrika</em>, 65(2), 297–303.</li>
              <li>Press, W. H., Teukolsky, S. A., Vetterling, W. T. and Flannery, B. P. (2007). <em>Numerical Recipes</em>, 3rd edition. Cambridge University Press.</li>
              <li>Sharpe, W. F. (1966). Mutual fund performance. <em>Journal of Business</em>, 39(1), 119–138.</li>
              <li>Sortino, F. A. and van der Meer, R. (1991). Downside risk. <em>Journal of Portfolio Management</em>, 17(4), 27–31.</li>
            </ol>
          </Section>
        </div>
      </div>
    </>
  );
}
