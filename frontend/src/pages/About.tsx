import { Link } from 'react-router-dom';
import { SEO } from '../components/SEO';

const LINK = 'text-primary-600 hover:text-primary-700 font-medium';

export const About = () => {
  return (
    <>
      <SEO
        title="About - CryptoQuantLab"
        description="CryptoQuantLab runs volatility, Value at Risk, regime and Monte Carlo models on the largest cryptocurrencies every night, validates each against an independent Python reference, and publishes what holds up."
        canonicalUrl="/about"
      />

      <div className="max-w-4xl mx-auto">
        <div className="card">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">About CryptoQuantLab</h1>

          <section className="mb-8 space-y-4 text-gray-700">
            <h2 className="text-2xl font-semibold text-gray-800">What it is</h2>
            <p>
              CryptoQuantLab is a risk analytics site for the 100 largest cryptocurrencies. Every night it takes the
              latest daily closes and recomputes each coin&apos;s models:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Volatility: realized, EWMA, HAR-RV forecasts and GARCH(1,1)</li>
              <li>
                One-day Value at Risk and expected shortfall by four methods, each backtested with Kupiec and
                Christoffersen tests
              </li>
              <li>Trend and volatility regimes, with a hidden Markov model alongside</li>
              <li>Monte Carlo scenarios from 10,000 simulated price paths</li>
              <li>Trading-signal backtests that test for timing skill against simply holding the coin</li>
            </ul>
            <p>
              The point is to show what these models say and how far to trust them, not to tell anyone what to buy.
            </p>
          </section>

          <section className="mb-8 space-y-4 text-gray-700">
            <h2 className="text-2xl font-semibold text-gray-800">How it is checked</h2>
            <p>
              Every model is validated against an independent Python reference built on numpy, scipy, statsmodels, arch
              and scikit-learn, most to within 1e-12. The{' '}
              <Link to="/methodology" className={LINK}>
                Methodology
              </Link>{' '}
              page gives each model&apos;s formulas, assumptions and validation, and the{' '}
              <Link to="/research" className={LINK}>
                Research
              </Link>{' '}
              posts report what held up out of sample and what didn&apos;t. The code, including the validation
              notebooks, is on{' '}
              <a href="https://github.com/sshikora/crypto-analytics" className={LINK}>
                GitHub
              </a>
              .
            </p>
          </section>

          <section className="mb-8 space-y-4 text-gray-700">
            <h2 className="text-2xl font-semibold text-gray-800">Who builds it</h2>
            <p>
              CryptoQuantLab is built by Seth Shikora, a quantitative developer in Portland, Oregon. Seth has an MS in
              Computational Finance (Risk Analysis) from the Oregon Graduate Institute and decades of software
              engineering, including principal and lead roles at Amazon, Nike and Equinix and capital markets work on
              DirectBooks, the bond origination platform used by major US banks.
            </p>
            <p>
              <a href="https://www.linkedin.com/in/sethshikora/" className={LINK}>
                Seth on LinkedIn
              </a>
            </p>
          </section>

          {/* Disclaimer Section */}
          <section className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Important Disclaimer</h2>
            <div className="prose prose-gray max-w-none text-sm">
              <h3 className="font-semibold text-base mt-4 mb-2">No Financial Advice</h3>
              <p className="text-gray-700 mb-4">
                The information provided by Crypto Quant Lab is for informational purposes only and should
                not be considered as financial, investment, or trading advice. You should consult with
                a qualified financial advisor before making any investment decisions.
              </p>

              <h3 className="font-semibold text-base mt-4 mb-2">Risk Acknowledgment</h3>
              <p className="text-gray-700 mb-4">
                You acknowledge and agree that cryptocurrency markets are highly volatile and speculative.
                Past performance is not indicative of future results. You are solely responsible for any
                investment decisions you make based on information provided by the Service.
              </p>

              <h3 className="font-semibold text-base mt-4 mb-2">Data Accuracy</h3>
              <p className="text-gray-700 mb-4">
                While we strive to provide accurate and timely information, we make no representations
                or warranties about the accuracy, completeness, or reliability of any data displayed on
                the Service. Data may be delayed, inaccurate, or unavailable at times.
              </p>

              <h3 className="font-semibold text-base mt-4 mb-2">Disclaimer of Warranties</h3>
              <p className="text-gray-700 mb-4">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
                EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
                MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>

              <h3 className="font-semibold text-base mt-4 mb-2">Limitation of Liability</h3>
              <p className="text-gray-700 mb-2">
                IN NO EVENT SHALL CRYPTO QUANT LAB, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE
                LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
                INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER
                INTANGIBLE LOSSES, RESULTING FROM:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Your access to or use of or inability to access or use the Service</li>
                <li>Any conduct or content of any third party on the Service</li>
                <li>Any content obtained from the Service</li>
                <li>Unauthorized access, use, or alteration of your transmissions or content</li>
              </ul>
            </div>
          </section>

          {/* Contact Section */}
          <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Contact Us</h2>
            <p className="text-gray-700 mb-4">
              We value your feedback and are here to help. If you have any questions, comments, or
              suggestions about Crypto Quant Lab, please don't hesitate to reach out.
            </p>
            <div className="flex items-center space-x-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <a
                href="mailto:support@cryptoquantlab.com"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                support@cryptoquantlab.com
              </a>
            </div>
            <p className="text-sm text-gray-600 mt-4">
              We aim to respond to all inquiries within 24-48 hours.
            </p>
          </section>
        </div>
      </div>
    </>
  );
};
