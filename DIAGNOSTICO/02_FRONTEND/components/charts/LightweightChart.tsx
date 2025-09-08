/**
 * Lightweight Canvas-based Trading Chart
 * Ultra-fast rendering for large datasets using HTML5 Canvas
 */

import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ChartDataPoint {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface LightweightChartProps {
  data: ChartDataPoint[];
  isRealtime?: boolean;
  replayProgress?: number;
  height?: number;
  showVolume?: boolean;
}

const LightweightChart: React.FC<LightweightChartProps> = memo(({
  data,
  isRealtime = false,
  replayProgress = 0,
  height = 500,
  showVolume = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [hoveredCandle, setHoveredCandle] = useState<ChartDataPoint | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [height]);

  // Draw chart using Canvas API
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Calculate margins
    const margin = { top: 20, right: 60, bottom: 60, left: 60 };
    const chartWidth = dimensions.width - margin.left - margin.right;
    const chartHeight = dimensions.height - margin.top - margin.bottom;

    // Show ALL historical data from 2020-2025 (no limit)
    // For performance, use intelligent sampling when data is very large
    const sampledData = data; // Show ALL data points, no slicing

    // Calculate price range
    const prices = sampledData.flatMap(d => [d.high, d.low]);
    const minPrice = Math.min(...prices) * 0.995;
    const maxPrice = Math.max(...prices) * 1.005;
    const priceRange = maxPrice - minPrice;

    // Calculate volume range if showing volume
    const maxVolume = showVolume ? Math.max(...sampledData.map(d => d.volume)) : 0;

    // Helper functions
    const xScale = (index: number) => margin.left + (index / (sampledData.length - 1)) * chartWidth;
    const yScale = (price: number) => margin.top + ((maxPrice - price) / priceRange) * (showVolume ? chartHeight * 0.7 : chartHeight);
    const volumeScale = (volume: number) => showVolume ? (volume / maxVolume) * chartHeight * 0.25 : 0;

    // Set styles
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 0.5;

    // Draw grid lines
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (i / 5) * (showVolume ? chartHeight * 0.7 : chartHeight);
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
    }
    for (let i = 0; i <= 10; i++) {
      const x = margin.left + (i / 10) * chartWidth;
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
    }
    ctx.stroke();

    // Draw price line
    ctx.beginPath();
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    sampledData.forEach((point, i) => {
      const x = xScale(i);
      const y = yScale(point.close);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw candles (simplified)
    sampledData.forEach((point, i) => {
      const x = xScale(i);
      const isUp = point.close >= point.open;
      
      // Candle color
      ctx.strokeStyle = isUp ? '#00D395' : '#FF3B69';
      ctx.fillStyle = isUp ? '#00D39520' : '#FF3B6920';
      ctx.lineWidth = 1;

      // Draw high-low line
      ctx.beginPath();
      ctx.moveTo(x, yScale(point.high));
      ctx.lineTo(x, yScale(point.low));
      ctx.stroke();

      // Draw open-close box (simplified as line for performance)
      const boxHeight = Math.abs(yScale(point.open) - yScale(point.close));
      if (boxHeight > 1) {
        const candleWidth = Math.max(1, chartWidth / sampledData.length * 0.6);
        ctx.fillRect(
          x - candleWidth / 2,
          Math.min(yScale(point.open), yScale(point.close)),
          candleWidth,
          boxHeight
        );
      }
    });

    // Draw volume bars if enabled
    if (showVolume) {
      ctx.fillStyle = '#3B82F640';
      sampledData.forEach((point, i) => {
        const x = xScale(i);
        const barHeight = volumeScale(point.volume);
        const barWidth = Math.max(1, chartWidth / sampledData.length * 0.8);
        ctx.fillRect(
          x - barWidth / 2,
          dimensions.height - margin.bottom - barHeight,
          barWidth,
          barHeight
        );
      });
    }

    // Draw axes labels
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';

    // Y-axis labels
    for (let i = 0; i <= 5; i++) {
      const price = minPrice + (i / 5) * priceRange;
      const y = margin.top + ((5 - i) / 5) * (showVolume ? chartHeight * 0.7 : chartHeight);
      ctx.fillText(`$${price.toFixed(0)}`, margin.left - 5, y + 3);
    }

    // X-axis labels (show every 5th point)
    ctx.textAlign = 'center';
    const labelStep = Math.ceil(sampledData.length / 5);
    sampledData.forEach((point, i) => {
      if (i % labelStep === 0) {
        const x = xScale(i);
        const date = new Date(point.datetime);
        ctx.fillText(format(date, 'HH:mm'), x, dimensions.height - margin.bottom + 15);
      }
    });

  }, [data, dimensions, showVolume]);

  // Redraw on data or dimension changes
  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // Handle mouse move for tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePos({ x, y });

    // Find closest data point
    const margin = { left: 60, right: 60 };
    const chartWidth = dimensions.width - margin.left - margin.right;
    const index = Math.round(((x - margin.left) / chartWidth) * (data.length - 1));
    
    if (index >= 0 && index < data.length) {
      setHoveredCandle(data[index]);
    }
  }, [data, dimensions]);

  const handleMouseLeave = useCallback(() => {
    setHoveredCandle(null);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
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
        <div className="px-3 py-1 bg-gray-800 rounded-lg">
          <span className="text-xs text-gray-400">{data.length} points</span>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-crosshair"
      />

      {/* Tooltip */}
      {hoveredCandle && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: Math.min(mousePos.x + 10, dimensions.width - 200),
            top: Math.min(mousePos.y - 50, dimensions.height - 150)
          }}
        >
          <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-lg p-3 shadow-2xl">
            <div className="text-xs text-gray-400 mb-2">
              {format(new Date(hoveredCandle.datetime), "d MMM yyyy HH:mm", { locale: es })}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-gray-400">Open:</span>
                <span className="text-white font-mono">${hoveredCandle.open.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-400">High:</span>
                <span className="text-green-400 font-mono">${hoveredCandle.high.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-400">Low:</span>
                <span className="text-red-400 font-mono">${hoveredCandle.low.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-400">Close:</span>
                <span className={`font-mono ${hoveredCandle.close >= hoveredCandle.open ? 'text-green-400' : 'text-red-400'}`}>
                  ${hoveredCandle.close.toFixed(2)}
                </span>
              </div>
              {hoveredCandle.volume && (
                <div className="flex justify-between gap-4 pt-1 border-t border-gray-800">
                  <span className="text-gray-400">Vol:</span>
                  <span className="text-blue-400 font-mono">
                    {(hoveredCandle.volume / 1000000).toFixed(2)}M
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

LightweightChart.displayName = 'LightweightChart';

export default LightweightChart;