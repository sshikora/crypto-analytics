import React, { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client';
import { Link, useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SEO } from '../components/SEO';
import { GET_MARKET_RISK, GET_TOP_CRYPTOCURRENCIES } from '../services/queries';
import { Cryptocurrency, MarketRiskRow } from '../types/crypto';
import { useAuth } from '../context/AuthContext';
import { SortableCryptoCard } from '../components/SortableCryptoCard';
import { MarketToday } from '../components/MarketToday';
import { LatestResearch } from '../components/LatestResearch';

// Pegged to the dollar, so their risk numbers are noise; they stay selectable but are not shown by default
const STABLECOINS = new Set([
  'tether',
  'usd-coin',
  'usds',
  'dai',
  'ethena-usde',
  'first-digital-usd',
  'paypal-usd',
  'usd1-wlfi',
  'true-usd',
  'ripple-usd',
  'global-dollar',
]);

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, preferences, savePreferences } = useAuth();
  const [showCoinSelector, setShowCoinSelector] = useState(false);
  const [selectedCoins, setSelectedCoins] = useState<string[]>([]);

  const { data, loading, error, refetch } = useQuery(GET_TOP_CRYPTOCURRENCIES, {
    variables: { limit: 20 },
  });
  const { data: riskData } = useQuery(GET_MARKET_RISK);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const allCryptos: Cryptocurrency[] = data?.topCryptocurrencies || [];

  // Initialize selected coins from preferences or default to the top 6 that aren't stablecoins
  useEffect(() => {
    if (preferences?.dashboardCoins && preferences.dashboardCoins.length > 0) {
      setSelectedCoins(preferences.dashboardCoins);
    } else if (allCryptos.length > 0 && selectedCoins.length === 0) {
      const defaultCoins = allCryptos.filter(c => !STABLECOINS.has(c.coinGeckoId)).slice(0, 6).map(c => c.symbol);
      setSelectedCoins(defaultCoins);
    }
  }, [preferences, allCryptos]);

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [refetch]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = selectedCoins.indexOf(active.id as string);
      const newIndex = selectedCoins.indexOf(over.id as string);

      const newOrder = arrayMove(selectedCoins, oldIndex, newIndex);
      setSelectedCoins(newOrder);

      if (isAuthenticated) {
        try {
          await savePreferences({ dashboardCoins: newOrder });
        } catch (err) {
          console.error('Failed to save coin order:', err);
        }
      }
    }
  };

  const handleCoinToggle = (symbol: string) => {
    setSelectedCoins(prev => {
      if (prev.includes(symbol)) {
        return prev.filter(s => s !== symbol);
      } else {
        return [...prev, symbol];
      }
    });
  };

  const handleSaveSelection = async () => {
    if (isAuthenticated) {
      try {
        await savePreferences({ dashboardCoins: selectedCoins });
        setShowCoinSelector(false);
      } catch (err) {
        console.error('Failed to save coin selection:', err);
      }
    } else {
      setShowCoinSelector(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 p-4">Error: {error.message}</div>;

  const displayCryptos = selectedCoins
    .map(symbol => allCryptos.find(c => c.symbol === symbol))
    .filter((c): c is Cryptocurrency => c !== undefined);
  const riskByCoin = new Map<string, MarketRiskRow>(
    (riskData?.marketRisk?.rows ?? []).map((row: MarketRiskRow) => [row.coinId, row])
  );
  const marketCoins = allCryptos
    .filter(c => !STABLECOINS.has(c.coinGeckoId))
    .flatMap(crypto => {
      const risk = riskByCoin.get(crypto.coinGeckoId);
      return risk ? [{ crypto, risk }] : [];
    });

  return (
    <>
      <SEO
        title="Crypto Risk Dashboard - CryptoQuantLab"
        description="Volatility, Value at Risk and regime models for the largest cryptocurrencies, recomputed nightly and backtested out of sample, with research on what holds up."
        keywords="crypto risk, crypto volatility, crypto value at risk, crypto regime, bitcoin volatility, ethereum volatility, crypto research"
        canonicalUrl="/"
      />
      <div className="space-y-8">
        <div className="space-y-3 max-w-3xl">
          <h1 className="text-3xl font-bold text-gray-900">Crypto risk, modeled nightly</h1>
          <p className="text-gray-600">
            Volatility forecasts, Value at Risk and regime models for the largest coins, recomputed every night from daily
            closes and backtested out of sample. Open a coin for its VaR backtests, trading-signal tests and Monte Carlo
            scenarios.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-medium">
            <Link to="/methodology" className="text-primary-600 hover:text-primary-700">
              How the models work →
            </Link>
            <Link to="/research" className="text-primary-600 hover:text-primary-700">
              Research →
            </Link>
          </div>
        </div>

        {marketCoins.length > 0 && (
          <MarketToday coins={marketCoins} totalCoins={allCryptos.length} computedAt={riskData.marketRisk.computedAt} />
        )}

        <section aria-labelledby="your-coins" className="space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h2 id="your-coins" className="text-xl font-semibold text-gray-900">
              {isAuthenticated ? 'Your coins' : 'Coins'}
            </h2>
            <button
              onClick={() => setShowCoinSelector(true)}
              className="btn btn-secondary"
            >
              Customize Coins
            </button>
          </div>

          {isAuthenticated && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md text-sm">
              Use the drag handle (⋮⋮⋮) in the top-right corner of each card to reorder your coins. Your preferences are saved automatically.
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={selectedCoins} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayCryptos.map((crypto) => (
                  <SortableCryptoCard
                    key={crypto.symbol}
                    id={crypto.symbol}
                    crypto={crypto}
                    risk={riskByCoin.get(crypto.coinGeckoId)}
                    onClick={() => navigate(`/crypto/${crypto.symbol}`)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        <LatestResearch />

      {/* Coin Selector Modal */}
      {showCoinSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold mb-4">Select Coins for Your Dashboard</h3>
            <p className="text-sm text-gray-600 mb-4">
              Choose which cryptocurrencies to display on your dashboard. You can reorder them later by dragging.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
              {allCryptos.map((crypto) => (
                <button
                  key={crypto.symbol}
                  onClick={() => handleCoinToggle(crypto.symbol)}
                  className={`p-3 rounded-lg border-2 transition-colors text-left ${
                    selectedCoins.includes(crypto.symbol)
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {crypto.imageUrl && (
                      <img src={crypto.imageUrl} alt={crypto.name} className="w-6 h-6" />
                    )}
                    <div>
                      <div className="font-semibold text-sm">{crypto.symbol}</div>
                      <div className="text-xs text-gray-500">{crypto.name}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-gray-600">
                {selectedCoins.length} coin{selectedCoins.length !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowCoinSelector(false);
                    // Reset to saved preferences
                    if (preferences?.dashboardCoins) {
                      setSelectedCoins(preferences.dashboardCoins);
                    }
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSelection}
                  className="btn btn-primary"
                  disabled={selectedCoins.length === 0}
                >
                  Save Selection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};
