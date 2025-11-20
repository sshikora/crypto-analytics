import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const navigate = useNavigate();
  const { signUp, confirmSignUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!acceptedTerms) {
      setError('You must accept the Terms of Service to create an account');
      return;
    }

    setIsLoading(true);

    try {
      await signUp(email, password, acceptedTerms);
      setNeedsConfirmation(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign up';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await confirmSignUp(email, confirmationCode);
      navigate('/login');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to confirm';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (needsConfirmation) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="card max-w-md w-full">
          <h2 className="text-2xl font-bold text-center mb-6">Verify Email</h2>
          <p className="text-gray-600 text-center mb-4">
            We've sent a verification code to {email}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleConfirm} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter code"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn btn-primary py-2 disabled:opacity-50"
            >
              {isLoading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="card max-w-md w-full">
        <h2 className="text-2xl font-bold text-center mb-6">Create Account</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Min 8 characters"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must include uppercase, lowercase, number, and special character
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Confirm password"
            />
          </div>

          <div className="flex items-start space-x-2">
            <input
              id="terms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="terms" className="text-sm text-gray-700">
              I accept the{' '}
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="text-primary-600 hover:text-primary-700 underline"
              >
                Terms of Service
              </button>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading || !acceptedTerms}
            className="w-full btn btn-primary py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Sign in
          </Link>
        </div>
      </div>

      {/* Terms of Service Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold mb-4">Terms of Service</h3>

            <div className="prose prose-sm">
              <h4 className="font-semibold mt-4">1. Acceptance of Terms</h4>
              <p>
                By accessing and using CryptoQuantLab ("the Service"), you acknowledge that you have read,
                understood, and agree to be bound by these Terms of Service.
              </p>

              <h4 className="font-semibold mt-4">2. Disclaimer of Warranties</h4>
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
                EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
                MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>

              <h4 className="font-semibold mt-4">3. Limitation of Liability</h4>
              <p>
                IN NO EVENT SHALL CRYPTOQUANTLAB, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE
                LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
                INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER
                INTANGIBLE LOSSES, RESULTING FROM:
              </p>
              <ul className="list-disc pl-5">
                <li>Your access to or use of or inability to access or use the Service</li>
                <li>Any conduct or content of any third party on the Service</li>
                <li>Any content obtained from the Service</li>
                <li>Unauthorized access, use, or alteration of your transmissions or content</li>
              </ul>

              <h4 className="font-semibold mt-4">4. No Financial Advice</h4>
              <p>
                The information provided by the Service is for informational purposes only and should
                not be considered as financial, investment, or trading advice. You should consult with
                a qualified financial advisor before making any investment decisions.
              </p>

              <h4 className="font-semibold mt-4">5. Indemnification</h4>
              <p>
                You agree to defend, indemnify, and hold harmless CryptoQuantLab and its licensees and
                licensors, and their employees, contractors, agents, officers, and directors, from and
                against any and all claims, damages, obligations, losses, liabilities, costs, or debt,
                and expenses, resulting from or arising out of your use and access of the Service.
              </p>

              <h4 className="font-semibold mt-4">6. Risk Acknowledgment</h4>
              <p>
                You acknowledge and agree that cryptocurrency markets are highly volatile and speculative.
                Past performance is not indicative of future results. You are solely responsible for any
                investment decisions you make based on information provided by the Service.
              </p>

              <h4 className="font-semibold mt-4">7. Data Accuracy</h4>
              <p>
                While we strive to provide accurate and timely information, we make no representations
                or warranties about the accuracy, completeness, or reliability of any data displayed on
                the Service. Data may be delayed, inaccurate, or unavailable at times.
              </p>

              <h4 className="font-semibold mt-4">8. Governing Law</h4>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the
                jurisdiction in which the Service operates, without regard to its conflict of law provisions.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowTerms(false)}
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
