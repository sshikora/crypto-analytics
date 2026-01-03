import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export const Header = () => {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-primary-600">
              Crypto Quant Lab
            </div>
          </Link>
          <div className="flex items-center space-x-6">
            <nav className="flex space-x-6">
              <Link
                to="/"
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/markets"
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
              >
                Markets
              </Link>
              <Link
                to="/about"
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
              >
                About
              </Link>
            </nav>
            <div className="flex items-center space-x-3 ml-4 pl-4 border-l border-gray-200">
              {isLoading ? (
                <span className="text-gray-400 text-sm">Loading...</span>
              ) : isAuthenticated ? (
                <>
                  <NotificationBell />
                  <span className="text-sm text-gray-600">{user?.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="text-sm text-gray-700 hover:text-primary-600 font-medium transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm text-gray-700 hover:text-primary-600 font-medium transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="btn btn-primary text-sm py-1 px-3"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
