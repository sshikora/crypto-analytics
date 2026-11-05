import { format, parseISO } from 'date-fns';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MetricCard, MetricInfo } from './MetricCard';
import { CrossoverVariant, SignalSummary } from '../types/crypto';

interface SignalsPanelProps {
  signals: SignalSummary;
}

// The crossovers shown as cards; the table lists all of them
const HEADLINE = [
  { short: 1, long: 20 },
  { short: 1, long: 50 },
  { short: 1, long: 100 },
  { short: 20, long: 100 },
];
const SIGNIFICANCE = 0.05;

const percent = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
const signedPercent = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`;
const day = (date: string) => format(parseISO(date), 'MMM d, yyyy');

function crossoverName({ short, long }: { short: number; long: number }): string {
  return short === 1 ? `Price vs ${long}-day average` : `${short}-day vs ${long}-day average`;
}

function shortName({ short, long }: { short: number; long: number }): string {
  return short === 1 ? `price / ${long}d` : `${short}d / ${long}d`;
}

export const SignalsPanel: React.FC<SignalsPanelProps> = ({ signals }) => {
  const { walkForward: wf, best } = signals;
  const cost = percent(signals.cost, 2);
  const skill = signals.timingPValue < SIGNIFICANCE;
  const variant = (v: { short: number; long: number }) =>
    signals.variants.find(x => x.short === v.short && x.long === v.long) as CrossoverVariant;

  const info: MetricInfo = {
    model: 'Moving-average crossovers, backtested with walk-forward selection',
    methodologyHref: '/methodology#signal-backtests',
    window: `Daily closes up to ${signals.asOf}; ${signals.observations} days evaluated from ${signals.evaluatedFrom}, recomputed nightly.`,
    assumptions: [
      'In the market while the short average is above the long one, out of it otherwise; no short selling',
      `Trades at the daily close and pays ${cost} of the amount traded, fee plus slippage`,
      'A short average of 1 day is the price itself',
    ],
    validation:
      'Positions, costed returns, walk-forward choices and the Sharpe ratio tests match a Python reference checked against pandas and the deflated Sharpe ratio paper’s worked example.',
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Signals: Moving-Average Crossovers</h3>
        <p className="text-sm text-gray-500">
          {signals.variants.length} crossovers on daily closes up to {day(signals.asOf)}, backtested nightly at {cost} a
          trade
        </p>
        <p className="text-sm text-gray-600">
          A crossover is in the market while a short moving average is above a long one, and out of it otherwise. They
          describe the trend; the backtests below test whether they would have timed it better than holding the coin.
        </p>
      </div>

      <section className="space-y-3">
        <h4 className="font-medium">Now</h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {HEADLINE.map(h => {
            const v = variant(h);
            return (
              <MetricCard
                key={`${h.short}-${h.long}`}
                label={crossoverName(h)}
                value={v.position ? 'Above' : 'Below'}
                valueClassName={v.position ? 'text-green-600' : 'text-red-600'}
                description={v.since ? `Since ${day(v.since)}` : 'All of the last year'}
                info={info}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h4 className="font-medium">Out of sample</h4>
          <p className="text-sm text-gray-600">
            Every 30 days the crossover with the best Sharpe ratio over the previous 120 is chosen and followed for the
            next 30, so each day shown was unseen when its crossover was picked. Holding the coin over the same{' '}
            {wf.days} days is the comparison.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Sharpe Ratio"
            value={wf.strategy.sharpe.toFixed(2)}
            description={`Holding: ${wf.holding.sharpe.toFixed(2)}`}
            info={info}
          />
          <MetricCard
            label="Return"
            value={signedPercent(wf.strategy.totalReturn)}
            description={`Holding: ${signedPercent(wf.holding.totalReturn)}`}
            info={info}
          />
          <MetricCard
            label="Max Drawdown"
            value={percent(wf.strategy.maxDrawdown, 1)}
            description={`Holding: ${percent(wf.holding.maxDrawdown, 1)}. In the market ${percent(wf.timeInMarket)} of days.`}
            info={info}
          />
          <MetricCard
            label="Trades"
            value={wf.winRate === null ? `${wf.trades}` : `${percent(wf.winRate)} won`}
            description={[
              `${wf.closedTrades} closed`,
              wf.openTrade ? `one open since ${day(wf.openTrade.since)}, ${signedPercent(wf.openTrade.return)}` : null,
            ]
              .filter(Boolean)
              .join('; ') + '.'}
            info={info}
          />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Growth of 1 from {day(wf.from)}, after trading costs</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wf.equity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={d => format(parseISO(d), 'MMM d')} stroke="#6b7280" fontSize={12} minTickGap={24} />
                <YAxis domain={['auto', 'auto']} tickFormatter={v => v.toFixed(2)} stroke="#6b7280" fontSize={12} width={40} />
                <Tooltip
                  formatter={(value: number, name: string) => [value.toFixed(3), name === 'strategy' ? 'Walk-forward crossover' : 'Holding']}
                  labelFormatter={d => day(d as string)}
                />
                <ReferenceLine y={1} stroke="#9ca3af" strokeDasharray="6 3" />
                <Line type="linear" dataKey="holding" stroke="#9ca3af" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line type="linear" dataKey="strategy" stroke="#2563eb" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Blue: walk-forward crossover. Grey: holding. Chosen:{' '}
            {wf.folds.map(f => `${shortName(f)} from ${format(parseISO(f.from), 'MMM d')}`).join(', ')}.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h4 className="font-medium">Is it skill?</h4>
          <p className="text-sm text-gray-600">
            The best of {signals.variants.length} crossovers over the year was {shortName(best)}, with a Sharpe ratio of{' '}
            {best.sharpe.toFixed(2)} against {signals.holding.sharpe.toFixed(2)} for holding. Trying many crossovers and
            keeping the best one flatters it, so two tests allow for that.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MetricCard
            label="Timing Test"
            value={`p = ${signals.timingPValue.toFixed(2)}`}
            valueClassName={skill ? 'text-green-600' : 'text-gray-900'}
            description={`${
              skill ? 'Better than chance at the 5% level.' : 'No evidence of timing beyond chance.'
            } In ${percent(signals.timingPValue)} of ${signals.shuffles} reruns on this coin's own daily returns in shuffled order, the best crossover did at least as well. Shuffling keeps the trend and removes any order to time.`}
            info={info}
          />
          <MetricCard
            label="Deflated Sharpe Ratio"
            value={percent(best.deflatedSharpe)}
            description={`Chance that ${shortName(best)}'s true Sharpe ratio is above zero, allowing for ${signals.variants.length} crossovers tried (about ${signals.impliedTrials.toFixed(1)} independent ones) and fat tails. ${percent(best.probabilisticSharpe)} before allowing for the search. Above zero is not the same as better than holding.`}
            info={info}
          />
        </div>
        <p className="text-xs text-gray-500">
          In a study of 70 coins from October 2025 to November 2026, the timing test found one below 0.05, fewer than
          chance alone would give.
        </p>
      </section>

      <div>
        <p className="text-xs text-gray-500 mb-1">
          Every crossover over {signals.observations} days from {day(signals.evaluatedFrom)}, after costs. Holding: Sharpe{' '}
          {signals.holding.sharpe.toFixed(2)}, return {signedPercent(signals.holding.totalReturn)}.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pr-4 py-1 font-medium">Crossover</th>
                <th className="pr-4 py-1 font-medium">Now</th>
                <th className="pr-4 py-1 font-medium">Since</th>
                <th className="pr-4 py-1 font-medium">Sharpe</th>
                <th className="pr-4 py-1 font-medium">Return</th>
                <th className="pr-4 py-1 font-medium">Trades</th>
                <th className="py-1 font-medium">In the market</th>
              </tr>
            </thead>
            <tbody>
              {signals.variants.map(v => (
                <tr
                  key={`${v.short}-${v.long}`}
                  className={`border-t border-gray-100 ${v.short === best.short && v.long === best.long ? 'font-medium' : ''}`}
                >
                  <td className="pr-4 py-1 whitespace-nowrap">{shortName(v)}</td>
                  <td className={`pr-4 py-1 ${v.position ? 'text-green-600' : 'text-red-600'}`}>{v.position ? 'Above' : 'Below'}</td>
                  <td className="pr-4 py-1 whitespace-nowrap">{v.since ? format(parseISO(v.since), 'MMM d') : '—'}</td>
                  <td className="pr-4 py-1">{v.sharpe.toFixed(2)}</td>
                  <td className="pr-4 py-1">{signedPercent(v.totalReturn)}</td>
                  <td className="pr-4 py-1">{v.trades}</td>
                  <td className="py-1">{percent(v.timeInMarket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
