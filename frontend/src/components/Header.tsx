import React from 'react';
import { Link } from 'react-router-dom';

export const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-primary-600">
              CryptoAnalytics
            </div>
          </Link>
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
          </nav>
        </div>
      </div>
    </header>
  );
};
