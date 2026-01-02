import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeRangeSelector } from './TimeRangeSelector';
import { TimeRange } from '../types/crypto';

describe('TimeRangeSelector', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('rendering', () => {
    it('renders all time range buttons', () => {
      render(<TimeRangeSelector selected={TimeRange.DAY} onChange={mockOnChange} />);

      expect(screen.getByText('24H')).toBeInTheDocument();
      expect(screen.getByText('7D')).toBeInTheDocument();
      expect(screen.getByText('1M')).toBeInTheDocument();
      expect(screen.getByText('1Y')).toBeInTheDocument();
      expect(screen.getByText('All')).toBeInTheDocument();
    });

    it('renders 5 buttons total', () => {
      const { container } = render(<TimeRangeSelector selected={TimeRange.DAY} onChange={mockOnChange} />);
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(5);
    });

    it('has correct container styling', () => {
      const { container } = render(<TimeRangeSelector selected={TimeRange.DAY} onChange={mockOnChange} />);
      const containerDiv = container.firstChild;
      expect(containerDiv).toHaveClass('flex', 'space-x-2', 'bg-gray-100', 'p-1', 'rounded-lg');
    });
  });

  describe('selected state styling', () => {
    it('highlights the selected DAY button', () => {
      render(<TimeRangeSelector selected={TimeRange.DAY} onChange={mockOnChange} />);
      const dayButton = screen.getByText('24H');
      expect(dayButton).toHaveClass('bg-white', 'text-primary-600', 'shadow-sm');
    });

    it('highlights the selected WEEK button', () => {
      render(<TimeRangeSelector selected={TimeRange.WEEK} onChange={mockOnChange} />);
      const weekButton = screen.getByText('7D');
      expect(weekButton).toHaveClass('bg-white', 'text-primary-600', 'shadow-sm');
    });

    it('highlights the selected MONTH button', () => {
      render(<TimeRangeSelector selected={TimeRange.MONTH} onChange={mockOnChange} />);
      const monthButton = screen.getByText('1M');
      expect(monthButton).toHaveClass('bg-white', 'text-primary-600', 'shadow-sm');
    });

    it('highlights the selected YEAR button', () => {
      render(<TimeRangeSelector selected={TimeRange.YEAR} onChange={mockOnChange} />);
      const yearButton = screen.getByText('1Y');
      expect(yearButton).toHaveClass('bg-white', 'text-primary-600', 'shadow-sm');
    });

    it('highlights the selected ALL button', () => {
      render(<TimeRangeSelector selected={TimeRange.ALL} onChange={mockOnChange} />);
      const allButton = screen.getByText('All');
      expect(allButton).toHaveClass('bg-white', 'text-primary-600', 'shadow-sm');
    });

    it('applies unselected styling to non-selected buttons', () => {
      render(<TimeRangeSelector selected={TimeRange.DAY} onChange={mockOnChange} />);
      const weekButton = screen.getByText('7D');
      expect(weekButton).toHaveClass('text-gray-600', 'hover:text-gray-900');
      expect(weekButton).not.toHaveClass('bg-white', 'text-primary-600');
    });
  });

  describe('user interaction', () => {
    it('calls onChange when DAY button is clicked', async () => {
      const user = userEvent.setup();
      render(<TimeRangeSelector selected={TimeRange.WEEK} onChange={mockOnChange} />);

      const dayButton = screen.getByText('24H');
      await user.click(dayButton);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith(TimeRange.DAY);
    });

    it('calls onChange when WEEK button is clicked', async () => {
      const user = userEvent.setup();
      render(<TimeRangeSelector selected={TimeRange.DAY} onChange={mockOnChange} />);

      const weekButton = screen.getByText('7D');
      await user.click(weekButton);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith(TimeRange.WEEK);
    });

    it('calls onChange when MONTH button is clicked', async () => {
      const user = userEvent.setup();
      render(<TimeRangeSelector selected={TimeRange.DAY} onChange={mockOnChange} />);

      const monthButton = screen.getByText('1M');
      await user.click(monthButton);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith(TimeRange.MONTH);
    });

    it('calls onChange when YEAR button is clicked', async () => {
      const user = userEvent.setup();
      render(<TimeRangeSelector selected={TimeRange.DAY} onChange={mockOnChange} />);

      const yearButton = screen.getByText('1Y');
      await user.click(yearButton);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith(TimeRange.YEAR);
    });

    it('calls onChange when ALL button is clicked', async () => {
      const user = userEvent.setup();
      render(<TimeRangeSelector selected={TimeRange.DAY} onChange={mockOnChange} />);

      const allButton = screen.getByText('All');
      await user.click(allButton);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith(TimeRange.ALL);
    });

    it('allows clicking the already selected button', async () => {
      const user = userEvent.setup();
      render(<TimeRangeSelector selected={TimeRange.DAY} onChange={mockOnChange} />);

      const dayButton = screen.getByText('24H');
      await user.click(dayButton);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith(TimeRange.DAY);
    });

    it('handles multiple clicks', async () => {
      const user = userEvent.setup();
      render(<TimeRangeSelector selected={TimeRange.DAY} onChange={mockOnChange} />);

      await user.click(screen.getByText('7D'));
      await user.click(screen.getByText('1M'));
      await user.click(screen.getByText('1Y'));

      expect(mockOnChange).toHaveBeenCalledTimes(3);
      expect(mockOnChange).toHaveBeenNthCalledWith(1, TimeRange.WEEK);
      expect(mockOnChange).toHaveBeenNthCalledWith(2, TimeRange.MONTH);
      expect(mockOnChange).toHaveBeenNthCalledWith(3, TimeRange.YEAR);
    });
  });

  describe('button styling', () => {
    it('all buttons have base styling', () => {
      const { container } = render(<TimeRangeSelector selected={TimeRange.DAY} onChange={mockOnChange} />);
      const buttons = container.querySelectorAll('button');

      buttons.forEach((button) => {
        expect(button).toHaveClass('px-4', 'py-2', 'rounded-md', 'text-sm', 'font-medium', 'transition-colors');
      });
    });
  });
});
