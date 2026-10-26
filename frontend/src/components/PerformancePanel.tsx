import { format, parseISO } from 'date-fns';
import { MetricCard, MetricInfo } from './MetricCard';
import { PerformanceSummary } from '../types/crypto';

interface PerformancePanelProps {
  performance: PerformanceSummary;
  coinId: string;
  asOf: string;
  closes: number;
}

const VALIDATION = 'Matches a Python reference checked against pandas and scipy to 12 significant digits on a year of daily Bitcoin and Ethereum prices.';

function percent(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

function ratio(x: number | null): string {
  return x === null ? 'Not defined' : x.toFixed(2);
}

function day(date: string): string {
  return format(parseISO(date), 'MMM d, yyyy');
}

export const PerformancePanel: React.FC<PerformancePanelProps> = ({ performance, coinId, asOf, closes }) => {
  const window = `${closes} daily closes (00:00 UTC, from CoinGecko) up to ${asOf}.`;
  const ratioInfo = (model: string, assumptions: string[]): MetricInfo => ({
    model,
    window,
    assumptions: [...assumptions, 'Risk-free rate taken as 0, the usual convention for crypto'],
    validation: VALIDATION,
  });
  const drawdownInfo: MetricInfo = {
    model: 'Drawdown from the running high',
    window,
    assumptions: ['Drawdown is the close divided by the highest close so far, minus 1', 'Highs before the window are not counted'],
    validation: VALIDATION,
  };
  const betaInfo: MetricInfo = {
    model: "Ordinary least squares of the coin's daily returns on Bitcoin's",
    window,
    assumptions: ['Only dates both coins have are used', 'A beta of 1 means the coin moves one for one with Bitcoin on average'],
    validation: 'Matches scipy linregress to 12 significant digits for Ethereum against Bitcoin.',
  };
  const { drawdown } = performance;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Return and Drawdown</h3>
        <p className="text-sm text-gray-500">From daily closes up to {day(asOf)}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Annualized Return"
          value={percent(performance.annualizedReturn)}
          description="The yearly rate that compounds the first close into the last."
          info={ratioInfo('Geometric annualized return', ['(last close / first close) ^ (days per year / days) - 1'])}
          valueClassName={performance.annualizedReturn < 0 ? 'text-red-600' : 'text-green-600'}
        />
        <MetricCard
          label="Sharpe Ratio"
          value={ratio(performance.sharpeRatio)}
          description="Return per unit of volatility, annualized."
          info={ratioInfo('Sharpe ratio', ['Mean daily return divided by its standard deviation, times the square root of days per year'])}
        />
        <MetricCard
          label="Sortino Ratio"
          value={ratio(performance.sortinoRatio)}
          description="Like Sharpe, but only counts downside swings as risk."
          info={ratioInfo('Sortino ratio', ['Mean daily return divided by the root mean square of the negative returns', 'Not defined when there were no down days'])}
        />
        <MetricCard
          label="Calmar Ratio"
          value={ratio(performance.calmarRatio)}
          description="Annualized return divided by the largest drawdown."
          info={ratioInfo('Calmar ratio', ['Annualized return divided by the size of the maximum drawdown', 'Not defined when the price never fell below a high'])}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard
          label="Maximum Drawdown"
          value={percent(drawdown.maxDrawdown)}
          description={`From ${day(drawdown.peakDate)} to ${day(drawdown.troughDate)}. ${
            drawdown.recoveryDate ? `Recovered on ${day(drawdown.recoveryDate)}.` : 'Not recovered yet.'
          }`}
          info={drawdownInfo}
          valueClassName="text-red-600"
        />
        <MetricCard
          label="Current Drawdown"
          value={percent(drawdown.currentDrawdown)}
          description="How far the latest close is below the highest close in the window."
          info={drawdownInfo}
        />
        <MetricCard
          label="Longest Drawdown"
          value={`${drawdown.longestDrawdownDays} days`}
          description="The most consecutive days spent below a previous high."
          info={drawdownInfo}
        />
      </div>

      {coinId !== 'bitcoin' && performance.betaToBitcoin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {performance.betaToBitcoin.map(b => (
            <MetricCard
              key={b.windowDays}
              label={b.windowDays === 365 ? 'Beta to Bitcoin (1 year)' : `Beta to Bitcoin (${b.windowDays} days)`}
              value={b.beta.toFixed(2)}
              description={`On average it moved ${b.beta.toFixed(2)} times Bitcoin's daily move. Correlation ${b.correlation.toFixed(2)} over ${b.observations} days.`}
              info={betaInfo}
            />
          ))}
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Worst Days</h4>
        <table className="w-full max-w-md text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="py-1 font-medium">Date</th>
              <th className="py-1 font-medium text-right">Daily return</th>
            </tr>
          </thead>
          <tbody>
            {performance.worstDays.map(d => (
              <tr key={d.date} className="border-t border-gray-100">
                <td className="py-1">{day(d.date)}</td>
                <td className="py-1 text-right text-red-600">{percent(d.return, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-500 mt-2">
          Worst 7 days: {percent(performance.worstWeek.return)} from {day(performance.worstWeek.startDate)} to{' '}
          {day(performance.worstWeek.endDate)}.
        </p>
      </div>
    </div>
  );
};
