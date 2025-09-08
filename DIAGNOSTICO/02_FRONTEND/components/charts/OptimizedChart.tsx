/**
 * Optimized Trading Chart with Better Performance
 * Uses React.memo, useMemo, and data sampling for smooth 60 FPS
 */

import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Brush
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ChartDataPoint {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  [key: string]: any;
}

interface OptimizedChartProps {
  data: ChartDataPoint[];
  isRealtime?: boolean;
  replayProgress?: number;
  height?: number;
  showVolume?: boolean;
}

// Memoized tooltip component
const CustomTooltip = memo(({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const isUp = data.close >= data.open;

  return (
    <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-lg p-3 shadow-2xl">
      <div className="text-xs text-gray-400 mb-2">
        {format(new Date(label), "d MMM yyyy HH:mm", { locale: es })}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400 text-xs">Open:</span>
          <span className="text-white text-xs font-mono">${data.open.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400 text-xs">High:</span>
          <span className="text-green-400 text-xs font-mono">${data.high.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400 text-xs">Low:</span>
          <span className="text-red-400 text-xs font-mono">${data.low.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400 text-xs">Close:</span>
          <span className={`text-xs font-mono ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            ${data.close.toFixed(2)}
          </span>
        </div>
        {data.volume && (
          <div className="flex justify-between gap-4 pt-1 border-t border-gray-800">
            <span className="text-gray-400 text-xs">Vol:</span>
            <span className="text-blue-400 text-xs font-mono">
              {(data.volume / 1000000).toFixed(2)}M
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 mt-2">
        {isUp ? (
          <TrendingUp className="w-3 h-3 text-green-400" />
        ) : (
          <TrendingDown className="w-3 h-3 text-red-400" />
        )}
        <span className={`text-xs ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? '+' : ''}{((data.close - data.open) / data.open * 100).toFixed(2)}%
        </span>
      </div>
    </div>
  );
});

CustomTooltip.displayName = 'CustomTooltip';

// Custom dot component for candles (simplified for performance)
const CandleDot = memo(({ cx, cy, payload }: any) => {
  if (!payload) return null;
  const isUp = payload.close >= payload.open;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={2}
      fill={isUp ? '#00D395' : '#FF3B69'}
      stroke="none"
    />
  );
});

CandleDot.displayName = 'CandleDot';

const OptimizedChart: React.FC<OptimizedChartProps> = memo(({
  data,
  isRealtime = false,
  replayProgress = 0,
  height = 500,
  showVolume = true
}) => {
  const [brushIndex, setBrushIndex] = useState<[number, number]>([
    Math.max(0, data.length - 100),
    data.length - 1
  ]);

  // Sample data for better performance (show every nth point based on data size)
  const sampledData = useMemo(() => {
    if (data.length <= 200) return data;
    
    // For large datasets, sample more aggressively
    const targetPoints = 200; // Reduced from 500 for better performance
    const sampleRate = Math.ceil(data.length / targetPoints);
    const sampled = [];
    
    for (let i = 0; i < data.length; i += sampleRate) {
      // Get the highest high and lowest low in the sample period
      const slice = data.slice(i, Math.min(i + sampleRate, data.length));
      if (slice.length > 0) {
        const high = Math.max(...slice.map(d => d.high));
        const low = Math.min(...slice.map(d => d.low));
        const last = slice[slice.length - 1];
        
        sampled.push({
          ...last,
          high,
          low,
          volume: slice.reduce((sum, d) => sum + d.volume, 0)
        });
      }
    }
    
    return sampled;
  }, [data]);

  // Get visible data based on brush
  const visibleData = useMemo(() => {
    return sampledData.slice(brushIndex[0], brushIndex[1] + 1);
  }, [sampledData, brushIndex]);

  // Calculate domain for better scaling
  const yDomain = useMemo(() => {
    if (visibleData.length === 0) return [4000, 4200];
    
    const prices = visibleData.flatMap(d => [d.high, d.low]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1;
    
    return [min - padding, max + padding];
  }, [visibleData]);

  // Format tick for X axis
  const formatXTick = useCallback((value: string) => {
    const date = new Date(value);
    return format(date, 'HH:mm');
  }, []);

  // Handle brush change
  const handleBrushChange = useCallback((e: any) => {
    if (e && e.startIndex !== undefined && e.endIndex !== undefined) {
      setBrushIndex([e.startIndex, e.endIndex]);
    }
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Status indicators */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        {isRealtime && (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-lg backdrop-blur">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs">Live</span>
          </div>
        )}
        {replayProgress > 0 && replayProgress < 100 && (
          <div className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg backdrop-blur">
            <span className="text-xs">Replay {replayProgress.toFixed(0)}%</span>
          </div>
        )}
      </div>

      {/* Main Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={visibleData}
          margin={{ top: 20, right: 20, bottom: showVolume ? 100 : 60, left: 60 }}
        >
          <defs>
            <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#374151" 
            strokeOpacity={0.3}
          />
          
          <XAxis
            dataKey="datetime"
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickFormatter={formatXTick}
            stroke="#4B5563"
          />
          
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            stroke="#4B5563"
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          {/* Price line */}
          <Line
            type="monotone"
            dataKey="close"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            animationDuration={300}
          />
          
          {/* Volume bars (if enabled) */}
          {showVolume && (
            <Bar
              dataKey="volume"
              fill="url(#volumeGradient)"
              yAxisId="volume"
              opacity={0.5}
            />
          )}
          
          {/* Hidden volume axis */}
          {showVolume && (
            <YAxis
              yAxisId="volume"
              orientation="right"
              tick={false}
              axisLine={false}
              domain={[0, 'dataMax']}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      
      {/* Brush for navigation */}
      {data.length > 100 && (
        <div className="px-6">
          <ResponsiveContainer width="100%" height={60}>
            <ComposedChart
              data={sampledData}
              margin={{ top: 10, right: 20, bottom: 10, left: 60 }}
            >
              <Line
                type="monotone"
                dataKey="close"
                stroke="#3B82F6"
                strokeWidth={1}
                dot={false}
              />
              <Brush
                dataKey="datetime"
                height={30}
                stroke="#4B5563"
                fill="#1F2937"
                startIndex={brushIndex[0]}
                endIndex={brushIndex[1]}
                onChange={handleBrushChange}
                tickFormatter={formatXTick}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
});

OptimizedChart.displayName = 'OptimizedChart';

export default OptimizedChart;