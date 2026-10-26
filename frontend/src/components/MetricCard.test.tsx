import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MetricCard } from './MetricCard';
import { track } from '../services/analytics';

vi.mock('../services/analytics', () => ({ track: vi.fn() }));

const info = {
  model: 'GARCH(1,1)',
  window: 'One year of daily prices',
  assumptions: ['Normal returns'],
  validation: 'Matches the Python reference',
};

function renderCard(props: Partial<React.ComponentProps<typeof MetricCard>> = {}) {
  return render(
    <MemoryRouter>
      <MetricCard label="Current Volatility" value="44.0%" description="Expected yearly swing" info={info} {...props} />
    </MemoryRouter>
  );
}

describe('MetricCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the value and the plain-English description', () => {
    renderCard();
    expect(screen.getByText('44.0%')).toBeInTheDocument();
    expect(screen.getByText('Expected yearly swing')).toBeInTheDocument();
  });

  it('opens the model details and records which model was viewed', () => {
    renderCard();
    const button = screen.getByRole('button', { name: 'About Current Volatility' });

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog')).toHaveTextContent('GARCH(1,1)');
    expect(screen.getByRole('dialog')).toHaveTextContent('Matches the Python reference');
    expect(track).toHaveBeenCalledWith('view_model', { model: 'GARCH(1,1)', metric: 'Current Volatility' });
  });

  it('closes on Escape and on a click outside', () => {
    renderCard();
    const button = screen.getByRole('button', { name: 'About Current Volatility' });

    fireEvent.click(button);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(button);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(track).toHaveBeenCalledTimes(2);
  });

  it('links to the methodology when a page is given', () => {
    renderCard({ info: { ...info, methodologyHref: '/methodology#garch' } });
    fireEvent.click(screen.getByRole('button', { name: 'About Current Volatility' }));
    expect(screen.getByRole('link', { name: 'Methodology →' })).toHaveAttribute('href', '/methodology#garch');
  });

  it('has no info button without model details', () => {
    renderCard({ info: undefined });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
