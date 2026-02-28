import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

export const Help = () => {
  return (
    <>
      <Helmet>
        <title>Help - Crypto Quant Lab</title>
        <meta
          name="description"
          content="Learn how to use Crypto Quant Lab — dashboard, markets, charts, moving averages, and notification alerts."
        />
      </Helmet>

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="card">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Help &amp; Getting Started</h1>
          <p className="text-gray-600">
            Everything you need to know to get the most out of Crypto Quant Lab.
          </p>
        </div>

        {/* Dashboard */}
        <section className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800">Dashboard</h2>
          </div>
          <p className="text-gray-700 mb-4">
            The <Link to="/" className="text-primary-600 hover:text-primary-700 font-medium">Dashboard</Link> is
            your personalized home screen showing the cryptocurrencies you care about most.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>
              <span className="font-medium">Add or remove coins</span> — Click the &quot;Edit&quot; button
              to select which cryptocurrencies appear on your dashboard.
            </li>
            <li>
              <span className="font-medium">Drag &amp; drop to reorder</span> — Press and hold a card,
              then drag it to rearrange the layout to your preference.
            </li>
            <li>
              <span className="font-medium">Auto-refresh</span> — Prices update automatically every
              60 seconds so you always see the latest data.
            </li>
            <li>
              <span className="font-medium">Click any card</span> — Opens the detailed view for that
              cryptocurrency with charts and analytics.
            </li>
          </ul>
          <p className="text-sm text-gray-500 mt-3">
            Your dashboard layout and coin selections are saved to your account when signed in.
          </p>
        </section>

        {/* Markets */}
        <section className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-50 text-green-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800">Markets</h2>
          </div>
          <p className="text-gray-700 mb-4">
            The <Link to="/markets" className="text-primary-600 hover:text-primary-700 font-medium">Markets</Link> page
            displays a sortable table of the top 50 cryptocurrencies by market capitalization.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>
              <span className="font-medium">Rank, price, 24h change, market cap &amp; volume</span> —
              Key metrics at a glance for every listed coin.
            </li>
            <li>
              <span className="font-medium">Click any row</span> — Navigate to the detailed analytics
              page for that coin.
            </li>
          </ul>
        </section>

        {/* Coin Detail & Charts */}
        <section className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800">Coin Detail &amp; Charts</h2>
          </div>
          <p className="text-gray-700 mb-4">
            Every cryptocurrency has a dedicated detail page with interactive charts and key statistics.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>
              <span className="font-medium">Price chart</span> — Historical price data displayed in an
              interactive line chart.
            </li>
            <li>
              <span className="font-medium">Moving average chart</span> — Visualize moving average
              overlays (e.g., 7-day, 21-day, 50-day, 100-day, 200-day) alongside the price to identify
              trends and potential crossover points.
            </li>
            <li>
              <span className="font-medium">Time range selector</span> — Switch between Day, Week,
              Month, 3 Months, Year, and All time ranges.
            </li>
            <li>
              <span className="font-medium">Stat cards</span> — View current price, market cap,
              volume, and other key metrics.
            </li>
          </ul>
        </section>

        {/* Moving Averages */}
        <section className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-50 text-purple-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800">Understanding Moving Averages</h2>
          </div>
          <p className="text-gray-700 mb-4">
            A moving average (MA) smooths out price data over a given period to help identify the
            direction of a trend.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-gray-800 mb-2">Common Periods</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
              <div><span className="font-medium">7-day MA</span> — Short-term trend</div>
              <div><span className="font-medium">21-day MA</span> — Short/medium-term trend</div>
              <div><span className="font-medium">50-day MA</span> — Medium-term trend</div>
              <div><span className="font-medium">100-day MA</span> — Medium/long-term trend</div>
              <div><span className="font-medium">200-day MA</span> — Long-term trend</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2">Crossover Signals</h3>
            <ul className="list-disc pl-6 space-y-2 text-sm text-gray-700">
              <li>
                <span className="font-medium text-green-600">Bullish crossover</span> — A shorter MA
                crosses above a longer MA, suggesting upward momentum.
              </li>
              <li>
                <span className="font-medium text-red-600">Bearish crossover</span> — A shorter MA
                crosses below a longer MA, suggesting downward momentum.
              </li>
              <li>
                <span className="font-medium">Price above/below MA</span> — When the current price
                crosses above or below a moving average, it can signal a potential change in trend direction.
              </li>
            </ul>
          </div>
        </section>

        {/* Notifications */}
        <section className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-yellow-50 text-yellow-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800">Notification Alerts</h2>
          </div>
          <p className="text-gray-700 mb-4">
            Set up custom alerts to be notified when moving average crossovers occur. Requires a free account.
          </p>

          <h3 className="font-semibold text-gray-800 mb-2">Creating a Notification Rule</h3>
          <ol className="list-decimal pl-6 space-y-2 text-gray-700 mb-4">
            <li>Navigate to any coin&apos;s detail page.</li>
            <li>Scroll down to the <span className="font-medium">Notification Rules</span> section.</li>
            <li>Click <span className="font-medium">&quot;Create Rule&quot;</span>.</li>
            <li>Choose the <span className="font-medium">rule type</span> — MA crossover (two MAs crossing) or
              price vs. MA (price crossing a single MA).</li>
            <li>Select the <span className="font-medium">MA periods</span> you want to monitor.</li>
            <li>Pick a <span className="font-medium">crossover direction</span> — bullish, bearish, or both.</li>
            <li>Choose your <span className="font-medium">delivery method</span> — in-app notification,
              email, or both.</li>
          </ol>

          <h3 className="font-semibold text-gray-800 mb-2">Viewing Notifications</h3>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
            <li>
              <span className="font-medium">Bell icon</span> — Click the bell icon in the top
              navigation bar to open the notification center and see all recent alerts.
            </li>
            <li>
              <span className="font-medium">Toast alerts</span> — Real-time pop-up notifications
              appear in the corner of the screen when a crossover is detected.
            </li>
            <li>
              <span className="font-medium">Unread badge</span> — The bell icon displays a count of
              your unread notifications.
            </li>
          </ul>

          <h3 className="font-semibold text-gray-800 mb-2">Managing Rules</h3>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>View and manage all your rules on each coin&apos;s detail page.</li>
            <li>Toggle rules on or off without deleting them.</li>
            <li>Delete rules you no longer need.</li>
            <li>Email notifications are rate-limited to one per rule every 5 minutes.</li>
          </ul>
        </section>

        {/* Account */}
        <section className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800">Account &amp; Preferences</h2>
          </div>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>
              <span className="font-medium">Sign up</span> — Create a free account
              with your email to unlock notifications, saved preferences, and a personalized dashboard.
            </li>
            <li>
              <span className="font-medium">Sign in</span> — Access your account from any device.
            </li>
            <li>
              <span className="font-medium">Forgot password</span> — Reset your password via email
              verification code from the sign-in page.
            </li>
            <li>
              <span className="font-medium">Color mode</span> — Choose between default, colorblind, or
              grayscale chart color schemes.
            </li>
            <li>
              <span className="font-medium">MA period preferences</span> — Select which moving average
              periods are shown by default on charts.
            </li>
          </ul>
        </section>

        {/* FAQ */}
        <section className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-800">Where does the data come from?</h3>
              <p className="text-gray-700 text-sm mt-1">
                All cryptocurrency data is sourced from the CoinGecko API, providing real-time
                and historical market data.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">How often is data updated?</h3>
              <p className="text-gray-700 text-sm mt-1">
                Dashboard prices refresh every 60 seconds. Crossover detection runs every 5 minutes.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Do I need an account to use the app?</h3>
              <p className="text-gray-700 text-sm mt-1">
                No — you can browse the dashboard, markets, and coin detail pages without an
                account. An account is required for notification alerts and saved preferences.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">How many notification rules can I create?</h3>
              <p className="text-gray-700 text-sm mt-1">
                You can create multiple rules per coin to monitor different crossover scenarios.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Is the app free?</h3>
              <p className="text-gray-700 text-sm mt-1">
                Yes, Crypto Quant Lab is completely free to use.
              </p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="card">
          <p className="text-gray-700">
            Still have questions? Reach out to us at{' '}
            <a
              href="mailto:support@cryptoquantlab.com"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              support@cryptoquantlab.com
            </a>.
          </p>
        </section>
      </div>
    </>
  );
};
