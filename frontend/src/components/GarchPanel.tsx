import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { MetricCard, MetricInfo } from './MetricCard';
import { GarchSummary } from '../types/crypto';

interface GarchPanelProps {
  garch: GarchSummary;
  asOf: string;
  closes: number;
}

const SIGNIFICANCE = 0.05;

function formatHalfLife(days: number): string {
  if (days > 365) return 'Over a year';
  return days < 10 ? `${days.toFixed(1)} days` : `${Math.round(days)} days`;
}

function formatPValue(p: number): string {
  return p < 0.001 ? '< 0.001' : p.toFixed(3);
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
      {children}
    </span>
  );
}

export const GarchPanel: React.FC<GarchPanelProps> = ({ garch, asOf, closes }) => {
  const info: MetricInfo = {
    model: 'GARCH(1,1), fitted by maximum likelihood',
    window: `${closes} daily closes (00:00 UTC, from CoinGecko) up to ${asOf}.`,
    assumptions: [
      "Today's variance depends on yesterday's variance and yesterday's surprise",
      'Returns are normally distributed around their average once scaled by that variance',
      'Forecasts average the daily variance over the horizon, then annualize',
    ],
    validation:
      'Parameters and likelihood match an independent Python implementation, and the arch package, on a year of daily Bitcoin and on simulated data with known parameters. Ljung-Box matches statsmodels.',
  };

  const lowest = Math.floor(Math.min(...garch.normalQq.map(p => Math.min(p.theoretical, p.sample))));
  const highest = Math.ceil(Math.max(...garch.normalQq.map(p => Math.max(p.theoretical, p.sample))));
  const qqTicks = Array.from({ length: highest - lowest + 1 }, (_, i) => lowest + i);
  const residualsClean = garch.ljungBoxResiduals.pValue >= SIGNIFICANCE;
  const clusteringCaptured = garch.ljungBoxSquaredResiduals.pValue >= SIGNIFICANCE;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Volatility Model: GARCH(1,1)</h3>
        <p className="text-sm text-gray-500">
          From daily closes up to {format(parseISO(asOf), 'MMM d, yyyy')} — α={garch.alpha.toFixed(4)}, β=
          {garch.beta.toFixed(4)}, ω={garch.omega.toExponential(2)}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Current Volatility"
          value={`${garch.currentVolatility.toFixed(1)}%`}
          description="The model's estimate for the latest day, scaled to a year."
          info={info}
          valueClassName="text-orange-600"
        />
        <MetricCard
          label="Long-Run Volatility"
          value={`${garch.longRunVolatility.toFixed(1)}%`}
          description="The level volatility drifts back to as recent shocks fade."
          info={info}
          valueClassName="text-blue-600"
        />
        <MetricCard
          label="Persistence (α+β)"
          value={garch.persistence.toFixed(4)}
          description="How long a volatility shock lingers. Closer to 1 means it fades more slowly."
          info={info}
        />
        <MetricCard
          label="Half-Life"
          value={formatHalfLife(garch.halfLifeDays)}
          description="Time for a volatility shock to fade by half."
          info={info}
        />
      </div>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={garch.conditionalVolatility}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tickFormatter={d => format(parseISO(d), 'MMM d')} stroke="#6b7280" fontSize={12} minTickGap={24} />
            <YAxis tickFormatter={v => `${v}%`} stroke="#6b7280" fontSize={12} domain={['auto', 'auto']} />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Conditional volatility']}
              labelFormatter={d => format(parseISO(d as string), 'MMM d, yyyy')}
            />
            <ReferenceLine y={garch.longRunVolatility} stroke="#3b82f6" strokeDasharray="6 3" />
            <Line type="monotone" dataKey="annualizedVolatility" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {garch.forecast.map(({ days, annualizedVolatility }) => (
          <MetricCard
            key={days}
            label={days === 1 ? 'Forecast: Next Day' : `Forecast: Next ${days} Days`}
            value={`${annualizedVolatility.toFixed(1)}%`}
            description={days === 1 ? 'Expected volatility for tomorrow, scaled to a year.' : `Expected average volatility over the next ${days} days, scaled to a year.`}
            info={info}
          />
        ))}
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <div>
          <h4 className="text-sm font-medium text-gray-700">Model Diagnostics</h4>
          <p className="text-xs text-gray-500">
            Log-likelihood {garch.logLikelihood.toFixed(1)} · AIC {garch.aic.toFixed(1)} · BIC {garch.bic.toFixed(1)} on{' '}
            {garch.observations} days (4 parameters)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricCard
            label="Ljung-Box, Residuals (10 lags)"
            value={`p = ${formatPValue(garch.ljungBoxResiduals.pValue)}`}
            description={
              residualsClean
                ? 'No autocorrelation left in the scaled returns.'
                : "The scaled returns are still autocorrelated: GARCH models volatility, not the direction of returns."
            }
            info={info}
          >
            <p className="mt-2">
              <Badge ok={residualsClean}>{residualsClean ? 'Passes' : 'Autocorrelation remains'}</Badge>
            </p>
          </MetricCard>
          <MetricCard
            label="Ljung-Box, Squared Residuals (10 lags)"
            value={`p = ${formatPValue(garch.ljungBoxSquaredResiduals.pValue)}`}
            description={
              clusteringCaptured
                ? 'The model has absorbed the volatility clustering.'
                : 'Some volatility clustering is left that the model does not capture.'
            }
            info={info}
          >
            <p className="mt-2">
              <Badge ok={clusteringCaptured}>{clusteringCaptured ? 'Passes' : 'Clustering remains'}</Badge>
            </p>
          </MetricCard>
          <MetricCard
            label="Residual Excess Kurtosis"
            value={garch.standardizedExcessKurtosis.toFixed(2)}
            description="0 if scaled returns were normal. Above 0 means tails fatter than the model assumes."
            info={info}
          />
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">
            Scaled returns against a normal distribution. Points off the dashed line in the corners are fat tails.
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" dataKey="theoretical" name="Normal quantile" domain={[lowest, highest]} ticks={qqTicks} stroke="#6b7280" fontSize={12} />
                <YAxis type="number" dataKey="sample" name="Scaled return" domain={[lowest, highest]} ticks={qqTicks} stroke="#6b7280" fontSize={12} />
                <Tooltip formatter={(value: number) => value.toFixed(2)} />
                <ReferenceLine segment={[{ x: lowest, y: lowest }, { x: highest, y: highest }]} stroke="#9ca3af" strokeDasharray="6 3" />
                <Scatter data={garch.normalQq} fill="#f97316" isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
