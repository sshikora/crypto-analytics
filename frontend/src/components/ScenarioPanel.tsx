import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MetricCard, MetricInfo } from './MetricCard';
import { track } from '../services/analytics';
import { formatDollars, readPosition, savePosition } from '../services/position';
import { Scenario, ScenarioModelName } from '../types/crypto';

interface ScenarioPanelProps {
  scenario: Scenario;
}

const DEFAULT_DAYS = 30;
const HIGHLIGHTED_DRAWDOWN = 0.2;

const MODEL_DETAILS: Record<ScenarioModelName, { label: string; model: string; assumptions: string[] }> = {
  garchBootstrap: {
    label: 'GARCH bootstrap',
    model: 'GARCH(1,1) with bootstrapped standardized residuals (filtered historical simulation)',
    assumptions: [
      "Volatility starts at today's GARCH level, reacts to each simulated day and drifts towards its long-run level",
      "Each day's shock is one of the window's standardized returns drawn at random, so no distribution is assumed",
    ],
  },
  studentT: {
    label: 'Student-t',
    model: 'Independent Student-t daily returns, fitted by maximum likelihood',
    assumptions: ['Every day is drawn from the same fat-tailed distribution', 'Volatility stays the same over the horizon'],
  },
  normal: {
    label: 'Normal',
    model: 'Geometric Brownian motion',
    assumptions: ['Daily log returns are normal with the window’s volatility', 'Volatility stays the same over the horizon'],
  },
};

const percent = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

function signedDollars(amount: number): string {
  return amount < 0 ? `−${formatDollars(-amount)}` : `+${formatDollars(amount)}`;
}

function compactDollars(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumSignificantDigits: 3 }).format(amount);
}

export const ScenarioPanel: React.FC<ScenarioPanelProps> = ({ scenario }) => {
  const [position, setPosition] = useState(readPosition);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [modelName, setModelName] = useState<ScenarioModelName>('garchBootstrap');

  const model = scenario.models.find(m => m.model === modelName) ?? scenario.models[0];
  const horizon = model.horizons.find(h => h.days === days) ?? model.horizons[0];
  const horizonDays = scenario.models[0].horizons.map(h => h.days);
  const [at95, at99] = horizon.tailRisk;
  const end = model.fan[horizon.days - 1].quantiles;
  const highlighted = horizon.drawdownProbabilities.find(d => d.threshold === HIGHLIGHTED_DRAWDOWN);

  const choose = (next: { model?: ScenarioModelName; days?: number }) => {
    if (next.model) setModelName(next.model);
    if (next.days) setDays(next.days);
    track('run_scenario', { coinId: scenario.coinId, model: next.model ?? modelName, days: next.days ?? days });
  };

  const updatePosition = (value: string) => {
    const amount = Number(value);
    if (!(amount > 0)) return;
    setPosition(amount);
    savePosition(amount);
  };

  const info: MetricInfo = {
    model: MODEL_DETAILS[model.model].model,
    methodologyHref: '/methodology#monte-carlo',
    window: `${scenario.observations} daily log returns up to ${scenario.asOf}; ${scenario.paths.toLocaleString()} paths, recomputed nightly.`,
    assumptions: [
      ...MODEL_DETAILS[model.model].assumptions,
      "No drift: the average daily log return is set to zero, because a past window's average says little about the next one",
    ],
    validation:
      'Every simulated path matches a Python reference to 1e-12, and its random numbers match numpy bit for bit. Out of sample, 10-day VaR from each model was conservative on 83 coins.',
  };

  const fanData = [
    { day: 0, outer: [position, position], inner: [position, position], median: position },
    ...model.fan.slice(0, horizon.days).map(({ day, quantiles: [p05, p25, p50, p75, p95] }) => ({
      day,
      outer: [p05 * position, p95 * position],
      inner: [p25 * position, p75 * position],
      median: p50 * position,
    })),
  ];

  const distributionData = horizon.distribution.map(bin => ({
    pnl: ((bin.lower + bin.upper) / 2) * position,
    probability: bin.probability,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Scenario: Monte Carlo</h3>
        <p className="text-sm text-gray-500">
          {scenario.paths.toLocaleString()} simulated paths from the last {scenario.observations} daily returns, up to{' '}
          {format(parseISO(scenario.asOf), 'MMM d, yyyy')}, recomputed nightly
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm text-gray-700">
          Position size (USD)
          <input
            type="number"
            min="1"
            step="any"
            inputMode="decimal"
            defaultValue={position}
            onChange={event => updatePosition(event.target.value)}
            className="mt-1 block w-40 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <div role="group" aria-label="Horizon" className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {horizonDays.map(d => (
            <button
              key={d}
              type="button"
              aria-pressed={d === horizon.days}
              onClick={() => choose({ days: d })}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                d === horizon.days ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {d} days
            </button>
          ))}
        </div>
        <div role="group" aria-label="Model" className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1">
          {scenario.models.map(m => (
            <button
              key={m.model}
              type="button"
              aria-pressed={m.model === model.model}
              onClick={() => choose({ model: m.model })}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                m.model === model.model ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {MODEL_DETAILS[m.model].label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-600">
        The range of outcomes the last {scenario.observations} days' volatility implies for {formatDollars(position)} held
        for {horizon.days} days. Paths have no trend, so they stay roughly centred on today's price: this is a measure of
        risk, not a forecast of direction.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label={`VaR ${percent(at95.confidence)}, ${horizon.days} days`}
          value={at95.valueAtRisk > 0 ? formatDollars(at95.valueAtRisk * position) : 'No loss'}
          description={`Lost or worse in 1 path in 20. Average beyond it: ${formatDollars(Math.max(at95.expectedShortfall, 0) * position)}.`}
          info={info}
        />
        <MetricCard
          label={`VaR ${percent(at99.confidence)}, ${horizon.days} days`}
          value={at99.valueAtRisk > 0 ? formatDollars(at99.valueAtRisk * position) : 'No loss'}
          description={`Lost or worse in 1 path in 100. Average beyond it: ${formatDollars(Math.max(at99.expectedShortfall, 0) * position)}.`}
          info={info}
        />
        <MetricCard
          label="Middle 90% of Outcomes"
          value={`${signedDollars((end[0] - 1) * position)} to ${signedDollars((end[4] - 1) * position)}`}
          description={`Gain or loss after ${horizon.days} days, between the 5th and 95th percentiles of the paths.`}
          info={info}
        />
        {highlighted && (
          <MetricCard
            label={`Chance of a ${percent(highlighted.threshold)} Drawdown`}
            value={percent(highlighted.probability)}
            description={`Paths that fall ${percent(highlighted.threshold)} or more from a peak at some point within ${horizon.days} days.`}
            info={info}
          />
        )}
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">
          Value of the position each day. The dark band holds the middle half of the paths and the light band the middle
          90%; the line is the median.
        </p>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={fanData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" type="number" domain={[0, horizon.days]} tickFormatter={d => `${d}d`} stroke="#6b7280" fontSize={12} />
              <YAxis tickFormatter={compactDollars} stroke="#6b7280" fontSize={12} width={64} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(value: number | number[], name: string) => {
                  if (Array.isArray(value)) {
                    return [`${formatDollars(value[0])} to ${formatDollars(value[1])}`, name === 'outer' ? 'Middle 90%' : 'Middle 50%'];
                  }
                  return [formatDollars(value), 'Median'];
                }}
                labelFormatter={d => `Day ${d}`}
              />
              <ReferenceLine y={position} stroke="#9ca3af" strokeDasharray="6 3" />
              <Area type="monotone" dataKey="outer" stroke="none" fill="#bfdbfe" fillOpacity={0.7} isAnimationActive={false} />
              <Area type="monotone" dataKey="inner" stroke="none" fill="#60a5fa" fillOpacity={0.6} isAnimationActive={false} />
              <Line type="monotone" dataKey="median" stroke="#1d4ed8" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">
          Gain or loss after {horizon.days} days across the paths. The dashed line is the 95% VaR; the outer bars also hold
          the most extreme 0.5% of paths on each side.
        </p>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distributionData} barCategoryGap={1}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="pnl" type="number" domain={['auto', 'auto']} tickFormatter={compactDollars} stroke="#6b7280" fontSize={12} />
              <YAxis tickFormatter={v => percent(v)} stroke="#6b7280" fontSize={12} width={40} />
              <Tooltip
                formatter={(value: number) => [percent(value, 1), 'Share of paths']}
                labelFormatter={pnl => `About ${signedDollars(pnl as number)}`}
              />
              <ReferenceLine x={-at95.valueAtRisk * position} stroke="#374151" strokeDasharray="6 3" />
              <Bar dataKey="probability" isAnimationActive={false}>
                {distributionData.map(bin => (
                  <Cell key={bin.pnl} fill={bin.pnl < 0 ? '#f87171' : '#4ade80'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="text-left text-xs text-gray-500 mb-1">
            The three models over {horizon.days} days on {formatDollars(position)}
          </caption>
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="pr-4 py-1 font-medium">Model</th>
              <th className="pr-4 py-1 font-medium">Volatility now</th>
              <th className="pr-4 py-1 font-medium">VaR 95%</th>
              <th className="pr-4 py-1 font-medium">ES 95%</th>
              <th className="pr-4 py-1 font-medium">VaR 99%</th>
              {scenario.models[0].horizons[0].drawdownProbabilities.map(d => (
                <th key={d.threshold} className="pr-4 py-1 font-medium">
                  {percent(d.threshold)} drawdown
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenario.models.map(m => {
              const h = m.horizons.find(x => x.days === horizon.days) ?? m.horizons[0];
              return (
                <tr key={m.model} className={`border-t border-gray-100 ${m.model === model.model ? 'font-medium' : ''}`}>
                  <td className="pr-4 py-1">{MODEL_DETAILS[m.model].label}</td>
                  <td className="pr-4 py-1">{m.startingVolatility === null ? '—' : percent(m.startingVolatility)}</td>
                  <td className="pr-4 py-1">{formatDollars(Math.max(h.tailRisk[0].valueAtRisk, 0) * position)}</td>
                  <td className="pr-4 py-1">{formatDollars(Math.max(h.tailRisk[0].expectedShortfall, 0) * position)}</td>
                  <td className="pr-4 py-1">{formatDollars(Math.max(h.tailRisk[1].valueAtRisk, 0) * position)}</td>
                  {h.drawdownProbabilities.map(d => (
                    <td key={d.threshold} className="pr-4 py-1">
                      {d.probability < 0.005 && d.probability > 0 ? '< 1%' : percent(d.probability)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Volatility is annualized, for the first simulated day. In an out-of-sample test of 10-day VaR on 83 coins, all three
        models overstated risk and the GARCH bootstrap came closest, with losses beyond its 95% VaR in 3.7% of periods
        against 5% expected. With {scenario.paths.toLocaleString()} paths, a 30-day 95% VaR is precise to about a quarter of
        a percentage point.
      </p>
    </div>
  );
};
