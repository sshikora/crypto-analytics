import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const NAV_LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/markets', label: 'Markets' },
  { to: '/about', label: 'About' },
  { to: '/methodology', label: 'Methodology' },
  { to: '/help', label: 'Help' },
];

const LINK_CLASS = 'text-gray-700 hover:text-primary-600 font-medium transition-colors';

export const Header = () => {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // The full row of links needs about 1,000px, so phones and tablets get a menu button instead.
  // A page change from anywhere, including the back button, closes it.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  const account = (layout: 'row' | 'column') => {
    if (isLoading) return <span className="text-gray-400 text-sm">Loading...</span>;
    if (isAuthenticated) {
      return (
        <>
          <span className="text-sm text-gray-600 break-all">{user?.email}</span>
          <button onClick={handleSignOut} className={`text-sm text-left ${LINK_CLASS}`}>
            Sign Out
          </button>
        </>
      );
    }
    return (
      <>
        <Link to="/login" className={`text-sm ${LINK_CLASS}`}>
          Sign In
        </Link>
        <Link to="/signup" className={`btn btn-primary text-sm py-1 px-3 ${layout === 'column' ? 'self-start' : ''}`}>
          Sign Up
        </Link>
      </>
    );
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center gap-4 py-4">
          <Link to="/" className="flex items-center space-x-2 min-w-0">
            <div className="text-2xl font-bold text-primary-600 truncate">Crypto Quant Lab</div>
          </Link>

          <div className="hidden lg:flex items-center space-x-6">
            <nav aria-label="Main" className="flex space-x-6">
              {NAV_LINKS.map(link => (
                <Link key={link.to} to={link.to} className={LINK_CLASS}>
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center space-x-3 ml-4 pl-4 border-l border-gray-200">
              {isAuthenticated && <NotificationBell />}
              {account('row')}
            </div>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            {isAuthenticated && <NotificationBell />}
            <button
              type="button"
              onClick={() => setMenuOpen(open => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="p-2 -mr-2 rounded-md text-gray-700 hover:text-primary-600 hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div id="mobile-menu" className="lg:hidden border-t border-gray-200 py-3 space-y-3">
            <nav aria-label="Main" className="flex flex-col">
              {NAV_LINKS.map(link => (
                <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className={`py-2 ${LINK_CLASS}`}>
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex flex-col gap-3 border-t border-gray-200 pt-3">{account('column')}</div>
          </div>
        )}
      </div>
    </header>
  );
};
