import { useState } from 'react';
import { useQuery } from '@apollo/client';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  BarChart,
} from 'recharts';
import { format } from 'date-fns';
import { GET_VOLATILITY_MODEL } from '../services/queries';
import { TimeRange } from '../types/crypto';
import { MetricCard, MetricInfo } from './MetricCard';

interface VolatilityChartProps {
  symbol: string;
}

const GARCH_INFO: MetricInfo = {
  model: 'GARCH(1,1), fitted by maximum likelihood',
  window: 'CoinGecko prices for the selected range. Shorter ranges use finer price intervals, so a "period" is shorter.',
  assumptions: [
    'Returns are normally distributed around their average',
    "Today's variance depends on yesterday's variance and yesterday's surprise",
    'Annualized from the average spacing of the price data',
  ],
  validation:
    'Matches an independent Python implementation on a year of daily Bitcoin prices and on simulated data with known parameters.',
};

const TIME_RANGES = [
  { value: TimeRange.WEEK, label: '1W' },
  { value: TimeRange.MONTH, label: '1M' },
  { value: TimeRange.YEAR, label: '1Y' },
  { value: TimeRange.ALL, label: 'ALL' },
];

export const VolatilityChart: React.FC<VolatilityChartProps> = ({ symbol }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>(TimeRange.MONTH);

  const { data, loading, error } = useQuery(GET_VOLATILITY_MODEL, {
    variables: { symbol, timeRange },
  });

  const model = data?.volatilityModel;

  const chartData = model?.conditionalVolatility.map((point: { timestamp: string; annualizedVolatility: number }) => ({
    timestamp: new Date(point.timestamp).getTime(),
    volatility: parseFloat(point.annualizedVolatility.toFixed(2)),
  })) ?? [];

  const forecastData = model?.forecast.map((f: { horizon: number; annualizedVolatility: number }) => ({
    label: f.horizon === 1 ? '1 day' : `${f.horizon} days`,
    volatility: parseFloat(f.annualizedVolatility.toFixed(2)),
  })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Volatility Model</h3>
          {model && (
            <p className="text-sm text-gray-500">{model.modelType} — α={model.alpha.toFixed(4)}, β={model.beta.toFixed(4)}, ω={model.omega.toExponential(2)}</p>
          )}
        </div>
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
          {TIME_RANGES.map(range => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                timeRange === range.value
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {model && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Current Volatility"
            value={`${model.currentVolatility.toFixed(1)}%`}
            description="How much the price is expected to swing over a year at today's level of turbulence."
            info={GARCH_INFO}
            valueClassName="text-orange-600"
          />
          <MetricCard
            label="Long-Run Volatility"
            value={`${model.longRunVolatility.toFixed(1)}%`}
            description="The level volatility drifts back to as recent shocks fade."
            info={GARCH_INFO}
            valueClassName="text-blue-600"
          />
          <MetricCard
            label="Persistence (α+β)"
            value={model.persistence.toFixed(4)}
            description="How long a volatility shock lingers. Closer to 1 means it fades more slowly."
            info={GARCH_INFO}
          />
          <MetricCard
            label="Half-Life"
            value={
              model.persistence < 1
                ? `${Math.round(Math.log(0.5) / Math.log(model.persistence))} periods`
                : '∞'
            }
            description="Price intervals until a volatility shock has faded by half."
            info={GARCH_INFO}
          />
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-[300px] text-red-500 text-sm">
          {error.message}
        </div>
      )}

      {!loading && !error && chartData.length > 0 && (
        <>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={ts => format(new Date(ts), 'MMM dd')}
                  stroke="#6b7280"
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={v => `${v}%`}
                  stroke="#6b7280"
                  fontSize={12}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Annualized Volatility']}
                  labelFormatter={label => format(new Date(label), 'PPpp')}
                />
                <Legend />
                {model && (
                  <ReferenceLine
                    y={parseFloat(model.longRunVolatility.toFixed(2))}
                    stroke="#3b82f6"
                    strokeDasharray="6 3"
                    label={{ value: 'Long-Run', position: 'insideTopRight', fontSize: 11, fill: '#3b82f6' }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="volatility"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  name="Conditional Volatility"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {forecastData.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Volatility Forecast</h4>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecastData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="label" stroke="#6b7280" fontSize={12} />
                    <YAxis
                      tickFormatter={v => `${v}%`}
                      stroke="#6b7280"
                      fontSize={12}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: number) => [`${value.toFixed(2)}%`, 'Forecast Volatility']}
                    />
                    <Bar dataKey="volatility" fill="#8b5cf6" name="Forecast Volatility" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
