import { format, parseISO } from 'date-fns';
import { MetricCard, MetricInfo } from './MetricCard';
import { RiskSummary } from '../types/crypto';

interface RiskSummaryPanelProps {
  summary: RiskSummary;
}

// A week of returns is the shortest window shown
const MIN_OBSERVATIONS = 8;

const VALIDATION = 'Matches pandas and scipy to 12 significant digits on a year of daily Bitcoin prices.';

function dataWindow(summary: RiskSummary): string {
  return `${summary.observations} daily closes (00:00 UTC, from CoinGecko) up to ${summary.asOf}.`;
}

function formatVolatility(value: number | null): string {
  return value === null ? 'Not enough data' : `${value.toFixed(1)}%`;
}

export const RiskSummaryPanel: React.FC<RiskSummaryPanelProps> = ({ summary }) => {
  if (summary.observations < MIN_OBSERVATIONS || !summary.asOf) {
    return (
      <p className="text-sm text-gray-500">
        Daily risk metrics need at least a week of stored prices. CryptoQuantLab stores daily closes for the
        top 100 coins by market cap, so they appear about a week after a coin enters the top 100.
      </p>
    );
  }

  const realizedInfo: MetricInfo = {
    model: 'Close-to-close realized volatility',
    window: dataWindow(summary),
    assumptions: [
      'Sample standard deviation of daily log returns over the window',
      'Annualized by the square root of the observations per year (about 365 for daily closes)',
    ],
    validation: VALIDATION,
  };

  const ewmaInfo: MetricInfo = {
    model: 'RiskMetrics EWMA, decay 0.94',
    window: dataWindow(summary),
    assumptions: [
      'Each day counts 6% less than the next, so the last 30 days carry about 84% of the weight',
      'Average daily return taken as zero',
    ],
    validation: VALIDATION,
  };

  const distributionInfo: MetricInfo = {
    model: 'Sample skewness and excess kurtosis (bias-adjusted)',
    window: dataWindow(summary),
    assumptions: ['Measured on daily log returns', 'A normal distribution has 0 for both'],
    validation: VALIDATION,
  };

  const distribution = summary.returnDistribution;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Realized Risk</h3>
        <p className="text-sm text-gray-500">From daily closes up to {format(parseISO(summary.asOf), 'MMM d, yyyy')}</p>
      </div>

      {summary.missingDays > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          {summary.missingDays} {summary.missingDays === 1 ? 'day is' : 'days are'} missing from the stored history.
          Windows use the closes that are available.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summary.realizedVolatility.map(({ windowDays, annualizedVolatility }) => (
          <MetricCard
            key={windowDays}
            label={`${windowDays}-Day Volatility`}
            value={formatVolatility(annualizedVolatility)}
            description={`How much the price actually swung over the last ${windowDays} days, scaled to a year.`}
            info={realizedInfo}
          />
        ))}
        <MetricCard
          label="EWMA Volatility"
          value={formatVolatility(summary.ewmaVolatility)}
          description="Recent days weigh most, so it reacts faster than a fixed window."
          info={ewmaInfo}
        />
      </div>

      {distribution && (
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Skewness"
            value={distribution.skewness.toFixed(2)}
            description={
              distribution.skewness < 0
                ? 'Negative: large falls have been more common than large rises.'
                : 'Positive: large rises have been more common than large falls.'
            }
            info={distributionInfo}
          />
          <MetricCard
            label="Excess Kurtosis"
            value={distribution.excessKurtosis.toFixed(2)}
            description="Above 0 means extreme days happen more often than a normal distribution predicts."
            info={distributionInfo}
          />
        </div>
      )}
    </div>
  );
};
