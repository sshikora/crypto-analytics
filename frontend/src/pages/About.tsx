import { Helmet } from 'react-helmet-async';

export const About = () => {
  return (
    <>
      <Helmet>
        <title>About - Crypto Quant Lab</title>
        <meta
          name="description"
          content="Learn about Crypto Quant Lab's mission to provide comprehensive cryptocurrency analytics and market insights."
        />
      </Helmet>

      <div className="max-w-4xl mx-auto">
        <div className="card">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">About Crypto Quant Lab</h1>

          {/* Purpose Section */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Our Mission</h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 mb-4">
                Crypto Quant Lab is dedicated to building a comprehensive suite of analytics tools designed
                specifically for cryptocurrency markets. Our platform empowers traders, investors, and
                enthusiasts with real-time market data, technical indicators, and quantitative analysis tools
                to make more informed decisions in the dynamic world of digital assets.
              </p>
              <p className="text-gray-700 mb-4">
                We believe that access to professional-grade analytics should be available to everyone, not
                just institutional investors. Our tools provide:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Real-time cryptocurrency price data and market metrics</li>
                <li>Technical analysis indicators including moving averages and trend analysis</li>
                <li>Market comparison tools to track multiple assets simultaneously</li>
                <li>Customizable dashboards for personalized market monitoring</li>
                <li>Historical price charts and performance tracking</li>
              </ul>
              <p className="text-gray-700">
                Whether you're a day trader, long-term investor, or simply curious about cryptocurrency
                markets, Crypto Quant Lab provides the insights you need to navigate this exciting space.
              </p>
            </div>
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
