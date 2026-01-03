import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationBell from './NotificationBell';
import { BrowserRouter } from 'react-router-dom';

// Mock the contexts and components
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../context/NotificationContext', () => ({
  useNotifications: vi.fn(),
}));

vi.mock('./NotificationCenter', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="notification-center">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when user is not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      user: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      isLoading: false,
    });

    vi.mocked(useNotifications).mockReturnValue({
      notifications: [],
      notificationRules: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      toastNotification: null,
      dismissToast: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refetchNotifications: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      refetchRules: vi.fn(),
      getRulesForCoin: vi.fn(),
    });

    const { container } = render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render notification bell when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { sub: 'user-123', email: 'test@example.com' },
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      isLoading: false,
    });

    vi.mocked(useNotifications).mockReturnValue({
      notifications: [],
      notificationRules: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      toastNotification: null,
      dismissToast: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refetchNotifications: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      refetchRules: vi.fn(),
      getRulesForCoin: vi.fn(),
    });

    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>
    );

    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toBeInTheDocument();
  });

  it('should display unread count badge when there are unread notifications', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { sub: 'user-123', email: 'test@example.com' },
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      isLoading: false,
    });

    vi.mocked(useNotifications).mockReturnValue({
      notifications: [],
      notificationRules: [],
      unreadCount: 5,
      isLoading: false,
      error: null,
      toastNotification: null,
      dismissToast: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refetchNotifications: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      refetchRules: vi.fn(),
      getRulesForCoin: vi.fn(),
    });

    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should display "99+" when unread count exceeds 99', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { sub: 'user-123', email: 'test@example.com' },
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      isLoading: false,
    });

    vi.mocked(useNotifications).mockReturnValue({
      notifications: [],
      notificationRules: [],
      unreadCount: 150,
      isLoading: false,
      error: null,
      toastNotification: null,
      dismissToast: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refetchNotifications: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      refetchRules: vi.fn(),
      getRulesForCoin: vi.fn(),
    });

    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>
    );

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('should toggle notification center when bell is clicked', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { sub: 'user-123', email: 'test@example.com' },
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      isLoading: false,
    });

    vi.mocked(useNotifications).mockReturnValue({
      notifications: [],
      notificationRules: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      toastNotification: null,
      dismissToast: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refetchNotifications: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      refetchRules: vi.fn(),
      getRulesForCoin: vi.fn(),
    });

    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>
    );

    const button = screen.getByRole('button', { name: /notifications/i });

    // Initially closed
    expect(screen.queryByTestId('notification-center')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(button);
    expect(screen.getByTestId('notification-center')).toBeInTheDocument();

    // Click to close
    fireEvent.click(button);
    expect(screen.queryByTestId('notification-center')).not.toBeInTheDocument();
  });

  it('should close notification center when close button is clicked', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { sub: 'user-123', email: 'test@example.com' },
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      isLoading: false,
    });

    vi.mocked(useNotifications).mockReturnValue({
      notifications: [],
      notificationRules: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      toastNotification: null,
      dismissToast: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refetchNotifications: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      refetchRules: vi.fn(),
      getRulesForCoin: vi.fn(),
    });

    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>
    );

    const bellButton = screen.getByRole('button', { name: /notifications/i });

    // Open notification center
    fireEvent.click(bellButton);
    expect(screen.getByTestId('notification-center')).toBeInTheDocument();

    // Click close button inside notification center
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);
    expect(screen.queryByTestId('notification-center')).not.toBeInTheDocument();
  });

  it('should close notification center when clicking outside', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { sub: 'user-123', email: 'test@example.com' },
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      isLoading: false,
    });

    vi.mocked(useNotifications).mockReturnValue({
      notifications: [],
      notificationRules: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      toastNotification: null,
      dismissToast: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      refetchNotifications: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      refetchRules: vi.fn(),
      getRulesForCoin: vi.fn(),
    });

    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>
    );

    const button = screen.getByRole('button', { name: /notifications/i });

    // Open notification center
    fireEvent.click(button);
    expect(screen.getByTestId('notification-center')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('notification-center')).not.toBeInTheDocument();
  });
});
