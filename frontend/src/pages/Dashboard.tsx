import React, { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
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
import { GET_TOP_CRYPTOCURRENCIES } from '../services/queries';
import { Cryptocurrency } from '../types/crypto';
import { useAuth } from '../context/AuthContext';
import { SortableCryptoCard } from '../components/SortableCryptoCard';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, preferences, savePreferences } = useAuth();
  const [showCoinSelector, setShowCoinSelector] = useState(false);
  const [selectedCoins, setSelectedCoins] = useState<string[]>([]);

  const { data, loading, error, refetch } = useQuery(GET_TOP_CRYPTOCURRENCIES, {
    variables: { limit: 20 },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const allCryptos: Cryptocurrency[] = data?.topCryptocurrencies || [];

  // Initialize selected coins from preferences or default to top 6
  useEffect(() => {
    if (preferences?.dashboardCoins && preferences.dashboardCoins.length > 0) {
      setSelectedCoins(preferences.dashboardCoins);
    } else if (allCryptos.length > 0 && selectedCoins.length === 0) {
      const defaultCoins = allCryptos.slice(0, 6).map(c => c.symbol);
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

  return (
    <>
      <SEO
        title="Cryptocurrency Dashboard - CryptoQuantLab"
        description="Track top cryptocurrencies including Bitcoin, Ethereum, and more. Real-time prices, market caps, and 24h changes on your customizable dashboard."
        keywords="cryptocurrency dashboard, crypto prices, bitcoin price, ethereum price, live crypto data, crypto portfolio, BTC, ETH"
        canonicalUrl="/"
      />
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Cryptocurrency Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCoinSelector(true)}
            className="btn btn-secondary"
          >
            Customize Coins
          </button>
          <button
            onClick={() => refetch()}
            className="btn btn-primary"
          >
            Refresh Data
          </button>
        </div>
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
                onClick={() => navigate(`/crypto/${crypto.symbol}`)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
