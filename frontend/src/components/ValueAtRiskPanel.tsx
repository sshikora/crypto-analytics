import { useState } from 'react';
import { MetricCard, MetricInfo } from './MetricCard';
import { ValueAtRiskSummary, VarMethod, VarMethodResult } from '../types/crypto';

interface ValueAtRiskPanelProps {
  valueAtRisk: ValueAtRiskSummary;
  dataWindow: string;
}

const POSITION_STORAGE_KEY = 'cql.positionUsd';
const DEFAULT_POSITION = 10_000;

const METHOD_DETAILS: Record<VarMethod, { label: string; model: string; assumptions: string[] }> = {
  historical: {
    label: 'Historical',
    model: 'Historical simulation',
    assumptions: [
      'The next day looks like one of the last 180, each equally likely',
      'No shape is assumed for the distribution of returns',
    ],
  },
  normal: {
    label: 'Normal',
    model: 'Parametric, normal distribution',
    assumptions: [
      'Daily returns are normally distributed',
      'Mean and standard deviation estimated from the last 180 days',
    ],
  },
  studentT: {
    label: 'Student-t',
    model: 'Parametric, Student-t fitted by maximum likelihood',
    assumptions: [
      'Daily returns follow a Student-t distribution, which allows fatter tails than the normal',
      'Location, scale and degrees of freedom fitted to the last 180 days',
    ],
  },
  filteredHistorical: {
    label: 'GARCH-filtered',
    model: 'Filtered historical simulation with GARCH(1,1)',
    assumptions: [
      "Tomorrow's volatility comes from a GARCH(1,1) fitted to the last 180 days, so VaR rises quickly after turbulent days",
      "The shape of a bad day comes from the last 180 days' returns scaled by their GARCH volatility, not from an assumed distribution",
    ],
  },
};

function readPosition(): number {
  try {
    const stored = Number(localStorage.getItem(POSITION_STORAGE_KEY));
    return stored > 0 ? stored : DEFAULT_POSITION;
  } catch {
    return DEFAULT_POSITION;
  }
}

function formatDollars(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  }).format(amount);
}

function formatPValue(p: number): string {
  return p < 0.001 ? '< 0.001' : p.toFixed(3);
}

function oneDayIn(alpha: number): number {
  return Math.round(1 / alpha);
}

export const ValueAtRiskPanel: React.FC<ValueAtRiskPanelProps> = ({ valueAtRisk, dataWindow }) => {
  const [position, setPosition] = useState(readPosition);
  const [confidence, setConfidence] = useState(valueAtRisk.levels[0].confidence);

  const level = valueAtRisk.levels.find(l => l.confidence === confidence) ?? valueAtRisk.levels[0];
  const alpha = 1 - level.confidence;
  const percent = `${Math.round(level.confidence * 100)}%`;

  const updatePosition = (value: string) => {
    const amount = Number(value);
    if (!(amount > 0)) return;
    setPosition(amount);
    try {
      localStorage.setItem(POSITION_STORAGE_KEY, String(amount));
    } catch {
      // Storage can be unavailable (private browsing); the amount still applies for this visit
    }
  };

  const info = (result: VarMethodResult): MetricInfo => {
    const { backtest } = result;
    return {
      model: METHOD_DETAILS[result.method].model,
      methodologyHref: '/methodology#value-at-risk',
      window: dataWindow,
      assumptions: [
        ...METHOD_DETAILS[result.method].assumptions,
        `Backtest: ${backtest.exceptions} losses beyond VaR in ${backtest.days} days, each day's VaR using only the 180 days before it. Kupiec p = ${formatPValue(backtest.kupiecPValue)}, Christoffersen p = ${formatPValue(backtest.christoffersenPValue)}, conditional coverage p = ${formatPValue(backtest.conditionalCoveragePValue)}. Passes when both coverage p-values are at least 0.05.`,
      ],
      validation: 'VaR and expected shortfall, every backtest exception and all three test statistics match a Python reference built on numpy, scipy and statsmodels, on a year of daily Bitcoin prices.',
    };
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Value at Risk (1 day)</h3>
        <p className="text-sm text-gray-500">
          How much a position could lose in one day, from the last {valueAtRisk.windowDays} daily returns
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
        <div role="group" aria-label="Confidence level" className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {valueAtRisk.levels.map(l => (
            <button
              key={l.confidence}
              type="button"
              aria-pressed={l.confidence === confidence}
              onClick={() => setConfidence(l.confidence)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                l.confidence === confidence ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {Math.round(l.confidence * 100)}%
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-600">
        At {percent} confidence, the one-day loss on {formatDollars(position)} should exceed each method's VaR on about
        1 day in {oneDayIn(alpha)}. Expected shortfall is the average loss on those days.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {level.methods.map(result => {
          const { backtest } = result;
          const label =
            result.method === 'studentT'
              ? `${METHOD_DETAILS.studentT.label} (${valueAtRisk.studentTDegreesOfFreedom.toFixed(1)} degrees of freedom)`
              : METHOD_DETAILS[result.method].label;
          return (
            <MetricCard
              key={result.method}
              label={label}
              value={result.valueAtRisk > 0 ? formatDollars(result.valueAtRisk * position) : 'No loss'}
              description={
                result.valueAtRisk > 0
                  ? `Expected shortfall ${formatDollars(Math.max(result.expectedShortfall, 0) * position)}`
                  : `At ${percent}, this method's tail return is not a loss.`
              }
              info={info(result)}
            >
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded px-1.5 py-0.5 font-medium ${
                    backtest.passes ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {backtest.passes ? 'Backtest passes' : 'Backtest fails'}
                </span>
                <span className="text-gray-500">
                  {backtest.exceptions} of {backtest.days} days beyond VaR ({backtest.expectedExceptions.toFixed(1)} expected)
                </span>
              </p>
            </MetricCard>
          );
        })}
      </div>

      {level.confidence >= 0.99 && (
        <p className="text-xs text-gray-500">
          At 99%, fewer than {Math.ceil(level.methods[0].backtest.expectedExceptions)} exceptions are expected over the
          test period, so the backtest can only catch large errors.
        </p>
      )}
    </div>
  );
};
