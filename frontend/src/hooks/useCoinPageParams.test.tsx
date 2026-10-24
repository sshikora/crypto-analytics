import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useCoinPageParams } from './useCoinPageParams';
import { TimeRange } from '../types/crypto';

function renderAt(url: string, defaultRange = TimeRange.MONTH) {
  return renderHook(
    () => ({ params: useCoinPageParams(defaultRange), location: useLocation() }),
    { wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter> }
  );
}

describe('useCoinPageParams', () => {
  it('defaults to the overview tab and the given range', () => {
    const { result } = renderAt('/crypto/BTC', TimeRange.YEAR);
    expect(result.current.params.tab).toBe('overview');
    expect(result.current.params.range).toBe(TimeRange.YEAR);
  });

  it('reads the tab and range from the URL', () => {
    const { result } = renderAt('/crypto/BTC?tab=risk&range=7d');
    expect(result.current.params.tab).toBe('risk');
    expect(result.current.params.range).toBe(TimeRange.WEEK);
  });

  it('falls back to defaults for unknown values', () => {
    const { result } = renderAt('/crypto/BTC?tab=scenario&range=5y');
    expect(result.current.params.tab).toBe('overview');
    expect(result.current.params.range).toBe(TimeRange.MONTH);
  });

  it('writes the tab and range to the URL, dropping the default tab', () => {
    const { result } = renderAt('/crypto/BTC?range=1y');

    act(() => result.current.params.setTab('risk'));
    expect(result.current.location.search).toBe('?range=1y&tab=risk');

    act(() => result.current.params.setRange(TimeRange.DAY));
    expect(result.current.location.search).toBe('?range=24h&tab=risk');

    act(() => result.current.params.setTab('overview'));
    expect(result.current.location.search).toBe('?range=24h');
  });
});
