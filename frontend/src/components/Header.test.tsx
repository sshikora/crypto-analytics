import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('./NotificationBell', () => ({ default: () => <button type="button">Notifications</button> }));

const signedOut = { user: null, isAuthenticated: false, isLoading: false, signOut: vi.fn() };
const signedIn = { user: { email: 'reader@example.com' }, isAuthenticated: true, isLoading: false, signOut: vi.fn() };

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>
  );
}

describe('Header', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(signedOut as never);
  });

  it('renders the site title', () => {
    renderHeader();
    expect(screen.getByText('Crypto Quant Lab')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    renderHeader();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Markets')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Methodology')).toBeInTheDocument();
  });

  it('shows sign in and sign up buttons when not authenticated', () => {
    renderHeader();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
  });

  describe('phone menu', () => {
    it('opens a panel with every link and the account actions, and closes again', () => {
      renderHeader();
      const button = screen.getByRole('button', { name: 'Open menu' });
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(document.getElementById('mobile-menu')).toBeNull();

      fireEvent.click(button);

      const menu = document.getElementById('mobile-menu')!;
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button).toHaveAttribute('aria-controls', 'mobile-menu');
      for (const label of ['Dashboard', 'Markets', 'About', 'Methodology', 'Help', 'Sign In', 'Sign Up']) {
        expect(within(menu).getByRole('link', { name: label })).toBeInTheDocument();
      }

      fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
      expect(document.getElementById('mobile-menu')).toBeNull();
    });

    it('closes on Escape', () => {
      renderHeader();
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(document.getElementById('mobile-menu')).toBeNull();
    });

    it('closes when a link is chosen, even for the page already open', () => {
      renderHeader();
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
      fireEvent.click(within(document.getElementById('mobile-menu')!).getByRole('link', { name: 'Dashboard' }));
      expect(document.getElementById('mobile-menu')).toBeNull();
    });

    it('shows the signed-in account and keeps notifications in the top bar', () => {
      vi.mocked(useAuth).mockReturnValue(signedIn as never);
      renderHeader();

      // One bell for wide screens and one beside the menu button; CSS shows one at a time
      expect(screen.getAllByRole('button', { name: 'Notifications' })).toHaveLength(2);
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

      const menu = document.getElementById('mobile-menu')!;
      expect(within(menu).getByText('reader@example.com')).toBeInTheDocument();
      fireEvent.click(within(menu).getByRole('button', { name: 'Sign Out' }));
      expect(signedIn.signOut).toHaveBeenCalled();
      expect(document.getElementById('mobile-menu')).toBeNull();
    });
  });
});
