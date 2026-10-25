import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Tabs, TabItem } from './Tabs';

const TABS: TabItem<'one' | 'two' | 'three'>[] = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'three', label: 'Three' },
];

function Harness() {
  const [selected, setSelected] = useState<'one' | 'two' | 'three'>('one');
  return <Tabs tabs={TABS} selected={selected} onSelect={setSelected} idPrefix="t" label="Sections" />;
}

describe('Tabs', () => {
  it('marks only the selected tab as selected and focusable', () => {
    render(<Harness />);
    const one = screen.getByRole('tab', { name: 'One' });
    const two = screen.getByRole('tab', { name: 'Two' });

    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
    expect(one).toHaveAttribute('aria-selected', 'true');
    expect(one).toHaveAttribute('tabindex', '0');
    expect(one).toHaveAttribute('aria-controls', 't-panel-one');
    expect(two).toHaveAttribute('aria-selected', 'false');
    expect(two).toHaveAttribute('tabindex', '-1');
  });

  it('selects on click', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: 'Three' }));
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves selection and focus with the arrow keys, wrapping at the ends', () => {
    render(<Harness />);
    const one = screen.getByRole('tab', { name: 'One' });

    fireEvent.keyDown(one, { key: 'ArrowLeft' });
    const three = screen.getByRole('tab', { name: 'Three' });
    expect(three).toHaveAttribute('aria-selected', 'true');
    expect(three).toHaveFocus();

    fireEvent.keyDown(three, { key: 'ArrowRight' });
    expect(one).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(one, { key: 'End' });
    expect(three).toHaveAttribute('aria-selected', 'true');
  });
});
