import { KeyboardEvent, useRef } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
  idPrefix: string;
  label: string;
}

export function tabId(idPrefix: string, id: string): string {
  return `${idPrefix}-tab-${id}`;
}

export function tabPanelId(idPrefix: string, id: string): string {
  return `${idPrefix}-panel-${id}`;
}

export function Tabs<T extends string>({ tabs, selected, onSelect, idPrefix, label }: TabsProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys, Home and End move between tabs, following the WAI-ARIA tabs pattern
  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;

    event.preventDefault();
    onSelect(tabs[next].id);
    buttons.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="flex overflow-x-auto border-b border-gray-200">
      {tabs.map((tab, index) => {
        const isSelected = tab.id === selected;
        return (
          <button
            key={tab.id}
            ref={el => (buttons.current[index] = el)}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.id)}
            aria-selected={isSelected}
            aria-controls={tabPanelId(idPrefix, tab.id)}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={event => handleKeyDown(event, index)}
            className={`px-4 py-2 -mb-px border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
              isSelected
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
