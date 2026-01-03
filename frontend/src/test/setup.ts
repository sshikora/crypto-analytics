import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Suppress specific console warnings in tests
beforeAll(() => {
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || '';

    // Suppress expected React error boundary messages in tests
    if (message.includes('The above error occurred in the <TestComponent>')) {
      return;
    }

    // Suppress expected provider errors (these are tested intentionally)
    if (message.includes('useNotifications must be used within a NotificationProvider')) {
      return;
    }

    originalError(...args);
  };

  console.warn = (...args: any[]) => {
    const message = args[0]?.toString() || '';

    // Suppress React act warnings (false positives with async utilities)
    if (message.includes('not wrapped in act(')) {
      return;
    }

    originalWarn(...args);
  };
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
