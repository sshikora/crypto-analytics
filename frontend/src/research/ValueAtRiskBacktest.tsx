import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { format, parseISO } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Formula } from '../components/Formula';
import { GET_RISK_SUMMARY } from '../services/queries';
import { RiskSummary } from '../types/crypto';
import { A, H2, SOURCE, Table } from './PostElements';
import { ModelBacktest, VAR_STUDY, VAR_STUDY_PERIODS, VarStudyCoin } from './varStudy';

const NOMINAL = 0.05;
const WAVES = 2;

const MODELS: { key: keyof Omit<VarStudyCoin, 'coin' | 'forecasts'>; label: string }[] = [
  { key: 'garchBootstrap', label: 'GARCH bootstrap' },
  { key: 'normal', label: 'Normal' },
  { key: 'studentT', label: 'Student-t' },
];

// One-day VaR on Bitcoin, 183 test days from 2026-04-22 to 2026-10-21, from validation/notebooks/value_at_risk.ipynb section 3
const ONE_DAY = [
  { method: 'GARCH-filtered', exceptions95: 7, kupiec: '0.448', coverage: '0.385', exceptions99: 1 },
  { method: 'Historical', exceptions95: 5, kupiec: '0.125', coverage: '0.085', exceptions99: 1 },
  { method: 'Student-t', exceptions95: 4, kupiec: '0.050', coverage: '0.026', exceptions99: 0 },
  { method: 'Normal', exceptions95: 3, kupiec: '0.016', coverage: '0.052', exceptions99: 1 },
];

// Chance that Kupiec's test rejects at the 5% level over 183 days, from validation/notebooks/value_at_risk.ipynb section 4
const POWER = [
  { rate: '1%', at95: '89%', at99: '1%' },
  { rate: '2%', at95: '50%', at99: '16%' },
  { rate: '3%', at95: '20%', at99: '47%' },
  { rate: '5%', at95: '4%', at99: '90%' },
  { rate: '10%', at95: '75%', at99: '100%' },
];

const forecasts = VAR_STUDY.reduce((sum, c) => sum + c.forecasts, 0);
const total = (pick: (m: ModelBacktest) => number, key: (typeof MODELS)[number]['key']) =>
  VAR_STUDY.reduce((sum, c) => sum + pick(c[key]), 0);
const rate = (pick: (m: ModelBacktest) => number, key: (typeof MODELS)[number]['key']) => total(pick, key) / forecasts;
const lossToShortfall = (key: (typeof MODELS)[number]['key']) =>
  total(m => m.lossToShortfall95 * m.exceptions95, key) / total(m => m.exceptions95, key);

const percent = (x: number, digits: number) => `${(x * 100).toFixed(digits)}%`;
const day = (iso: string) => format(parseISO(iso), 'MMMM d');

const periods = VAR_STUDY_PERIODS.map(p => ({ ...p, share: p.garchBootstrap / p.coins }));
const waves = [...periods].sort((a, b) => b.garchBootstrap - a.garchBootstrap).slice(0, WAVES);
const periodExceptions = periods.reduce((sum, p) => sum + p.garchBootstrap, 0);
const quietPeriods = periods.filter(p => p.garchBootstrap === 0).length;

function WaveChart() {
  return (
    <figure className="space-y-1">
      <figcaption className="text-sm font-medium">Exceptions came in two waves</figcaption>
      <p className="text-xs text-gray-500">
        Share of coins whose 10-day loss broke the GARCH bootstrap's 95% VaR, by the period's first day. Dashed line: the
        5% expected. Blue: the two worst periods.
      </p>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={periods} barCategoryGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="start" tickFormatter={(v: string) => format(parseISO(v), 'MMM d')} stroke="#6b7280" fontSize={11} />
            <YAxis
              domain={[0, 0.25]}
              ticks={[0, 0.05, 0.1, 0.15, 0.2, 0.25]}
              tickFormatter={(v: number) => percent(v, 0)}
              stroke="#6b7280"
              fontSize={11}
              width={36}
            />
            <Tooltip
              labelFormatter={v => `10 days from ${day(v as string)}`}
              formatter={(value: number) => [percent(value, 1), 'Coins breaking VaR']}
            />
            <ReferenceLine y={NOMINAL} stroke="#374151" strokeDasharray="6 3" />
            <Bar dataKey="share" isAnimationActive={false}>
              {periods.map(p => (
                <Cell key={p.start} fill={waves.includes(p) ? '#2563eb' : '#9ca3af'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-500">
        Source: <A href={`${SOURCE}/validation/data/monte_carlo_periods.csv`}>monte_carlo_periods.csv</A>, the{' '}
        {periods.length} periods shared by at least 10 coins
      </p>
    </figure>
  );
}

export default function ValueAtRiskBacktest() {
  const { data } = useQuery(GET_RISK_SUMMARY, { variables: { coinId: 'bitcoin' } });
  const btc: RiskSummary | undefined = data?.riskSummary ?? undefined;
  const live = btc?.valueAtRisk?.levels
    .find(l => l.confidence === 0.95)
    ?.methods.find(m => m.method === 'filteredHistorical');

  const garch95 = rate(m => m.exceptions95, 'garchBootstrap');
  const driftChange = Math.max(
    ...MODELS.flatMap(({ key }) => [
      Math.abs(rate(m => m.zeroDriftExceptions95, key) - rate(m => m.exceptions95, key)),
      Math.abs(rate(m => m.zeroDriftExceptions99, key) - rate(m => m.exceptions99, key)),
    ])
  );

  return (
    <div className="space-y-4 text-gray-800 leading-relaxed">
      <p>
        A 95% Value at Risk (VaR) is the loss that should be beaten on only one day in twenty. The{' '}
        <Link to="/crypto/BTC?tab=risk" className="text-primary-600 hover:text-primary-700">
          Risk
        </Link>{' '}
        and{' '}
        <Link to="/crypto/BTC?tab=scenario" className="text-primary-600 hover:text-primary-700">
          Scenario
        </Link>{' '}
        tabs show it for every coin, so I tested whether it held. I backtested one-day VaR on Bitcoin with four methods, and
        10-day Monte Carlo VaR on {VAR_STUDY.length} coins: {forecasts.toLocaleString('en-US')} forecasts per model, each
        made only from the prices before it.
      </p>
      <p>
        Over the test period, every model overstated the risk. The GARCH bootstrap came closest, breaking its 95% VaR on{' '}
        {percent(garch95, 1)} of forecasts instead of 5%. The more useful finding is how little the test can prove. Coins
        fall together, so the {forecasts.toLocaleString('en-US')} forecasts hold about {periods.length} independent periods,
        and two market-wide falls hold half the exceptions.
      </p>

      <H2>How a VaR backtest works</H2>
      <p>
        Estimate each day's VaR from the data before it, then count the exceptions: days whose loss was larger. With{' '}
        <Formula inline tex="x" /> exceptions in <Formula inline tex="n" /> days, Kupiec's test asks whether the exception
        rate matches the tail probability <Formula inline tex="\alpha" />:
      </p>
      <Formula tex="LR_{uc} = -2\ln\left[(1-\alpha)^{n-x}\alpha^{x}\right] + 2\ln\left[\left(1-\tfrac{x}{n}\right)^{n-x}\left(\tfrac{x}{n}\right)^{x}\right] \sim \chi^2_1" />
      <p>
        Christoffersen's test adds whether one exception makes another more likely the next day, which a model that reacts
        too slowly to volatility would show. The catch is power. A year of daily prices leaves about 180 test days after
        the first window, and at 99% fewer than two exceptions are expected. Here is the chance that Kupiec's test rejects a
        VaR whose true exception rate is wrong, over 183 days:
      </p>
      <Table
        head={['True exception rate', 'Rejects a 95% VaR', 'Rejects a 99% VaR']}
        rows={POWER.map(p => [p.rate, p.at95, p.at99])}
      />
      <p>
        A 99% VaR that is broken twice as often as it should be is rejected only 16% of the time. A pass at 99% on one coin
        is weak evidence, and the 95% level is where the methods can be told apart.
      </p>

      <H2>One day, on Bitcoin</H2>
      <p>
        Four methods, each fitted to the previous 180 daily returns: the historical quantile, a normal distribution, a
        Student-t fitted by maximum likelihood, and GARCH-filtered historical simulation, which scales the window's
        standardized returns by tomorrow's GARCH(1,1) volatility. Over 183 test days from April 22 to October 21, 2026:
      </p>
      <Table
        head={['Method', 'Exceptions at 95% (9.2 expected)', 'Kupiec p', 'Coverage p', 'Exceptions at 99% (1.8 expected)']}
        rows={ONE_DAY.map(m => [m.method, m.exceptions95, m.kupiec, m.coverage, m.exceptions99])}
      />
      <p>
        Every method had fewer exceptions than expected. The normal and Student-t models failed for being too cautious, the
        opposite of the usual worry. The GARCH-filtered VaR came closest because it reacts within days of a large move and
        falls back when markets calm down, while the others weight every day in the window equally. At 99% all four had at
        most one exception, which the table above says proves little.
      </p>

      <H2>Ten days, on {VAR_STUDY.length} coins</H2>
      <p>
        One coin can't separate the models, so I used the Monte Carlo engine behind the Scenario tab on every coin the site
        tracks with daily volatility of at least 0.5%, which leaves out stablecoins. Every 10 days, each model is fitted to
        the coin's previous 180 returns, 5,000 paths are simulated 10 days ahead, and the realized 10-day loss is compared
        with the paths' VaR. Periods don't overlap. The three models:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Normal:</strong> geometric Brownian motion with the window's mean and standard deviation.
        </li>
        <li>
          <strong>Student-t:</strong> fat tails fitted by maximum likelihood, but no volatility clustering.
        </li>
        <li>
          <strong>GARCH bootstrap</strong> (filtered historical simulation): volatility starts at tomorrow's GARCH(1,1)
          forecast and reacts to each simulated day, and each shock is one of the window's standardized residuals{' '}
          <Formula inline tex="\hat z" />, drawn at random:
          <Formula tex="r_t = \mu + \sqrt{h_t}\, \hat z_{k_t}, \qquad h_{t+1} = \omega + \alpha (r_t - \mu)^2 + \beta h_t" />
        </li>
      </ul>
      <Table
        head={['10-day VaR', 'Losses beyond 95% VaR (5% expected)', 'Beyond 99% VaR (1% expected)', 'Loss beyond 95% VaR ÷ predicted ES']}
        rows={MODELS.map(({ key, label }) => [
          label,
          percent(rate(m => m.exceptions95, key), 1),
          percent(rate(m => m.exceptions99, key), 2),
          lossToShortfall(key).toFixed(2),
        ])}
      />
      <p>
        All three overstated the risk, and the Student-t, built for fat tails, overstated it most: over these six months its
        heavy tails cost more than they gave. When VaR was broken, the average loss was close to the expected shortfall
        (ES) the model predicted, the last column. Setting the drift to zero, as the Scenario tab does, moved every rate by
        under {driftChange < 0.01 ? 'a percentage point' : `${(driftChange * 100).toFixed(1)} percentage points`}.
      </p>

      <H2>Exceptions come in waves</H2>
      <p>
        A Kupiec test on the pooled forecasts would treat them as independent. They aren't:
      </p>
      <WaveChart />
      <p>
        In {quietPeriods} of the {periods.length} periods no coin broke its VaR. In the 10 days from {day(waves[0].start)}
        , {percent(waves[0].share, 0)} of coins did, and from {day(waves[1].start)}, {percent(waves[1].share, 0)}. Those two
        periods hold {waves.reduce((sum, p) => sum + p.garchBootstrap, 0)} of the {periodExceptions} exceptions. The test
        has about {periods.length} independent observations, not {forecasts.toLocaleString('en-US')}, so pooled p-values
        overstate how sure we can be. Telling the models apart properly needs a longer history or a joint model of the
        coins.
      </p>

      <H2>What I changed because of it</H2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>The Scenario tab defaults to the GARCH bootstrap,</strong> the model closest to its nominal rate, with
          the other two a click away.
        </li>
        <li>
          <strong>It simulates 10,000 paths without antithetic pairs.</strong> Mirrored pairs made the mean 27 to 60 times
          more precise but did nothing for VaR or ES, which depend only on the worst paths. More paths do help: at 10,000, a
          30-day 95% VaR is known to about a quarter of a percentage point.
        </li>
        <li>
          <strong>Paths have no drift.</strong> A window's average return is mostly noise, and over 90 days it would
          dominate the fan.
        </li>
        <li>
          <strong>The Risk tab's 99% backtest says it can only catch large errors,</strong> and a method passes only when
          both the Kupiec and the conditional coverage p-values are at least 0.05.
        </li>
        <li>
          <strong>The Methodology page says the 30 and 90-day horizons are not backtested.</strong> A year of prices holds
          too few independent 90-day periods.
        </li>
      </ul>
      {live && (
        <p>
          On Bitcoin, with daily closes up to {btc?.asOf}, the GARCH-filtered 95% VaR has {live.backtest.exceptions}{' '}
          exceptions in {live.backtest.days} test days against {live.backtest.expectedExceptions.toFixed(1)} expected
          (Kupiec p = {live.backtest.kupiecPValue.toFixed(2)}).{' '}
          <Link to="/crypto/BTC?tab=risk" className="text-primary-600 hover:text-primary-700">
            See it live
          </Link>
          .
        </p>
      )}
      <p>
        The limits matter. Each coin is simulated alone, so a portfolio needs correlated paths first. The parameters are
        treated as known, though 180 days estimate them with error, which makes the fan too narrow. The bootstrap can't draw
        a shock larger than the window's largest, only a larger variance. The coins are the ones the site tracks today, so
        coins that collapsed and dropped out are missing, which flatters every model. And six months with two market-wide
        falls is one sample of market conditions: a calmer or wilder half-year could rank the models differently.
      </p>

      <H2>Reproduce it</H2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <A href={`${SOURCE}/validation/notebooks/value_at_risk.ipynb`}>The one-day VaR notebook</A>, with the four
          methods, the coverage tests and the power calculation
        </li>
        <li>
          <A href={`${SOURCE}/validation/notebooks/monte_carlo.ipynb`}>The Monte Carlo notebook</A> and{' '}
          <A href={`${SOURCE}/validation/scripts/monte_carlo_cross_section.py`}>the cross-section script</A>, with
          checks against closed forms and the path-count study
        </li>
        <li>
          The production TypeScript: <A href={`${SOURCE}/backend/src/models/valueAtRisk.ts`}>valueAtRisk.ts</A> and{' '}
          <A href={`${SOURCE}/backend/src/models/varBacktest.ts`}>varBacktest.ts</A>, which reproduce every exception day
          of the Python reference, and <A href={`${SOURCE}/backend/src/models/monteCarlo.ts`}>monteCarlo.ts</A>, whose
          paths match it to 1e-12 from the same seed
        </li>
        <li>
          The method on the Methodology page:{' '}
          <Link to="/methodology#backtesting" className="text-primary-600 hover:text-primary-700">
            VaR backtesting
          </Link>{' '}
          and{' '}
          <Link to="/methodology#monte-carlo" className="text-primary-600 hover:text-primary-700">
            Monte Carlo scenarios
          </Link>
        </li>
      </ul>

      <H2>References</H2>
      <ul className="space-y-2 text-sm">
        <li>
          Barone-Adesi, G., Giannopoulos, K. and Vosper, L. (1999). VaR without correlations for portfolios of derivative
          securities. <em>Journal of Futures Markets</em>, 19(5), 583–602.
        </li>
        <li>
          Christoffersen, P. F. (1998). Evaluating interval forecasts. <em>International Economic Review</em>, 39(4),
          841–862.
        </li>
        <li>
          Glasserman, P. (2004). <em>Monte Carlo Methods in Financial Engineering</em>. Springer.
        </li>
        <li>
          Kupiec, P. H. (1995). Techniques for verifying the accuracy of risk measurement models.{' '}
          <em>Journal of Derivatives</em>, 3(2), 73–84.
        </li>
        <li>
          McNeil, A. J., Frey, R. and Embrechts, P. (2015). <em>Quantitative Risk Management: Concepts, Techniques and
          Tools</em>, revised edition. Princeton University Press.
        </li>
      </ul>
    </div>
  );
}
