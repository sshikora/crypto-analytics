import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { Provider } from 'react-redux';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { CryptoDetail } from './pages/CryptoDetail';
import { Markets } from './pages/Markets';
import { apolloClient } from './services/apollo';
import { store } from './store';

function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <Provider store={store}>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Header />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/markets" element={<Markets />} />
                <Route path="/crypto/:symbol" element={<CryptoDetail />} />
              </Routes>
            </main>
          </div>
        </Router>
      </Provider>
    </ApolloProvider>
  );
}

export default App;
