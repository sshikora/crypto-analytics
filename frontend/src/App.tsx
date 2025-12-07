import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { Provider } from 'react-redux';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { CryptoDetail } from './pages/CryptoDetail';
import { Markets } from './pages/Markets';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { ForgotPassword } from './pages/ForgotPassword';
import { apolloClient } from './services/apollo';
import { store } from './store';
import { AuthProvider } from './context/AuthContext';
import { configureAmplify } from './services/amplifyConfig';
import { posthog } from './services/posthog';

// Initialize Amplify
configureAmplify();

function PageViewTracker() {
  const location = useLocation();

  useEffect(() => {
    // Track page views on route change
    if (posthog) {
      posthog.capture('$pageview');
    }
  }, [location]);

  return null;
}

function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <Provider store={store}>
        <AuthProvider>
          <Router>
            <PageViewTracker />
            <div className="min-h-screen bg-gray-50">
              <Header />
              <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/markets" element={<Markets />} />
                  <Route path="/crypto/:symbol" element={<CryptoDetail />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                </Routes>
              </main>
            </div>
          </Router>
        </AuthProvider>
      </Provider>
    </ApolloProvider>
  );
}

export default App;
