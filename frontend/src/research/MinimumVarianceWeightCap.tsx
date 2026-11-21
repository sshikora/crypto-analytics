import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Formula } from '../components/Formula';
import { A, H2, SOURCE, Table } from './PostElements';
import { PORTFOLIO_PERIODS, PORTFOLIO_RESULTS, PortfolioResult } from './portfolioStudy';

const UNCAPPED = '#eb6834';
const CAPPED = '#2563eb';

// Excess variance of the minimum-variance portfolio over the best possible, 20 simulated assets with two common factors,
// 40 draws per length, from validation/notebooks/portfolio.ipynb section 1
const SIMULATION = [
  { days: 30, sample: '6.8%', identity: '13.3%', constantCorrelation: '3.3%' },
  { days: 60, sample: '4.1%', identity: '7.2%', constantCorrelation: '2.1%' },
  { days: 90, sample: '2.5%', identity: '3.6%', constantCorrelation: '1.3%' },
  { days: 180, sample: '1.4%', identity: '1.9%', constantCorrelation: '0.7%' },
  { days: 365, sample: '0.4%', identity: '0.5%', constantCorrelation: '0.3%' },
];

const SHOWN: { strategy: string; label: string }[] = [
  { strategy: 'minVarianceConstantCorrelation', label: 'Minimum variance' },
  { strategy: 'minVarianceCap20', label: 'Minimum variance, 20% cap' },
  { strategy: 'minVarianceCap10', label: 'Minimum variance, 10% cap' },
  { strategy: 'riskParity', label: 'Risk parity' },
  { strategy: 'inverseVolatility', label: 'Inverse volatility' },
  { strategy: 'capWeight', label: 'Cap-weighted' },
  { strategy: 'equalWeight', label: 'Equal weight' },
  { strategy: 'maxSharpe', label: 'Highest Sharpe' },
];

const result = (strategy: string, universe: PortfolioResult['universe'] = 'top20') =>
  PORTFOLIO_RESULTS.find(r => r.universe === universe && r.strategy === strategy)!;
const percent = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const range = (values: number[], show: (x: number) => string) =>
  `${show(Math.min(...values)).replace(/%$/, '')}–${show(Math.max(...values))}`;
const day = (iso: string) => format(parseISO(iso), 'MMMM d');

const uncappedEstimates = ['minVarianceSample', 'minVarianceConstantCorrelation', 'minVarianceIdentity'].map(s => result(s));
const minimum = result('minVarianceConstantCorrelation');
const capped = result('minVarianceCap20');
const capWeighted = result('capWeight');
const kept = (capWeighted.annualizedVolatility - capped.annualizedVolatility) / (capWeighted.annualizedVolatility - minimum.annualizedVolatility);
const spikes = PORTFOLIO_PERIODS.filter(p => p.uncapped > 2);
const largestOutside = Math.max(...PORTFOLIO_PERIODS.filter(p => !spikes.includes(p)).map(p => p.uncapped));

function ForecastChart() {
  return (
    <figure className="space-y-1">
      <figcaption className="text-sm font-medium">The uncapped forecast failed once, by two to three times</figcaption>
      <p className="text-xs text-gray-500">
        Realized volatility over each 30-day holding period divided by the volatility forecast by the portfolio's own
        covariance estimate, by rebalance date. Dashed line: a perfect forecast. 90-day estimation window, all three offsets.
      </p>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={PORTFOLIO_PERIODS} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="start" tickFormatter={(v: string) => format(parseISO(v), 'MMM d')} stroke="#6b7280" fontSize={11} minTickGap={16} />
            <YAxis
              domain={[0, 3.5]}
              ticks={[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]}
              tickFormatter={(v: number) => `${v}×`}
              stroke="#6b7280"
              fontSize={11}
              width={36}
            />
            <Tooltip
              labelFormatter={v => `Held 30 days from ${day(v as string)}`}
              formatter={(value: number, name: string) => [`${value.toFixed(2)}×`, name]}
            />
            <Legend verticalAlign="top" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={1} stroke="#374151" strokeDasharray="6 3" />
            <Line
              dataKey="uncapped"
              name="Uncapped"
              stroke={UNCAPPED}
              strokeWidth={2}
              dot={{ r: 4, fill: UNCAPPED, stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="capped"
              name="20% cap"
              stroke={CAPPED}
              strokeWidth={2}
              dot={{ r: 4, fill: CAPPED, stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-500">
        Source: <A href={`${SOURCE}/validation/data/portfolio_backtest_periods.csv`}>portfolio_backtest_periods.csv</A>,
        minimum variance on constant-correlation shrinkage. The last period has only three days so far.
      </p>
    </figure>
  );
}

export default function MinimumVarianceWeightCap() {
  return (
    <div className="space-y-4 text-gray-800 leading-relaxed">
      <p>
        Crypto coins move together, so a portfolio of them is barely less risky than its parts. Can an optimizer do better
        out of sample? I built long-only portfolios of the 20 largest coins and backtested them for seven months. The
        minimum-variance portfolio cut volatility from {percent(capWeighted.annualizedVolatility)} a year for a
        cap-weighted portfolio to {percent(minimum.annualizedVolatility)}, but it did so by holding about two coins' worth,
        mostly TRON.
      </p>
      <p>
        When TRON fell 6.7% on October 31 and 7.8% on November 1, that portfolio's realized volatility was two to three
        times what its own covariance estimate forecast. Capping each coin at 20% kept about {percent(kept, 0)} of the reduction, and
        its worst period was {capped.worstRatio.toFixed(1)} times its forecast, close to cap-weighted's{' '}
        {capWeighted.worstRatio.toFixed(1)}. The models behind this are written up on the{' '}
        <Link to="/methodology#portfolios" className="text-primary-600 hover:text-primary-700">
          Methodology page
        </Link>
        , and they will drive a portfolio page on the site.
      </p>

      <H2>The setup</H2>
      <p>
        Every 30 days, the backtest takes the 20 largest coins by market cap whose daily volatility over the estimation
        window is at least 0.5%, which leaves out stablecoins and tokenized funds. Each portfolio's weights come from the
        previous 90 or 180 days, and it is held without trading until the next rebalance. Two window lengths and three
        starting offsets give six schedules over the same test days, from late April to November 20, 2026, and the results
        below average them. All portfolios are long-only and fully invested:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Simple weightings:</strong> by market cap, equal, and inverse volatility.
        </li>
        <li>
          <strong>Minimum variance</strong>, which minimizes the forecast variance{' '}
          <Formula inline tex="w'\hat\Sigma w" /> and so holds whatever the covariance estimate says is safest.
        </li>
        <li>
          <strong>Risk parity</strong>, where every coin contributes the same share of variance.
        </li>
        <li>
          <strong>The highest-Sharpe point</strong> on the efficient frontier, which also uses each coin's average return.
        </li>
      </ul>

      <H2>Which covariance to optimize</H2>
      <p>
        With 20 coins and 90 days, the sample covariance estimates 210 variances and covariances from 90 days of returns,
        and an optimizer leans hardest on the directions that look safest by chance. Ledoit and Wolf shrink it towards a structured target{' '}
        <Formula inline tex="F" />, with the intensity <Formula inline tex="\delta" /> estimated from the data:
      </p>
      <Formula tex="\hat\Sigma = \delta F + (1 - \delta) S" />
      <p>
        scikit-learn's default target is the identity, which pulls every correlation towards zero. The other common one
        keeps each variance and sets every correlation to the average. I simulated 20 assets driven by two common factors,
        like crypto's, and measured how much more variance the minimum-variance portfolio built from each estimate had than
        the best possible:
      </p>
      <Table
        head={['Days of data', 'Sample covariance', 'Shrunk to identity', 'Shrunk to constant correlation']}
        rows={SIMULATION.map(s => [s.days, s.sample, s.identity, s.constantCorrelation])}
      />
      <p>
        Shrinking towards the identity was worse than no shrinkage at every length: when assets move together, it shows the
        optimizer diversification that isn't there. Constant correlation roughly halved the sample's excess, so it is the
        default. On real coins it mattered much less: the three estimates gave minimum-variance volatility of{' '}
        {range(uncappedEstimates.map(r => r.annualizedVolatility), x => percent(x))}. The long-only
        constraint already does much of the regularizing (Jagannathan and Ma, 2003).
      </p>

      <H2>Results</H2>
      <Table
        head={['Portfolio', 'Annualized volatility', 'Max drawdown', 'Effective holdings', 'Turnover per rebalance']}
        rows={SHOWN.map(({ strategy, label }) => {
          const r = result(strategy);
          const holdings = Number.isInteger(r.effectiveHoldings) ? r.effectiveHoldings : r.effectiveHoldings.toFixed(1);
          return [label, percent(r.annualizedVolatility), percent(r.maxDrawdown), holdings, percent(r.turnover, 0)];
        })}
      />
      <p className="text-xs text-gray-500">
        Minimum variance and the highest-Sharpe point use constant-correlation shrinkage. Effective holdings are{' '}
        <Formula inline tex="1 / \sum_i w_i^2" />: 20 for equal weights, 1 for a single coin.
      </p>
      <p>
        Uncapped minimum variance had the lowest volatility and the smallest drawdown, with any of the three covariance
        estimates. The highest-Sharpe portfolio, which trusts a year of average returns, was the riskiest and
        traded about half its weight every month. Returns are left out on purpose: over seven months they are mostly noise,
        and every portfolio here lost money.
      </p>
      <p>
        Is it just TRON? Without it, minimum variance still had the lowest volatility,{' '}
        {percent(result('minVarianceConstantCorrelation', 'top20WithoutTron').annualizedVolatility)} against{' '}
        {percent(result('capWeight', 'top20WithoutTron').annualizedVolatility)} for cap-weighted, so the reduction isn't
        one coin. But with TRON in the universe, minimum variance put most of the portfolio into it, and that is where the
        risk forecast broke.
      </p>

      <H2>Where the forecast failed</H2>
      <p>
        A minimum-variance portfolio is built to look safe to its own covariance estimate, so the test that matters is
        whether its realized risk matched that estimate:
      </p>
      <ForecastChart />
      <p>
        Outside October, the uncapped portfolio's realized volatility was at most {largestOutside.toFixed(1)} times its
        forecast, and usually below it. The rebalances from {day(spikes[0].start)} to {day(spikes[spikes.length - 1].start)}{' '}
        held {range(spikes.map(p => p.largestWeight), x => percent(x, 0))} in TRON, calm for months, and then TRON fell 6.7%
        and 7.8% on consecutive days. A covariance estimated from calm months couldn't see it coming, and with most of the
        portfolio in one coin, one coin's bad week was most of the portfolio's risk.
      </p>
      <p>
        This also changed my own conclusion. My first run ended on November 4, just after the fall, and reported that the
        concentrated portfolios understated their risk by 25–31% on average. Two more weeks of data cut that to{' '}
        {range([result('minVarianceConstantCorrelation').meanRatio, result('minVarianceSample').meanRatio], x => percent(x - 1, 0))}
        , all of it from October. The problem isn't a steady bias. It is a fat tail that depends on one holding, and
        seven months is too short to estimate its average.
      </p>

      <H2>The cap</H2>
      <p>
        The usual fix is a maximum weight per coin. Minimum variance becomes
      </p>
      <Formula tex="\begin{gathered} \min_w\; w'\hat\Sigma w \\ \text{subject to} \;\; \textstyle\sum_i w_i = 1, \;\; 0 \le w_i \le u \end{gathered}" />
      <p>
        which the site's primal active-set solver handles by holding each weight at zero, at the cap, or free. At the
        optimum, every free coin has the same marginal variance <Formula inline tex="(\hat\Sigma w)_i" />, coins at zero
        have at least that much, and coins at the cap at most. It matches an independent Python reference to 1.4e-15 on 150
        random cases.
      </p>
      <p>
        A 20% cap holds at least five coins. It had {percent(capped.annualizedVolatility)} volatility against{' '}
        {percent(minimum.annualizedVolatility)} uncapped and {percent(capWeighted.annualizedVolatility)} cap-weighted, about{' '}
        {capped.effectiveHoldings.toFixed(0)} effective holdings, a forecast that was right on average (
        {capped.meanRatio.toFixed(2)}), and a worst period of {capped.worstRatio.toFixed(1)} times. The chart shows the cap
        isn't more accurate period by period, and in late summer it was further off than uncapped. What it removes is the
        2.5 to 3 times failure. A 10% cap gave up most of the reduction, ending at{' '}
        {percent(result('minVarianceCap10').annualizedVolatility)}, level with risk parity. Without TRON the 20% cap cost
        more: {percent(result('minVarianceCap20', 'top20WithoutTron').annualizedVolatility)} against{' '}
        {percent(result('minVarianceConstantCorrelation', 'top20WithoutTron').annualizedVolatility)} uncapped.
      </p>

      <H2>What the portfolio page will do</H2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Shrink towards a constant correlation.</strong> It was best in simulation and works when a portfolio has
          more coins than days of shared history.
        </li>
        <li>
          <strong>Cap minimum variance at 20% per coin by default,</strong> and show each coin's weight and share of risk
          next to the forecast volatility, so concentration is visible.
        </li>
        <li>
          <strong>Show the highest-Sharpe portfolio as what past averages imply, not as advice.</strong>
        </li>
        <li>
          <strong>Offer risk parity as the diversified option:</strong> all 20 coins, with less risk than equal weight or
          inverse volatility.
        </li>
      </ul>
      <p>
        The limits matter. The coins come from today's top 100, so coins that have since dropped out are missing from
        earlier rebalances. There are no transaction costs, though turnover is shown. Daily closes understate how coins
        that trade around the clock move together within a day. And seven months with one large single-coin shock is one
        sample: a different episode could favour a different cap.
      </p>

      <H2>Reproduce it</H2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <A href={`${SOURCE}/validation/notebooks/portfolio.ipynb`}>The portfolio notebook</A>, with the shrinkage checks
          against scikit-learn and PyPortfolioOpt, the simulation and the backtest tables
        </li>
        <li>
          <A href={`${SOURCE}/validation/scripts/portfolio_backtest.py`}>The backtest script</A> and its results,{' '}
          <A href={`${SOURCE}/validation/data/portfolio_backtest_summary.csv`}>portfolio_backtest_summary.csv</A> and{' '}
          <A href={`${SOURCE}/validation/data/portfolio_backtest_periods.csv`}>portfolio_backtest_periods.csv</A>
        </li>
        <li>
          The production TypeScript: <A href={`${SOURCE}/backend/src/models/covariance.ts`}>covariance.ts</A> and{' '}
          <A href={`${SOURCE}/backend/src/models/portfolio.ts`}>portfolio.ts</A>, tested against the Python reference
        </li>
        <li>
          The method on the Methodology page:{' '}
          <Link to="/methodology#portfolios" className="text-primary-600 hover:text-primary-700">
            Portfolio construction
          </Link>
        </li>
      </ul>

      <H2>References</H2>
      <ul className="space-y-2 text-sm">
        <li>
          DeMiguel, V., Garlappi, L. and Uppal, R. (2009). Optimal versus naive diversification: how inefficient is the 1/N
          portfolio strategy? <em>Review of Financial Studies</em>, 22(5), 1915–1953.
        </li>
        <li>
          Jagannathan, R. and Ma, T. (2003). Risk reduction in large portfolios: why imposing the wrong constraints helps.{' '}
          <em>Journal of Finance</em>, 58(4), 1651–1683.
        </li>
        <li>
          Ledoit, O. and Wolf, M. (2004). A well-conditioned estimator for large-dimensional covariance matrices.{' '}
          <em>Journal of Multivariate Analysis</em>, 88(2), 365–411.
        </li>
        <li>
          Ledoit, O. and Wolf, M. (2004). Honey, I shrunk the sample covariance matrix.{' '}
          <em>Journal of Portfolio Management</em>, 30(4), 110–119.
        </li>
        <li>
          Markowitz, H. (1952). Portfolio selection. <em>Journal of Finance</em>, 7(1), 77–91.
        </li>
        <li>
          Nocedal, J. and Wright, S. J. (2006). <em>Numerical Optimization</em>, 2nd edition. Springer.
        </li>
        <li>
          Spinu, F. (2013). An algorithm for computing risk parity weights. SSRN 2297383.
        </li>
      </ul>
    </div>
  );
}
