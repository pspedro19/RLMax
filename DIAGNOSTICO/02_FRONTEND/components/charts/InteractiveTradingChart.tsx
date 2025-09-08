'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  CandlestickData, 
  Time, 
  ColorType, 
  CrosshairMode, 
  LineStyle,
  CandlestickSeries,
  HistogramSeries,
  LineSeries
} from 'lightweight-charts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, ZoomIn, ZoomOut, Maximize2, RotateCcw, Download, TrendingUp, Activity } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface InteractiveTradingChartProps {
  data: any[];
  isRealtime?: boolean;
  onRangeChange?: (start: Date, end: Date) => void;
}

export const InteractiveTradingChart: React.FC<InteractiveTradingChartProps> = ({
  data,
  isRealtime = false,
  onRangeChange
}) => {
  // Log incoming data
  console.log(`[InteractiveTradingChart] Component mounted with ${data ? data.length : 0} data points`);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  const [selectedRange, setSelectedRange] = useState<[number, number]>([0, 100]);
  const [timeframe, setTimeframe] = useState<'5M' | '15M' | '30M' | '1H' | '4H' | '1D' | '1W' | 'ALL'>('ALL'); // Default to ALL to show full historical data
  const [showVolume, setShowVolume] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [percentChange, setPercentChange] = useState<number>(0);
  const [hoveredCandle, setHoveredCandle] = useState<CandlestickData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [indicators, setIndicators] = useState({
    bb: true,
    rsi: false,
    macd: false,
    ema: true
  });

  // Initialize chart
  useEffect(() => {
    console.log(`[Chart] Initializing with ${data ? data.length : 0} data points`);
    if (!chartContainerRef.current) {
      console.warn('[Chart] No chart container ref');
      return;
    }
    if (!data || data.length === 0) {
      console.warn('[Chart] No data available for chart initialization');
      return;
    }

    // Create chart with professional styling
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: '#0a0e1a' },
        textColor: '#d1d4dc',
        fontSize: 12,
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      grid: {
        vertLines: { color: '#1e222d', style: LineStyle.Solid },
        horzLines: { color: '#1e222d', style: LineStyle.Solid }
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          width: 1,
          color: '#758696',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2B5CE6'
        },
        horzLine: {
          width: 1,
          color: '#758696',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2B5CE6'
        }
      },
      rightPriceScale: {
        borderColor: '#2B5CE6',
        scaleMargins: {
          top: 0.1,
          bottom: 0.3 // Always leave space for volume
        }
      },
      timeScale: {
        borderColor: '#2B5CE6',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: any) => {
          const date = new Date(time * 1000);
          return format(date, 'MMM dd', { locale: es });
        }
      },
      watermark: {
        visible: true,
        fontSize: 48,
        horzAlign: 'center',
        vertAlign: 'center',
        color: 'rgba(43, 92, 230, 0.05)',
        text: 'USD/COP'
      }
    });

    chartRef.current = chart;

    // Add candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01
      }
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Always create volume series (will toggle visibility separately)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume'
      },
      priceScaleId: '',
      scaleMargins: {
        top: 0.8,
        bottom: 0
      }
    });
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };
    window.addEventListener('resize', handleResize);

    // Subscribe to crosshair move for price tracking and tooltip
    chart.subscribeCrosshairMove((param) => {
      if (param.seriesData && param.seriesData.size > 0) {
        const iterator = param.seriesData.values();
        const firstSeries = iterator.next().value;
        if (firstSeries && typeof firstSeries === 'object' && 'close' in firstSeries) {
          setCurrentPrice(Number(firstSeries.close));
          setHoveredCandle(firstSeries as CandlestickData);
          if (param.point) {
            setTooltipPosition({ x: param.point.x, y: param.point.y });
          }
        }
      } else {
        setHoveredCandle(null);
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []); // Remove showVolume dependency to avoid recreating chart

  // Update data based on selected range and timeframe
  useEffect(() => {
    console.log(`[Chart] Update effect - Chart: ${!!chartRef.current}, Series: ${!!candlestickSeriesRef.current}, Data: ${data ? data.length : 0}`);
    if (!chartRef.current || !candlestickSeriesRef.current) {
      console.warn('[Chart] Chart or series not initialized');
      return;
    }
    if (!data || data.length === 0) {
      console.warn('[Chart] No data to update');
      return;
    }

    // First, aggregate data based on selected timeframe
    const aggregatedData = getTimeframeData(data, timeframe);
    console.log(`[Chart] Aggregated ${aggregatedData.length} data points for timeframe ${timeframe}`);
    
    if (!aggregatedData || aggregatedData.length === 0) {
      console.warn('No aggregated data available');
      return;
    }
    
    // Remove duplicates by using a Map with timestamp as key
    const uniqueDataMap = new Map();
    aggregatedData.forEach(item => {
      if (item && item.datetime) {
        const timestamp = Math.floor(new Date(item.datetime).getTime() / 1000);
        if (!uniqueDataMap.has(timestamp)) {
          uniqueDataMap.set(timestamp, item);
        }
      }
    });
    
    // Convert back to array and sort
    const uniqueData = Array.from(uniqueDataMap.values())
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    
    if (uniqueData.length === 0) {
      console.warn('No unique data after deduplication');
      return;
    }
    
    // For ALL timeframe, show everything; otherwise apply range selection
    let displayData;
    if (timeframe === 'ALL') {
      displayData = uniqueData; // Show ALL data for full historical view
      console.log(`[Chart] Showing ALL data: ${uniqueData.length} points`);
    } else {
      const startIdx = Math.floor((selectedRange[0] / 100) * uniqueData.length);
      const endIdx = Math.floor((selectedRange[1] / 100) * uniqueData.length);
      displayData = uniqueData.slice(startIdx, Math.max(endIdx, startIdx + 1)); // Ensure at least 1 data point
      console.log(`[Chart] Showing range ${selectedRange[0]}%-${selectedRange[1]}%: ${displayData.length} points`);
    }

    // Convert data to TradingView format with validation
    const candleData = displayData
      .filter(item => {
        // Validate each data point
        return item && 
               item.datetime && 
               !isNaN(item.open) && 
               !isNaN(item.high) && 
               !isNaN(item.low) && 
               !isNaN(item.close) &&
               item.open > 0 &&
               item.high > 0 &&
               item.low > 0 &&
               item.close > 0;
      })
      .map(item => ({
        time: Math.floor(new Date(item.datetime).getTime() / 1000) as Time,
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close)
      }));

    console.log(`[Chart] Setting ${candleData.length} candles from ${displayData.length} display data`);
    
    if (candleData.length > 0) {
      // Log the date range being displayed
      const firstCandle = candleData[0];
      const lastCandle = candleData[candleData.length - 1];
      const firstDate = new Date(firstCandle.time * 1000);
      const lastDate = new Date(lastCandle.time * 1000);
      console.log(`[Chart] Date range: ${firstDate.toISOString().split('T')[0]} to ${lastDate.toISOString().split('T')[0]}`);
      console.log(`[Chart] First candle time: ${firstCandle.time}, Last candle time: ${lastCandle.time}`);
      
      candlestickSeriesRef.current.setData(candleData);
    } else {
      console.warn('[Chart] No valid candle data to display');
    }

    // Update volume series
    if (volumeSeriesRef.current) {
      if (showVolume) {
        const volumeData = displayData
          .filter(item => item && item.datetime)
          .map(item => ({
            time: Math.floor(new Date(item.datetime).getTime() / 1000) as Time,
            value: item.volume || 0,
            color: item.close >= item.open ? '#26a69a' : '#ef5350'
          }));
        volumeSeriesRef.current.setData(volumeData);
        volumeSeriesRef.current.applyOptions({ visible: true });
      } else {
        volumeSeriesRef.current.applyOptions({ visible: false });
      }
    }

    // Calculate and add Bollinger Bands if enabled
    if (indicators.bb && displayData.length > 20) {
      const bbData = calculateBollingerBands(displayData);
      
      if (!bbUpperRef.current && chartRef.current) {
        bbUpperRef.current = chartRef.current.addSeries(LineSeries, {
          color: 'rgba(255, 176, 0, 0.5)',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false
        });
        bbMiddleRef.current = chartRef.current.addSeries(LineSeries, {
          color: 'rgba(255, 176, 0, 0.3)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false
        });
        bbLowerRef.current = chartRef.current.addSeries(LineSeries, {
          color: 'rgba(255, 176, 0, 0.5)',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false
        });
      }
      
      if (bbUpperRef.current) bbUpperRef.current.setData(bbData.upper);
      if (bbMiddleRef.current) bbMiddleRef.current.setData(bbData.middle);
      if (bbLowerRef.current) bbLowerRef.current.setData(bbData.lower);
    }

    // Calculate and add EMA if enabled
    if (indicators.ema && displayData.length > 20) {
      const emaData = calculateEMA(displayData, 20);
      
      if (!emaRef.current && chartRef.current) {
        emaRef.current = chartRef.current.addSeries(LineSeries, {
          color: 'rgba(33, 150, 243, 0.8)',
          lineWidth: 2,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false
        });
      }
      
      if (emaRef.current) emaRef.current.setData(emaData);
    }

    // Calculate price change
    if (displayData.length > 1) {
      const first = displayData[0];
      const last = displayData[displayData.length - 1];
      if (first && last && first.close > 0 && last.close > 0) {
        const change = last.close - first.close;
        const percent = (change / first.close) * 100;
        setPriceChange(change);
        setPercentChange(percent);
        setCurrentPrice(Number(last.close));
      }
    }

    // Fit content
    if (chartRef.current && candleData.length > 0) {
      try {
        chartRef.current.timeScale().fitContent();
      } catch (err) {
        console.warn('[Chart] Error fitting content:', err);
      }
    }

    // Notify parent of range change
    if (onRangeChange && displayData.length > 0) {
      onRangeChange(
        new Date(displayData[0].datetime),
        new Date(displayData[displayData.length - 1].datetime)
      );
    }
  }, [data, selectedRange, showVolume, onRangeChange, indicators, timeframe]);

  // Calculate Bollinger Bands
  const calculateBollingerBands = (data: any[]) => {
    const period = 20;
    const stdDev = 2;
    const upper: any[] = [];
    const middle: any[] = [];
    const lower: any[] = [];

    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const avg = slice.reduce((sum, item) => sum + item.close, 0) / period;
      const variance = slice.reduce((sum, item) => sum + Math.pow(item.close - avg, 2), 0) / period;
      const std = Math.sqrt(variance);
      
      const time = (new Date(data[i].datetime).getTime() / 1000) as Time;
      upper.push({ time, value: avg + std * stdDev });
      middle.push({ time, value: avg });
      lower.push({ time, value: avg - std * stdDev });
    }

    return { upper, middle, lower };
  };

  // Calculate EMA
  const calculateEMA = (data: any[], period: number) => {
    const ema: any[] = [];
    const multiplier = 2 / (period + 1);
    let prevEMA = data[0].close;

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        prevEMA = (prevEMA * i + data[i].close) / (i + 1);
      } else {
        prevEMA = (data[i].close - prevEMA) * multiplier + prevEMA;
      }
      ema.push({
        time: (new Date(data[i].datetime).getTime() / 1000) as Time,
        value: prevEMA
      });
    }

    return ema;
  };

  // Aggregate OHLC data for different timeframes
  const aggregateOHLC = (data: any[], periodMinutes: number) => {
    if (!data || data.length === 0) return [];
    
    const aggregated: any[] = [];
    const candlesPerPeriod = periodMinutes / 5; // Since base data is 5-minute candles
    
    for (let i = 0; i < data.length; i += candlesPerPeriod) {
      const slice = data.slice(i, Math.min(i + candlesPerPeriod, data.length));
      
      if (slice.length === 0) continue;
      
      // Calculate OHLC for this period
      const open = slice[0].open;
      const high = Math.max(...slice.map(d => d.high));
      const low = Math.min(...slice.map(d => d.low));
      const close = slice[slice.length - 1].close;
      const volume = slice.reduce((sum, d) => sum + (d.volume || 0), 0);
      
      aggregated.push({
        datetime: slice[0].datetime,
        open,
        high,
        low,
        close,
        volume
      });
    }
    
    return aggregated;
  };

  // Get aggregated data based on timeframe
  const getTimeframeData = (allData: any[], tf: typeof timeframe) => {
    if (!allData || allData.length === 0) return [];
    
    switch (tf) {
      case '5M':
        // Original 5-minute data (no aggregation needed)
        return allData;
      case '15M':
        // Aggregate every 3 candles
        return aggregateOHLC(allData, 15);
      case '30M':
        // Aggregate every 6 candles
        return aggregateOHLC(allData, 30);
      case '1H':
        // Aggregate every 12 candles
        return aggregateOHLC(allData, 60);
      case '4H':
        // Aggregate every 48 candles
        return aggregateOHLC(allData, 240);
      case '1D':
        // For daily, we aggregate all candles within each trading day
        // Assuming ~59 candles per day (295 minutes / 5)
        return aggregateOHLC(allData, 295);
      case '1W':
        // Weekly aggregation (5 trading days)
        return aggregateOHLC(allData, 1475); // 295 * 5 minutes
      case 'ALL':
        // Show all data with 5-minute granularity
        return allData;
      default:
        return allData;
    }
  };

  // Timeframe presets (now with proper aggregation)
  const handleTimeframeChange = (tf: typeof timeframe) => {
    setTimeframe(tf);
    
    // For ALL, show everything
    if (tf === 'ALL') {
      setSelectedRange([0, 100]);
      return;
    }
    
    // For other timeframes, we'll aggregate the data in the useEffect
    // and show the appropriate range
    setSelectedRange([0, 100]);
  };

  // Zoom controls
  const handleZoom = (direction: 'in' | 'out') => {
    const [start, end] = selectedRange;
    const range = end - start;
    const delta = range * 0.1;

    if (direction === 'in' && range > 5) {
      setSelectedRange([start + delta, end - delta]);
    } else if (direction === 'out') {
      setSelectedRange([
        Math.max(0, start - delta),
        Math.min(100, end + delta)
      ]);
    }
  };

  // Reset view
  const handleReset = () => {
    setSelectedRange([0, 100]);
    setTimeframe('ALL');
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  // Export chart
  const handleExport = () => {
    if (chartRef.current) {
      const screenshot = chartRef.current.takeScreenshot();
      screenshot.then((canvas) => {
        const link = document.createElement('a');
        link.download = `usdcop-chart-${format(new Date(), 'yyyy-MM-dd-HHmm')}.png`;
        link.href = canvas.toDataURL();
        link.click();
      });
    }
  };

  return (
    <Card className="bg-gray-900/50 backdrop-blur border-gray-800 p-4">
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-white">USD/COP</h2>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-mono text-white">
              ${(typeof currentPrice === 'number' ? currentPrice : 0).toFixed(2)}
            </span>
            <span className={`text-sm font-medium ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {priceChange >= 0 ? '+' : ''}{(typeof priceChange === 'number' ? priceChange : 0).toFixed(2)} ({(typeof percentChange === 'number' ? percentChange : 0).toFixed(2)}%)
            </span>
          </div>
          {isRealtime && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-lg">
              <Activity className="w-4 h-4 animate-pulse" />
              <span className="text-sm">Live</span>
            </div>
          )}
        </div>

        {/* Timeframe buttons */}
        <div className="flex items-center gap-2">
          {(['5M', '15M', '30M', '1H', '4H', '1D', '1W', 'ALL'] as const).map(tf => (
            <Button
              key={tf}
              variant={timeframe === tf ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleTimeframeChange(tf)}
              className={timeframe === tf ? 'bg-blue-600' : ''}
            >
              {tf}
            </Button>
          ))}
        </div>

        {/* Chart tools */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleZoom('in')}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleZoom('out')}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleExport}>
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Chart container with loading state */}
      <div className="relative">
        <div ref={chartContainerRef} className="w-full h-[500px] rounded-lg overflow-hidden" />
        {(!data || data.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-lg">
            <div className="text-gray-400">Loading chart data...</div>
          </div>
        )}
      </div>

      {/* Time range slider */}
      <div className="mt-4 px-4">
        <div className="flex items-center gap-4">
          <Calendar className="w-4 h-4 text-gray-400" />
          <Slider
            value={selectedRange}
            onValueChange={setSelectedRange}
            min={0}
            max={100}
            step={0.1}
            className="flex-1"
          />
          <span className="text-sm text-gray-400 min-w-[120px]">
            {data.length > 0 && (
              <>
                {format(new Date(data[Math.floor((selectedRange[0] / 100) * data.length)]?.datetime || data[0].datetime), 'MMM dd, yyyy')}
                {' - '}
                {format(new Date(data[Math.floor((selectedRange[1] / 100) * data.length - 1)]?.datetime || data[data.length - 1].datetime), 'MMM dd, yyyy')}
              </>
            )}
          </span>
        </div>
      </div>

      {/* Additional controls */}
      <div className="mt-4 flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showVolume}
            onChange={(e) => setShowVolume(e.target.checked)}
            className="rounded"
          />
          Volume
        </label>
        <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={indicators.bb}
            onChange={(e) => setIndicators(prev => ({ ...prev, bb: e.target.checked }))}
            className="rounded"
          />
          Bollinger Bands
        </label>
        <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={indicators.ema}
            onChange={(e) => setIndicators(prev => ({ ...prev, ema: e.target.checked }))}
            className="rounded"
          />
          EMA(20)
        </label>
      </div>

      {/* Interactive Tooltip */}
      {hoveredCandle && (
        <div
          className="absolute z-50 bg-gray-900/95 border border-gray-700 rounded-lg p-3 pointer-events-none backdrop-blur-sm shadow-xl"
          style={{
            left: `${tooltipPosition.x + 10}px`,
            top: `${tooltipPosition.y - 100}px`,
            minWidth: '200px'
          }}
        >
          <div className="text-xs text-gray-400 mb-2 font-mono">
            {format(new Date((hoveredCandle.time as number) * 1000), 'dd MMM yyyy HH:mm', { locale: es })}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div className="text-gray-400">Open:</div>
            <div className="text-white font-mono">${hoveredCandle.open.toFixed(2)}</div>
            <div className="text-gray-400">High:</div>
            <div className="text-green-400 font-mono">${hoveredCandle.high.toFixed(2)}</div>
            <div className="text-gray-400">Low:</div>
            <div className="text-red-400 font-mono">${hoveredCandle.low.toFixed(2)}</div>
            <div className="text-gray-400">Close:</div>
            <div className={`font-mono font-semibold ${
              hoveredCandle.close >= hoveredCandle.open ? 'text-green-400' : 'text-red-400'
            }`}>
              ${hoveredCandle.close.toFixed(2)}
            </div>
            <div className="text-gray-400">Change:</div>
            <div className={`font-mono ${
              hoveredCandle.close >= hoveredCandle.open ? 'text-green-400' : 'text-red-400'
            }`}>
              {hoveredCandle.close >= hoveredCandle.open ? '+' : ''}
              {(hoveredCandle.close - hoveredCandle.open).toFixed(2)}
              ({((hoveredCandle.close - hoveredCandle.open) / hoveredCandle.open * 100).toFixed(2)}%)
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};