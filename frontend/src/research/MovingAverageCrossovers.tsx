import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Formula } from '../components/Formula';
import { GET_SIGNALS_EVIDENCE } from '../services/queries';
import { SignalSummary } from '../types/crypto';
import { CROSSOVER_STUDY, CrossoverStudyCoin } from './crossoverStudy';

const SOURCE = 'https://github.com/sshikora/crypto-analytics/blob/master';
const PASS = 0.95;
const SIGNIFICANCE = 0.05;
const BINS = 10;

const percent = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
const share = (test: (c: CrossoverStudyCoin) => boolean) => CROSSOVER_STUDY.filter(test).length / CROSSOVER_STUDY.length;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const medianOf = (pick: (c: CrossoverStudyCoin) => number) => median(CROSSOVER_STUDY.map(pick));

// Best of N fat-tailed strategies with no skill, from validation/notebooks/backtest.ipynb section 2
const CALIBRATION = [
  { trials: 1, probabilistic: '5.7%', deflated: '5.7%' },
  { trials: 15, probabilistic: '57.7%', deflated: '0.15%' },
  { trials: 50, probabilistic: '93.4%', deflated: '0.15%' },
];

function TimingHistogram() {
  const bins = Array.from({ length: BINS }, (_, k) => {
    const inBin = CROSSOVER_STUDY.filter(c => Math.min(Math.floor(c.timingPValue * BINS), BINS - 1) === k);
    const below = inBin.filter(c => c.timingPValue < SIGNIFICANCE).length;
    return { from: k / BINS, below, other: inBin.length - below };
  });
  const expected = CROSSOVER_STUDY.length / BINS;

  return (
    <figure className="space-y-1">
      <figcaption className="text-sm font-medium">
        Timing p-values across {CROSSOVER_STUDY.length} coins: no pile-up near zero
      </figcaption>
      <p className="text-xs text-gray-500">
        Coins per p-value bin of width 0.1, labelled by where each bin starts. Timing skill would pile coins up on the
        left. Blue: p below 0.05.
      </p>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins} barCategoryGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="from" tickFormatter={(v: number) => v.toFixed(1)} stroke="#6b7280" fontSize={11} interval={0} />
            <YAxis allowDecimals={false} stroke="#6b7280" fontSize={11} width={28} />
            <Tooltip
              labelFormatter={v => `p from ${(v as number).toFixed(1)} to ${((v as number) + 1 / BINS).toFixed(1)}`}
              formatter={(value: number, name: string) => [value, name === 'below' ? 'Below 0.05' : 'Coins']}
            />
            <ReferenceLine
              y={expected}
              stroke="#374151"
              strokeDasharray="6 3"
              label={{ value: `${expected} a bin by chance`, position: 'insideTopRight', fontSize: 11, fill: '#374151' }}
            />
            <Bar dataKey="below" stackId="coins" fill="#2563eb" isAnimationActive={false} />
            <Bar dataKey="other" stackId="coins" fill="#9ca3af" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-500">
        Source:{' '}
        <a href={`${SOURCE}/validation/data/crossover_backtest_coins.csv`} className="text-primary-600 hover:text-primary-700">
          crossover_backtest_coins.csv
        </a>
        , 200 shuffles a coin, 0.15% costs
      </p>
    </figure>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            {head.map(h => (
              <th key={h} className="pr-4 py-1 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row[0]} className="border-t border-gray-100">
              {row.map((cell, i) => (
                <td key={i} className="pr-4 py-1">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-semibold text-gray-900 pt-4">{children}</h2>;
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-primary-600 hover:text-primary-700">
      {children}
    </a>
  );
}

export default function MovingAverageCrossovers() {
  const { data } = useQuery(GET_SIGNALS_EVIDENCE, { variables: { coinId: 'bitcoin' } });
  const btc: SignalSummary | undefined = data?.signals ?? undefined;

  const probabilisticPasses = share(c => c.probabilisticSharpe > PASS);
  const deflatedPasses = CROSSOVER_STUDY.filter(c => c.deflatedSharpe > PASS).length;
  const significant = CROSSOVER_STUDY.filter(c => c.timingPValue < SIGNIFICANCE).length;

  return (
    <div className="space-y-4 text-gray-800 leading-relaxed">
      <p>
        Over the past year, moving-average crossovers showed no ability to time crypto markets. I tested 15 of them on{' '}
        {CROSSOVER_STUDY.length} coins, with trading costs, out-of-sample selection and two corrections for having tried
        many variants. Only {significant === 1 ? 'one coin' : `${significant} coins`} in {CROSSOVER_STUDY.length} beat chance
        at the 5% level, fewer than chance alone would produce.
      </p>
      <p>
        The interesting part isn't the null result. It's how convincing the best backtests looked before the corrections:
        on Bitcoin, the best crossover had an annualized Sharpe ratio of 0.87 after costs, while simply holding the coin over
        the same days scored −0.04. This post is about why that number means little, and what the{' '}
        <Link to="/crypto/BTC?tab=signals" className="text-primary-600 hover:text-primary-700">
          Signals tab
        </Link>{' '}
        shows instead.
      </p>

      <H2>Why the best backtest lies</H2>
      <p>
        Try enough variants and one will look good by luck. A Sharpe ratio estimated from one year of daily returns has a
        standard error of about 1 in annualized terms, so luck alone moves it a long way.
      </p>
      <p>
        The usual fix is the probabilistic Sharpe ratio (PSR): the probability that the true Sharpe ratio is above zero,
        allowing for fat tails. It assumes you tried one strategy. Keep the best of several and it passes far too often. I
        checked this on simulated fat-tailed returns with no skill at all:
      </p>
      <Table
        head={['Strategies tried, best one kept', 'PSR above 0.95', 'Deflated Sharpe above 0.95']}
        rows={CALIBRATION.map(c => [c.trials, c.probabilistic, c.deflated])}
      />
      <p>
        The deflated Sharpe ratio (DSR) of Bailey and López de Prado raises the bar to the Sharpe ratio you'd expect from
        the best of <Formula inline tex="N" /> tries with no skill:
      </p>
      <Formula tex="SR_0 = \sqrt{V}\left((1-\gamma)\,\Phi^{-1}\!\left(1-\tfrac{1}{N}\right) + \gamma\,\Phi^{-1}\!\left(1-\tfrac{1}{Ne}\right)\right)" />
      <p>
        where <Formula inline tex="V" /> is the variance of the variants' Sharpe ratios and{' '}
        <Formula inline tex="\gamma" /> is Euler's constant. Two things I learned applying it:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>N is not the number of variants.</strong> Crossovers with nearby periods are nearly the same strategy.
          Counting all 15 as independent overcorrects; the paper's correlation adjustment counts them as about 4 to 5.
          Rerunning the search on each coin's own returns in shuffled order, the PSR passed 11.5% of the time, DSR with all
          15 trials 1.1%, and DSR with the implied count 2.6%.
        </li>
        <li>
          <strong>DSR tests the wrong question for a trading rule.</strong> It asks whether the Sharpe ratio is above zero.
          A long-or-flat rule on a coin that rose has a positive Sharpe ratio without timing anything. The question that
          matters is whether it beat holding the coin.
        </li>
      </ul>

      <H2>The study</H2>
      <p>
        I tested every coin in today's top 100 with a full year of daily closes and daily volatility of at least 0.5%, which
        leaves out stablecoins: {CROSSOVER_STUDY.length} coins from October 2025 to November 2026.
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>The rules.</strong> A crossover is in the market while a short moving average is above a long one, and
          out otherwise. Short periods of 1, 5, 10 and 20 days against long periods of 20, 30, 50 and 100 give 15
          crossovers; a short period of 1 is the price itself. No short selling.
        </li>
        <li>
          <strong>Costs.</strong> Each trade pays 0.15% of the amount traded, fee plus slippage, at the daily close. I also
          ran 0% and 0.30%.
        </li>
        <li>
          <strong>In-sample tests.</strong> For each coin, the best of the 15 over the 278 days after the 100-day average
          exists, with its PSR and DSR.
        </li>
        <li>
          <strong>Out of sample.</strong> Walk-forward selection: pick the crossover with the best Sharpe ratio over the
          last 120 days, follow it for the next 30, repeat. Every reported day was unseen when its crossover was chosen,
          and switching crossovers pays its cost. The comparison is holding the coin over the same 158 days.
        </li>
        <li>
          <strong>A direct test of timing.</strong> Shuffle the order of the coin's daily returns 200 times and rerun the
          whole 15-crossover search on each shuffle. Shuffling keeps the coin's overall rise or fall but destroys any order
          to time. The p-value is the share of shuffles whose best Sharpe ratio matched the real one, a permutation test in
          the spirit of White's (2000) reality check.
        </li>
      </ul>

      <H2>Results</H2>
      <p>
        The in-sample tests found a handful of winners. At 0.15% costs, the best crossover passed the PSR test on{' '}
        {percent(probabilisticPasses, 1)} of coins and the deflated test, with implied trials, on{' '}
        {percent(deflatedPasses / CROSSOVER_STUDY.length, 1)}: {deflatedPasses} coins. But for two of them, JUST and
        Venice, the best crossover's Sharpe ratio was the same as holding the coin. They passed because the coins rose.
      </p>
      <p>
        The timing test is where the result is clearest. If crossovers could time these coins, p-values would pile up near
        zero. They don't:
      </p>
      <TimingHistogram />
      <p>
        Only GateChain's p-value is below 0.05, where chance alone would give three or four coins. The coins move together
        and shuffling also removes volatility clustering, so I read the shape loosely; what matters is the missing cluster
        on the left.
      </p>
      <p>Out of sample, the picture matches. Medians across the {CROSSOVER_STUDY.length} coins at 0.15% costs:</p>
      <Table
        head={['Measure', 'Median']}
        rows={[
          ["Best crossover's Sharpe ratio, in sample", medianOf(c => c.inSampleSharpe).toFixed(2)],
          ["Walk-forward crossover's Sharpe ratio, out of sample", medianOf(c => c.walkForwardSharpe).toFixed(2)],
          ['Holding the coin over the same days', medianOf(c => c.holdingSharpe).toFixed(2)],
          ['Coins where walk-forward beat holding', percent(share(c => c.walkForwardSharpe > c.holdingSharpe))],
          ['Time in the market', percent(medianOf(c => c.timeInMarket))],
        ]}
      />
      <p>
        The best in-sample Sharpe ratio roughly halves out of sample, as selection bias predicts. What's left is a Sharpe
        ratio similar to holding, with half the exposure. That's a description of trend-following, not an edge.
      </p>

      <H2>What I changed because of it</H2>
      <p>
        The study set the design of the Signals tab, which now recomputes all of this every night for the top 100 coins:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Out-of-sample results come first,</strong> next to holding the coin over the same days. The best
          in-sample backtest is shown last, in a table.
        </li>
        <li>
          <strong>The deflated Sharpe ratio uses the implied number of independent trials,</strong> and says how many
          crossovers were tried.
        </li>
        <li>
          <strong>Every coin gets its own timing test,</strong> 200 shuffles a night, with a plain sentence: “No evidence
          of timing beyond chance” or “Better than chance at the 5% level”.
        </li>
        <li>
          <strong>Crossovers are described as trend, not as predictions.</strong> The tab says where the price stands
          against its averages and since when. It never says buy or sell.
        </li>
      </ul>
      {btc && (
        <p>
          On Bitcoin, with daily closes up to {btc.asOf}, the timing test gives p = {btc.timingPValue.toFixed(2)} and the
          walk-forward crossover's Sharpe ratio is {btc.walkForward.strategy.sharpe.toFixed(2)} against{' '}
          {btc.walkForward.holding.sharpe.toFixed(2)} for holding over {btc.walkForward.days} days.{' '}
          <Link to="/crypto/BTC?tab=signals" className="text-primary-600 hover:text-primary-700">
            See it live
          </Link>
          .
        </p>
      )}
      <p>
        The limits are real. It is one year of data, the coins come from today's top 100 (survivorship), the coins move
        together so {CROSSOVER_STUDY.length} tests are far fewer than {CROSSOVER_STUDY.length} independent ones, and spreads
        widen exactly when crossovers fire, so a flat cost flatters them. Most of these flatter the crossovers rather than
        hide an edge. The short history cuts both ways: a year is too little to detect a small edge, as well as to claim
        one.
      </p>

      <H2>Reproduce it</H2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <A href={`${SOURCE}/validation/notebooks/backtest.ipynb`}>The notebook</A>, with the derivations, calibration
          checks and all {CROSSOVER_STUDY.length} coins
        </li>
        <li>
          <A href={`${SOURCE}/validation/cql_validation/backtest.py`}>The Python reference</A>, checked against pandas and
          against the deflated Sharpe paper's worked example
        </li>
        <li>
          The production TypeScript, <A href={`${SOURCE}/backend/src/models/backtest.ts`}>backtest.ts</A> and{' '}
          <A href={`${SOURCE}/backend/src/models/sharpeInference.ts`}>sharpeInference.ts</A>, which matches the reference
          to 1e-12 in its tests
        </li>
        <li>
          <Link to="/methodology#signal-backtests" className="text-primary-600 hover:text-primary-700">
            The method on the Methodology page
          </Link>
        </li>
      </ul>

      <H2>References</H2>
      <ul className="space-y-2 text-sm">
        <li>
          Bailey, D. H. and López de Prado, M. (2012). The Sharpe ratio efficient frontier. <em>Journal of Risk</em>,
          15(2), 3–44.
        </li>
        <li>
          Bailey, D. H. and López de Prado, M. (2014). The deflated Sharpe ratio: correcting for selection bias, backtest
          overfitting and non-normality. <em>Journal of Portfolio Management</em>, 40(5), 94–107.
        </li>
        <li>
          Lo, A. W. (2002). The statistics of Sharpe ratios. <em>Financial Analysts Journal</em>, 58(4), 36–52.
        </li>
        <li>
          White, H. (2000). A reality check for data snooping. <em>Econometrica</em>, 68(5), 1097–1126.
        </li>
      </ul>
    </div>
  );
}
