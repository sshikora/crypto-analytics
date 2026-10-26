import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { Provider } from 'react-redux';
import { HelmetProvider } from 'react-helmet-async';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { CryptoDetail } from './pages/CryptoDetail';
import { Markets } from './pages/Markets';
import { About } from './pages/About';
import { Help } from './pages/Help';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { ForgotPassword } from './pages/ForgotPassword';
import { LoadingSpinner } from './components/LoadingSpinner';
import NotificationToast from './components/NotificationToast';
import { Disclaimer } from './components/Disclaimer';
import { apolloClient } from './services/apollo';
import { store } from './store';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { configureAmplify } from './services/amplifyConfig';
import { posthog } from './services/posthog';

// KaTeX is only needed on the Methodology page, so it loads with that page
const Methodology = lazy(() => import('./pages/Methodology'));

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
    <HelmetProvider>
      <ApolloProvider client={apolloClient}>
        <Provider store={store}>
          <AuthProvider>
            <NotificationProvider>
              <Router>
                <PageViewTracker />
                <div className="min-h-screen bg-gray-50">
                  <Header />
                  <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/markets" element={<Markets />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/help" element={<Help />} />
                      <Route
                        path="/methodology"
                        element={
                          <Suspense fallback={<LoadingSpinner />}>
                            <Methodology />
                          </Suspense>
                        }
                      />
                      <Route path="/crypto/:symbol" element={<CryptoDetail />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<SignUp />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                    </Routes>
                  </main>
                  <footer className="border-t border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                      <Disclaimer />
                    </div>
                  </footer>
                </div>
                <NotificationToast />
              </Router>
            </NotificationProvider>
          </AuthProvider>
        </Provider>
      </ApolloProvider>
    </HelmetProvider>
  );
}

export default App;
