import { useState, useMemo, useCallback } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  Legend,
  Area,
  ComposedChart,
  ReferenceArea,
  Brush,
} from 'recharts';
import { format } from 'date-fns';
import { PricePoint, TimeRange } from '../types/crypto';

interface ZoomState {
  left: number | null;
  right: number | null;
  refAreaLeft: number | null;
  refAreaRight: number | null;
  isZooming: boolean;
}

interface MovingAverageChartProps {
  data: PricePoint[];
  onTimeRangeChange: (range: TimeRange) => void;
  selectedTimeRange: TimeRange;
}

type ColorMode = 'default' | 'colorblind' | 'grayscale';

interface MovingAverageConfig {
  period: number;
  enabled: boolean;
}

const DEFAULT_MA_PERIODS = [7, 14, 21, 50, 100, 200];

// Color schemes for different accessibility modes
const COLOR_SCHEMES = {
  default: [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
  ],
  colorblind: [
    '#0072B2', // blue
    '#E69F00', // orange
    '#009E73', // bluish green
    '#CC79A7', // reddish purple
    '#56B4E9', // sky blue
    '#D55E00', // vermillion
  ],
  grayscale: [
    '#000000', // black
    '#404040', // dark gray
    '#808080', // gray
    '#a0a0a0', // light gray
    '#606060', // medium gray
    '#c0c0c0', // very light gray
  ],
};

// Line patterns for grayscale mode
const LINE_PATTERNS = [
  undefined, // solid
  '5 5', // dashed
  '2 2', // dotted
  '10 5 2 5', // dash-dot
  '15 5', // long dash
  '2 8', // sparse dots
];

// Calculate Simple Moving Average
const calculateSMA = (data: number[], period: number): (number | null)[] => {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
};

export const MovingAverageChart: React.FC<MovingAverageChartProps> = ({
  data,
  onTimeRangeChange,
  selectedTimeRange,
}) => {
  const [colorMode, setColorMode] = useState<ColorMode>('default');
  const [maConfigs, setMaConfigs] = useState<MovingAverageConfig[]>(
    DEFAULT_MA_PERIODS.map((period) => ({
      period,
      enabled: period === 7 || period === 21, // Enable 7 and 21 by default
    }))
  );
  const [customPeriod, setCustomPeriod] = useState<string>('');
  const [showDifference, setShowDifference] = useState(false);

  // Zoom state
  const [zoomState, setZoomState] = useState<ZoomState>({
    left: null,
    right: null,
    refAreaLeft: null,
    refAreaRight: null,
    isZooming: false,
  });

  const enabledMAs = maConfigs.filter((ma) => ma.enabled);
  const colors = COLOR_SCHEMES[colorMode];

  const chartData = useMemo(() => {
    const prices = data.map((point) => point.price);

    return data.map((point, index) => {
      const result: Record<string, number | string | null> = {
        timestamp: new Date(point.timestamp).getTime(),
        price: point.price,
        formattedDate: format(new Date(point.timestamp), 'MMM dd, HH:mm'),
      };

      enabledMAs.forEach((ma) => {
        const smaValues = calculateSMA(prices, ma.period);
        result[`ma${ma.period}`] = smaValues[index];
      });

      // Calculate difference between first two MAs if enabled
      if (showDifference && enabledMAs.length >= 2) {
        const ma1 = result[`ma${enabledMAs[0].period}`] as number | null;
        const ma2 = result[`ma${enabledMAs[1].period}`] as number | null;
        if (ma1 !== null && ma2 !== null) {
          result.maDifference = ma1 - ma2;
        } else {
          result.maDifference = null;
        }
      }

      return result;
    });
  }, [data, enabledMAs, showDifference]);

  // Filter chart data based on zoom
  const filteredChartData = useMemo(() => {
    if (zoomState.left === null || zoomState.right === null) {
      return chartData;
    }
    return chartData.filter((item) => {
      const timestamp = item.timestamp as number;
      return timestamp >= zoomState.left! && timestamp <= zoomState.right!;
    });
  }, [chartData, zoomState.left, zoomState.right]);

  // Zoom handlers
  const handleMouseDown = useCallback((e: { activeLabel?: string | number }) => {
    if (e.activeLabel) {
      setZoomState((prev) => ({
        ...prev,
        refAreaLeft: Number(e.activeLabel),
        isZooming: true,
      }));
    }
  }, []);

  const handleMouseMove = useCallback((e: { activeLabel?: string | number }) => {
    if (zoomState.isZooming && e.activeLabel) {
      setZoomState((prev) => ({
        ...prev,
        refAreaRight: Number(e.activeLabel),
      }));
    }
  }, [zoomState.isZooming]);

  const handleMouseUp = useCallback(() => {
    if (zoomState.refAreaLeft && zoomState.refAreaRight) {
      const left = Math.min(zoomState.refAreaLeft, zoomState.refAreaRight);
      const right = Math.max(zoomState.refAreaLeft, zoomState.refAreaRight);

      // Only zoom if selection is meaningful (at least some difference)
      if (right - left > 0) {
        setZoomState({
          left,
          right,
          refAreaLeft: null,
          refAreaRight: null,
          isZooming: false,
        });
      } else {
        setZoomState((prev) => ({
          ...prev,
          refAreaLeft: null,
          refAreaRight: null,
          isZooming: false,
        }));
      }
    } else {
      setZoomState((prev) => ({
        ...prev,
        refAreaLeft: null,
        refAreaRight: null,
        isZooming: false,
      }));
    }
  }, [zoomState.refAreaLeft, zoomState.refAreaRight]);

  const resetZoom = useCallback(() => {
    setZoomState({
      left: null,
      right: null,
      refAreaLeft: null,
      refAreaRight: null,
      isZooming: false,
    });
  }, []);

  const zoomOut = useCallback(() => {
    if (zoomState.left === null || zoomState.right === null) return;

    const currentRange = zoomState.right - zoomState.left;
    const expansion = currentRange * 0.5;

    const timestamps = chartData.map((d) => d.timestamp as number);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    const newLeft = Math.max(minTime, zoomState.left - expansion);
    const newRight = Math.min(maxTime, zoomState.right + expansion);

    // If we're at full range, reset
    if (newLeft <= minTime && newRight >= maxTime) {
      resetZoom();
    } else {
      setZoomState((prev) => ({
        ...prev,
        left: newLeft,
        right: newRight,
      }));
    }
  }, [zoomState.left, zoomState.right, chartData, resetZoom]);

  const isZoomed = zoomState.left !== null && zoomState.right !== null;

  const toggleMA = (period: number) => {
    setMaConfigs((prev) =>
      prev.map((ma) =>
        ma.period === period ? { ...ma, enabled: !ma.enabled } : ma
      )
    );
  };

  const addCustomMA = () => {
    const period = parseInt(customPeriod, 10);
    if (period > 0 && !maConfigs.find((ma) => ma.period === period)) {
      setMaConfigs((prev) => [...prev, { period, enabled: true }].sort((a, b) => a.period - b.period));
      setCustomPeriod('');
    }
  };

  const removeMA = (period: number) => {
    setMaConfigs((prev) => prev.filter((ma) => ma.period !== period));
  };

  const formatYAxis = (value: number) => {
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const timeRanges = [
    { value: TimeRange.DAY, label: '1D' },
    { value: TimeRange.WEEK, label: '1W' },
    { value: TimeRange.MONTH, label: '1M' },
    { value: TimeRange.YEAR, label: '1Y' },
    { value: TimeRange.ALL, label: 'ALL' },
  ];

  return (
    <div className="space-y-4">
      {/* Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Moving Averages</h3>

        {/* Time Range Selector */}
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
          {timeRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => onTimeRangeChange(range.value)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                selectedTimeRange === range.value
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* MA Selection Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Moving Averages:</span>
        {maConfigs.map((ma) => (
          <div key={ma.period} className="flex items-center">
            <button
              onClick={() => toggleMA(ma.period)}
              className={`px-3 py-1 text-sm rounded-l-md border transition-colors ${
                ma.enabled
                  ? 'bg-primary-100 border-primary-300 text-primary-700'
                  : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
              }`}
              style={ma.enabled ? { borderColor: colors[enabledMAs.findIndex(m => m.period === ma.period) % colors.length] } : {}}
            >
              {ma.period}
            </button>
            {!DEFAULT_MA_PERIODS.includes(ma.period) && (
              <button
                onClick={() => removeMA(ma.period)}
                className="px-2 py-1 text-sm rounded-r-md border border-l-0 border-gray-300 bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* Add Custom MA */}
        <div className="flex items-center">
          <input
            type="number"
            value={customPeriod}
            onChange={(e) => setCustomPeriod(e.target.value)}
            placeholder="Custom"
            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-l-md focus:outline-none focus:ring-1 focus:ring-primary-500"
            min="1"
          />
          <button
            onClick={addCustomMA}
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded-r-md hover:bg-primary-700"
          >
            Add
          </button>
        </div>
      </div>

      {/* Accessibility & Display Options */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Color Mode:</span>
          <select
            value={colorMode}
            onChange={(e) => setColorMode(e.target.value as ColorMode)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="default">Default</option>
            <option value="colorblind">Colorblind Safe</option>
            <option value="grayscale">Grayscale + Patterns</option>
          </select>
        </div>

        {enabledMAs.length >= 2 && (
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showDifference}
              onChange={(e) => setShowDifference(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">
              Show MA Difference ({enabledMAs[0]?.period} - {enabledMAs[1]?.period})
            </span>
          </label>
        )}

        {/* Zoom Controls */}
        <div className="flex items-center space-x-2 ml-auto">
          <span className="text-sm text-gray-500">
            {isZoomed ? 'Zoomed' : 'Drag to zoom'}
          </span>
          {isZoomed && (
            <>
              <button
                onClick={zoomOut}
                className="px-2 py-1 text-sm bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
                title="Zoom Out"
              >
                −
              </button>
              <button
                onClick={resetZoom}
                className="px-2 py-1 text-sm bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
                title="Reset Zoom"
              >
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={filteredChartData}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              {/* Gradient for difference area */}
              <linearGradient id="diffPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="diffNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(timestamp) => format(new Date(timestamp), 'MMM dd')}
              stroke="#6b7280"
              fontSize={12}
              allowDataOverflow
              domain={['dataMin', 'dataMax']}
            />
            <YAxis
              tickFormatter={formatYAxis}
              stroke="#6b7280"
              fontSize={12}
              allowDataOverflow
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'price') return [`$${value.toFixed(2)}`, 'Price'];
                if (name === 'maDifference') return [`$${value.toFixed(2)}`, 'MA Difference'];
                const period = name.replace('ma', '');
                return [`$${value.toFixed(2)}`, `MA ${period}`];
              }}
              labelFormatter={(label) => format(new Date(label), 'PPpp')}
            />
            <Legend />

            {/* Price line */}
            <Line
              type="monotone"
              dataKey="price"
              stroke="#6b7280"
              strokeWidth={2}
              dot={false}
              name="Price"
            />

            {/* Moving Average lines */}
            {enabledMAs.map((ma, index) => (
              <Line
                key={ma.period}
                type="monotone"
                dataKey={`ma${ma.period}`}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                strokeDasharray={colorMode === 'grayscale' ? LINE_PATTERNS[index % LINE_PATTERNS.length] : undefined}
                dot={false}
                name={`MA ${ma.period}`}
                connectNulls
              />
            ))}

            {/* Difference area */}
            {showDifference && enabledMAs.length >= 2 && (
              <Area
                type="monotone"
                dataKey="maDifference"
                fill="url(#diffPositive)"
                stroke="none"
                name="MA Difference"
              />
            )}

            {/* Zoom selection area */}
            {zoomState.refAreaLeft && zoomState.refAreaRight && (
              <ReferenceArea
                x1={zoomState.refAreaLeft}
                x2={zoomState.refAreaRight}
                strokeOpacity={0.3}
                fill="#3b82f6"
                fillOpacity={0.3}
              />
            )}

            {/* Brush for alternative zoom control */}
            <Brush
              dataKey="timestamp"
              height={30}
              stroke="#6b7280"
              tickFormatter={(timestamp) => format(new Date(timestamp), 'MMM dd')}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend with patterns for grayscale mode */}
      {colorMode === 'grayscale' && enabledMAs.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          {enabledMAs.map((ma, index) => (
            <div key={ma.period} className="flex items-center space-x-2">
              <svg width="30" height="10">
                <line
                  x1="0"
                  y1="5"
                  x2="30"
                  y2="5"
                  stroke={colors[index % colors.length]}
                  strokeWidth="2"
                  strokeDasharray={LINE_PATTERNS[index % LINE_PATTERNS.length] || ''}
                />
              </svg>
              <span>MA {ma.period}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
