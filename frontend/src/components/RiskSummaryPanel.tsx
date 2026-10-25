import { format, parseISO } from 'date-fns';
import { MetricCard, MetricInfo } from './MetricCard';
import { ValueAtRiskPanel } from './ValueAtRiskPanel';
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
  const forecast = summary.volatilityForecast;

  const forecastInfo: MetricInfo = {
    model: 'HAR-RV (Corsi 2009), estimated by least squares',
    window: dataWindow(summary),
    assumptions: [
      "Each day's squared return stands in for its realized variance, since only daily closes are stored",
      'Tomorrow depends on the last day, the last 7 days and the last 30 days',
      "Longer horizons feed each day's forecast back in as that day's value",
    ],
    validation: 'Coefficients and forecasts match statsmodels to 9 significant digits on a year of daily Bitcoin prices.',
  };

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

      {forecast && (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-gray-700">Volatility Forecast (HAR-RV)</h4>
            <p className="text-xs text-gray-500">
              Daily {forecast.coefficients.daily.toFixed(3)} · weekly {forecast.coefficients.weekly.toFixed(3)} ·
              monthly {forecast.coefficients.monthly.toFixed(3)} · R² {forecast.rSquared.toFixed(2)} on{' '}
              {forecast.observations} days
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {forecast.horizons.map(({ days, annualizedVolatility }) => (
              <MetricCard
                key={days}
                label={days === 1 ? 'Next Day' : `Next ${days} Days`}
                value={`${annualizedVolatility.toFixed(1)}%`}
                description={
                  days === 1
                    ? "Expected volatility for tomorrow, scaled to a year."
                    : `Expected average volatility over the next ${days} days, scaled to a year.`
                }
                info={forecastInfo}
              />
            ))}
          </div>
        </div>
      )}

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

      {summary.valueAtRisk && (
        <div className="border-t border-gray-200 pt-4">
          <ValueAtRiskPanel valueAtRisk={summary.valueAtRisk} dataWindow={dataWindow(summary)} />
        </div>
      )}
    </div>
  );
};
