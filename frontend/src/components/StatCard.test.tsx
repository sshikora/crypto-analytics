import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  describe('basic rendering', () => {
    it('renders title and value', () => {
      render(<StatCard title="Market Cap" value="$1.2T" />);
      expect(screen.getByText('Market Cap')).toBeInTheDocument();
      expect(screen.getByText('$1.2T')).toBeInTheDocument();
    });

    it('renders numeric value', () => {
      render(<StatCard title="Total Volume" value={1234567} />);
      expect(screen.getByText('Total Volume')).toBeInTheDocument();
      expect(screen.getByText('1234567')).toBeInTheDocument();
    });

    it('renders without subtitle when not provided', () => {
      const { container } = render(<StatCard title="Price" value="$50,000" />);
      const subtitles = container.querySelectorAll('.text-xs');
      expect(subtitles.length).toBe(0);
    });

    it('renders subtitle when provided', () => {
      render(<StatCard title="Price" value="$50,000" subtitle="+2.5% today" />);
      expect(screen.getByText('+2.5% today')).toBeInTheDocument();
    });

    it('renders without icon when not provided', () => {
      const { container } = render(<StatCard title="Price" value="$50,000" />);
      const iconDiv = container.querySelector('.text-gray-400');
      expect(iconDiv).toBeNull();
    });

    it('renders icon when provided', () => {
      const icon = <span data-testid="test-icon">📈</span>;
      render(<StatCard title="Price" value="$50,000" icon={icon} />);
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });
  });

  describe('trend colors', () => {
    it('applies green color for up trend', () => {
      render(<StatCard title="Price" value="$50,000" trend="up" />);
      const valueElement = screen.getByText('$50,000');
      expect(valueElement).toHaveClass('text-green-600');
    });

    it('applies red color for down trend', () => {
      render(<StatCard title="Price" value="$45,000" trend="down" />);
      const valueElement = screen.getByText('$45,000');
      expect(valueElement).toHaveClass('text-red-600');
    });

    it('applies gray color for neutral trend', () => {
      render(<StatCard title="Price" value="$50,000" trend="neutral" />);
      const valueElement = screen.getByText('$50,000');
      expect(valueElement).toHaveClass('text-gray-600');
    });

    it('applies gray color when no trend is provided', () => {
      render(<StatCard title="Price" value="$50,000" />);
      const valueElement = screen.getByText('$50,000');
      expect(valueElement).toHaveClass('text-gray-600');
    });
  });

  describe('complex rendering', () => {
    it('renders all props together', () => {
      const icon = <span data-testid="test-icon">📊</span>;
      render(
        <StatCard
          title="Market Cap"
          value="$1.2T"
          subtitle="Increased 5%"
          trend="up"
          icon={icon}
        />
      );

      expect(screen.getByText('Market Cap')).toBeInTheDocument();
      expect(screen.getByText('$1.2T')).toBeInTheDocument();
      expect(screen.getByText('Increased 5%')).toBeInTheDocument();
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
      expect(screen.getByText('$1.2T')).toHaveClass('text-green-600');
    });
  });

  describe('styling', () => {
    it('has card styling', () => {
      const { container } = render(<StatCard title="Test" value="123" />);
      const card = container.querySelector('.card');
      expect(card).toBeInTheDocument();
    });

    it('subtitle has correct styling', () => {
      render(<StatCard title="Test" value="123" subtitle="subtitle text" />);
      const subtitle = screen.getByText('subtitle text');
      expect(subtitle).toHaveClass('text-xs', 'text-gray-400', 'mt-1');
    });

    it('title has correct styling', () => {
      render(<StatCard title="Test Title" value="123" />);
      const title = screen.getByText('Test Title');
      expect(title).toHaveClass('text-sm', 'text-gray-500', 'mb-1');
    });

    it('value has correct base styling', () => {
      render(<StatCard title="Test" value="123" />);
      const value = screen.getByText('123');
      expect(value).toHaveClass('text-2xl', 'font-bold');
    });
  });
});
