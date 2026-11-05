// The position size a visitor types on the Risk or Scenario tab, remembered across coins and visits

const POSITION_STORAGE_KEY = 'cql.positionUsd';
const DEFAULT_POSITION = 10_000;

export function readPosition(): number {
  try {
    const stored = Number(localStorage.getItem(POSITION_STORAGE_KEY));
    return stored > 0 ? stored : DEFAULT_POSITION;
  } catch {
    return DEFAULT_POSITION;
  }
}

export function savePosition(amount: number): void {
  try {
    localStorage.setItem(POSITION_STORAGE_KEY, String(amount));
  } catch {
    // Storage can be unavailable (private browsing); the amount still applies for this visit
  }
}

export function formatDollars(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Math.abs(amount) >= 100 ? 0 : 2,
  }).format(amount);
}
