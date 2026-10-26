import { Link } from 'react-router-dom';
import { Regime } from '../types/crypto';

interface RegimeBadgeProps {
  regime: Regime;
  compact?: boolean;
}

// One ordinal scale for volatility, and the words are always shown, so the badge never relies on colour alone
const LEVEL_STYLES: Record<Regime['volatilityLevel'], string> = {
  low: 'bg-sky-50 text-sky-800 ring-sky-200',
  normal: 'bg-amber-50 text-amber-800 ring-amber-200',
  high: 'bg-red-50 text-red-800 ring-red-200',
};

export function describeRegime(regime: Regime): string {
  const trend = regime.trend === 'up' ? 'Uptrend' : 'Downtrend';
  return `${trend} · ${regime.volatilityLevel} volatility`;
}

export const RegimeBadge: React.FC<RegimeBadgeProps> = ({ regime, compact = false }) => {
  const percentile = Math.round(regime.volatilityPercentile * 100);
  const detail =
    `Price is ${Math.abs((regime.priceToMovingAverage - 1) * 100).toFixed(1)}% ` +
    `${regime.priceToMovingAverage >= 1 ? 'above' : 'below'} its 200-day average. ` +
    `30-day volatility is at least as high as on ${percentile}% of days in the past year.`;
  const className = `inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${LEVEL_STYLES[regime.volatilityLevel]}`;

  if (compact) {
    return (
      <span className={className} title={detail}>
        {regime.trend === 'up' ? '↑' : '↓'} {regime.volatilityLevel}
      </span>
    );
  }
  return (
    <Link to="/methodology#regime" className={className} title={detail}>
      {regime.trend === 'up' ? '↑' : '↓'} {describeRegime(regime)}
    </Link>
  );
};
