/**
 * Enhanced Trading Dashboard
 * Ultra-dynamic interface with real-time updates and historical replay
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useMarketStore } from '@/lib/store/market-store';
import { enhancedDataService, EnhancedCandle } from '@/lib/services/enhanced-data-service';
import { AnimatedSidebar } from '@/components/ui/AnimatedSidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { ChartErrorBoundary } from '@/components/common/ErrorBoundary';
import PerformanceStatus from '@/components/status/PerformanceStatus';
import { TrendingUp, TrendingDown, Activity, BarChart3, Clock, AlertCircle } from 'lucide-react';

// Dynamic imports for performance
const LightweightChart = dynamic(() => import('@/components/charts/LightweightChart'), {
  ssr: false,
  loading: () => <div className="h-full bg-gray-900 animate-pulse rounded-xl" />
});

const InteractiveTradingChart = dynamic(() => import('@/components/charts/InteractiveTradingChart').then(mod => ({ default: mod.InteractiveTradingChart })), {
  ssr: false,
  loading: () => <div className="h-full bg-gray-900 animate-pulse rounded-xl" />
});

// NO SYNTHETIC DATA GENERATION ALLOWED
// All data must be real from MinIO or TwelveData API

const EnhancedTradingDashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRealtime, setIsRealtime] = useState(false);
  const [marketStatus, setMarketStatus] = useState<'open' | 'closed' | 'pre-market' | 'after-hours'>('closed');
  const [replayProgress, setReplayProgress] = useState(0);
  const [historicalData, setHistoricalData] = useState<EnhancedCandle[]>([]);
  const [displayData, setDisplayData] = useState<EnhancedCandle[]>([]);
  const [useInteractiveChart, setUseInteractiveChart] = useState(true); // Use interactive chart by default
  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const replayIndexRef = useRef(0);
  
  const {
    candles,
    setCandles,
    appendCandle,
    currentPrice,
    priceChange,
    volume24h,
    high24h,
    low24h,
    connectionStatus,
    setConnectionStatus,
    dataSource,
    setDataSource
  } = useMarketStore();

  // Calculate price change percentage
  const priceChangePercent = candles.length > 1 
    ? ((candles[candles.length - 1].close - candles[0].close) / candles[0].close) * 100 
    : 0;

  // Load initial data on mount
  useEffect(() => {
    loadInitialData();
    checkMarketStatus();
    
    // Check market status every minute
    const statusInterval = setInterval(checkMarketStatus, 60000);
    
    return () => {
      clearInterval(statusInterval);
      stopReplay();
      stopRealtime();
    };
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Try to load from API first
      const response = await fetch('/api/data/historical');
      let data: EnhancedCandle[] = [];
      
      if (response.ok) {
        const result = await response.json();
        data = result.data || [];
        console.log(`[Dashboard] Loaded ${data.length} historical data points from API`);
        // Log date range to debug
        if (data.length > 0) {
          console.log(`[Dashboard] Date range: ${data[0].datetime} to ${data[data.length - 1].datetime}`);
          console.log(`[Dashboard] First data point:`, data[0]);
          console.log(`[Dashboard] Last data point:`, data[data.length - 1]);
        }
      } else {
        // Fallback to service if API fails
        data = await enhancedDataService.loadCompleteHistory();
        console.log(`[Dashboard] Loaded ${data.length} historical data points from service`);
      }
      
      // Process data in chunks to avoid blocking
      requestAnimationFrame(() => {
        // Remove duplicates and sort data by datetime
        const uniqueDataMap = new Map();
        data.forEach(item => {
          const timestamp = new Date(item.datetime).getTime();
          if (!uniqueDataMap.has(timestamp) || item.close > 0) { // Prefer non-zero data
            uniqueDataMap.set(timestamp, item);
          }
        });
        
        // Convert map back to array and sort
        const cleanedData = Array.from(uniqueDataMap.values())
          .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
        
        console.log(`[Dashboard] Cleaned data: ${cleanedData.length} unique points from ${data.length} total`);
        
        // Store full historical data
        setHistoricalData(cleanedData);
        
        // Display ALL historical data (2020-2025)
        console.log(`[Dashboard] Setting display data: ${cleanedData.length} points`);
        if (cleanedData.length > 0) {
          const firstPoint = cleanedData[0];
          const lastPoint = cleanedData[cleanedData.length - 1];
          console.log(`[Dashboard] Full data range: ${firstPoint.datetime} to ${lastPoint.datetime}`);
        }
        
        setCandles(cleanedData); // No slicing - show ALL data
        setDisplayData(cleanedData); // No slicing - show ALL data
      });
    } catch (error) {
      console.error('[Dashboard] ❌ Failed to load data:', error);
      console.error('[Dashboard] NO mock data will be generated - using only real data');
      // NO MOCK DATA - Better to show empty than fake data
      setHistoricalData([]);
      setDisplayData([]);
      setCandles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const checkMarketStatus = () => {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hour * 60 + minutes;
    const day = now.getDay();
    
    // Market closed on weekends
    if (day === 0 || day === 6) {
      setMarketStatus('closed');
      return;
    }
    
    // Trading hours: 8:00 AM - 12:55 PM (Colombia time)
    if (totalMinutes >= 480 && totalMinutes <= 775) {
      setMarketStatus('open');
    } else if (totalMinutes >= 420 && totalMinutes < 480) {
      setMarketStatus('pre-market');
    } else if (totalMinutes > 775 && totalMinutes <= 840) {
      setMarketStatus('after-hours');
    } else {
      setMarketStatus('closed');
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      stopReplay();
    } else {
      startReplay();
    }
  };

  const startReplay = () => {
    if (historicalData.length === 0) return;
    
    console.log('[Dashboard] Starting FULL historical replay from 2020');
    setIsPlaying(true);
    stopRealtime(); // Stop realtime if active
    
    // Start from the BEGINNING (index 0) to replay ALL historical data from 2020
    const startIndex = 0; // Start from 2020!
    console.log(`[Dashboard] Starting replay from beginning: ${historicalData.length} total points`);
    
    // Initialize with first batch of data
    const initialBatchSize = 500; // Show first 500 candles
    const initialData = historicalData.slice(0, initialBatchSize);
    setDisplayData(initialData);
    setCandles(initialData);
    replayIndexRef.current = initialBatchSize;
    
    // Replay with adaptive batch size for smoother animation
    replayIntervalRef.current = setInterval(() => {
      if (replayIndexRef.current >= historicalData.length) {
        console.log('[Dashboard] Replay complete');
        stopReplay();
        return;
      }
      
      // Adaptive batch size based on remaining data
      const remaining = historicalData.length - replayIndexRef.current;
      // Larger batch sizes for faster replay of 84,455 points
      const batchSize = Math.min(remaining > 10000 ? 500 : remaining > 1000 ? 100 : 20, remaining);
      const endIndex = replayIndexRef.current + batchSize;
      
      // Use requestAnimationFrame for smoother updates
      requestAnimationFrame(() => {
        const newData = historicalData.slice(0, endIndex); // Show from beginning to current position
        setDisplayData(newData);
        setCandles(newData); // Keep ALL data for full historical view
        
        // Update progress
        const progress = (endIndex / historicalData.length) * 100;
        setReplayProgress(progress);
      });
      
      replayIndexRef.current = endIndex;
    }, 50); // Faster updates but smaller batches
  };

  const stopReplay = () => {
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
    }
    setIsPlaying(false);
    setReplayProgress(0);
  };

  const processAlignedData = (allData: any[]) => {
    // Find last available date in dataset
    const lastDataPoint = allData[allData.length - 1];
    const lastDate = new Date(lastDataPoint.datetime);
    const today = new Date();
    
    // Calculate gap in days
    const gapInMs = today.getTime() - lastDate.getTime();
    const gapInDays = Math.floor(gapInMs / (1000 * 60 * 60 * 24));
    
    console.log(`[Dashboard] Last data: ${lastDate.toISOString()}, Today: ${today.toISOString()}`);
    console.log(`[Dashboard] Data gap: ${gapInDays} days`);
    console.log(`[Dashboard] Total data points received: ${allData.length}`);
    
    // IMPORTANT: The backend already filtered for trading hours
    // DO NOT filter again in the frontend - just use the data as-is
    const alignedData = allData;
    
    console.log(`[Dashboard] Using all ${alignedData.length} points from backend (already filtered for trading hours)`);
    
    // Store all the aligned data
    setHistoricalData(alignedData);
    
    // Display ALL historical data - no slicing!
    const dataToDisplay = alignedData; // Show ALL data from 2020-2025
    
    console.log(`[Dashboard] Displaying last ${dataToDisplay.length} points`);
    
    console.log(`[Dashboard] Displaying last ${dataToDisplay.length} points from dataset`);
    if (dataToDisplay.length > 0) {
      const firstPoint = dataToDisplay[0];
      const lastPoint = dataToDisplay[dataToDisplay.length - 1];
      console.log(`[Dashboard] Display range: ${firstPoint.datetime} to ${lastPoint.datetime}`);
      console.log(`[Dashboard] First displayed: ${new Date(firstPoint.datetime).toLocaleString()} - Close: ${firstPoint.close}`);
      console.log(`[Dashboard] Last displayed: ${new Date(lastPoint.datetime).toLocaleString()} - Close: ${lastPoint.close}`);
      
      // Check if we have today's data
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const hasToday = dataToDisplay.some((p: any) => p.datetime.startsWith(todayStr));
      console.log(`[Dashboard] Has today's data (${todayStr}): ${hasToday}`);
    }
    
    setDisplayData(dataToDisplay);
    setCandles(dataToDisplay);
    
    // Only start real-time if data is recent (less than 1 day old) AND market is open
    const dataIsRecent = gapInDays <= 1;
    const currentHour = today.getHours();
    const currentMinutes = today.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinutes;
    const currentDay = today.getDay();
    const marketIsOpen = currentDay >= 1 && currentDay <= 5 && currentTotalMinutes >= 480 && currentTotalMinutes <= 775;
    
    if (dataIsRecent && marketIsOpen) {
      console.log('[Dashboard] ✅ Data is recent and market is open, starting real-time updates');
      startRealtime();
    } else if (!dataIsRecent) {
      console.log(`[Dashboard] ⚠️ Data is ${gapInDays} days old, real-time disabled until fresh data is available`);
    } else if (!marketIsOpen) {
      console.log('[Dashboard] ⏸️ Market is closed, real-time updates disabled');
    }
  };

  const handleReset = () => {
    console.log('[Dashboard] Resetting to current data');
    stopReplay();
    stopRealtime();
    
    // Reset to show last 7 days of data
    const today = new Date();
    const daysToShow = 7;
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - daysToShow);
    
    const recentData = historicalData.filter((point: any) => {
      const pointDate = new Date(point.datetime);
      return pointDate >= cutoffDate;
    });
    
    const dataToDisplay = recentData; // Display ALL data without limits
    
    console.log(`[Dashboard] Reset: Showing ${dataToDisplay.length} points from last ${daysToShow} days`);
    setDisplayData(dataToDisplay);
    setCandles(dataToDisplay);
    setReplayProgress(0);
  };

  const handleAlignDataset = async () => {
    console.log('[Dashboard] Starting complete data alignment process...');
    setIsLoading(true);
    
    try {
      // SIMPLIFIED: Go directly to align endpoint which handles everything
      console.log('[Dashboard] Fetching aligned dataset with real-time data...');
      const response = await fetch('/api/market/realtime?action=align');
      if (!response.ok) throw new Error('Failed to fetch aligned data');
      
      const result = await response.json();
      const allData = result.data || [];
      const meta = result.meta || {};
      
      console.log(`[Dashboard] Aligned dataset loaded:`);
      console.log(`  - Total: ${meta.total} points`);
      console.log(`  - Historical: ${meta.historical} points`);
      console.log(`  - Realtime: ${meta.realtime} points`);
      console.log(`  - Date range: ${meta.startDate} to ${meta.endDate}`);
      
      if (allData.length === 0) {
        console.error('[Dashboard] No data available');
        return;
      }
      
      // Log the last 5 data points to verify we have today's data
      console.log('[Dashboard] Last 5 data points received:');
      const last5 = allData.slice(-5);
      last5.forEach((point: any) => {
        console.log(`  ${point.datetime}: Close=${point.close}, Source=${point.source}`);
      });
      
      processAlignedData(allData);
    } catch (error) {
      console.error('[Dashboard] Failed to align dataset:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startRealtime = () => {
    if (marketStatus === 'closed') {
      console.log('[Dashboard] Market is closed, real-time updates disabled');
      return;
    }
    
    setIsRealtime(true);
    stopReplay(); // Stop replay if active
    
    // Start realtime updates on the server
    fetch('/api/market/realtime?action=start')
      .then(res => res.json())
      .then(result => {
        console.log('[Dashboard] Real-time updates configured:', result.schedule);
      });
    
    // Update every minute to check for new 5-minute candles
    realtimeIntervalRef.current = setInterval(async () => {
      const now = new Date();
      const minutes = now.getMinutes();
      
      // Only fetch at 5-minute intervals (00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
      if (minutes % 5 === 0) {
        if (marketStatus === 'closed') {
          console.log('[Dashboard] Market closed, stopping real-time updates');
          stopRealtime();
          return;
        }
        
        try {
          // Fetch latest data point from TwelveData
          const response = await fetch('/api/market/realtime?action=fetch');
          if (response.ok) {
            const result = await response.json();
            const latestData = result.data || [];
            
            if (latestData.length > 0) {
              const latestPoint = latestData[latestData.length - 1];
              console.log(`[Dashboard] New real-time candle at ${now.toLocaleTimeString()}:`, latestPoint);
              
              // Check if this is a new candle (not duplicate)
              const exists = displayData.some(d => d.datetime === latestPoint.datetime);
              if (!exists) {
                appendCandle(latestPoint);
                setDisplayData(prev => [...prev, latestPoint]); // Keep ALL data
                setHistoricalData(prev => [...prev, latestPoint]);
              }
            } else {
              console.error('[Dashboard] No real-time data available - API key may be invalid');
            }
          } else {
            const errorData = await response.json();
            console.error('[Dashboard] API Error:', errorData.message || 'Unknown error');
            // Show error once per session
            if (!window.apiErrorShown) {
              window.apiErrorShown = true;
              alert('⚠️ No se pueden obtener datos en tiempo real\n\n' +
                    'Necesitas una API key válida de TwelveData (es GRATIS)\n\n' +
                    '1. Ve a: https://twelvedata.com/pricing\n' +
                    '2. Regístrate gratis\n' +
                    '3. Actualiza .env.local:\n' +
                    '   TWELVE_DATA_API_KEY=tu_clave_aqui\n' +
                    '4. Reinicia el servidor');
            }
          }
        } catch (error) {
          console.error('[Dashboard] Real-time update failed:', error);
        }
      }
    }, 60000); // Check every minute
    
    console.log('[Dashboard] Real-time updates started (5-minute candles at :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55)');
  };

  const stopRealtime = () => {
    if (realtimeIntervalRef.current) {
      clearInterval(realtimeIntervalRef.current);
      realtimeIntervalRef.current = null;
    }
    setIsRealtime(false);
  };

  const handleDataSourceChange = async (source: 'l0' | 'l1' | 'mock') => {
    if (source === 'mock') {
      console.error('[Dashboard] ❌ Mock data is PROHIBITED. Only real data allowed.');
      alert('Mock data is not allowed. Please use L0 or L1 real data sources.');
      return;
    }
    
    console.log(`[Dashboard] Switching data source to ${source}`);
    setDataSource(source);
    
    // Reload data from new source - REAL DATA ONLY
    setIsLoading(true);
    try {
      const response = await fetch(`/api/data/historical?source=${source}`);
      let data: EnhancedCandle[] = [];
      
      if (response.ok) {
        const result = await response.json();
        data = result.data || [];
        console.log(`[Dashboard] Loaded ${data.length} REAL data points from ${source}`);
      } else {
        console.error(`[Dashboard] Failed to load data from ${source}`);
        data = [];
      }
      
      setHistoricalData(data);
      const recentData = data; // Show ALL historical data
      setCandles(recentData);
      setDisplayData(recentData);
    } catch (error) {
      console.error('[Dashboard] Failed to switch data source:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Animated Sidebar */}
      <AnimatedSidebar
        onPlayPause={handlePlayPause}
        onReset={handleReset}
        onAlignDataset={handleAlignDataset}
        isPlaying={isPlaying}
        isRealtime={isRealtime}
        dataSource={dataSource}
        onDataSourceChange={handleDataSourceChange}
        marketStatus={marketStatus}
        currentPrice={currentPrice}
        priceChange={priceChange}
        priceChangePercent={priceChangePercent}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <motion.header 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gray-900/50 backdrop-blur-xl border-b border-gray-800 px-6 py-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-2xl font-bold text-white">USD/COP Trading Terminal</h1>
              
              {/* Status Indicators */}
              <div className="flex items-center gap-4">
                {isPlaying && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg"
                  >
                    <Activity className="w-4 h-4 animate-pulse" />
                    <span className="text-sm">Replaying... {replayProgress.toFixed(1)}%</span>
                  </motion.div>
                )}
                
                {isRealtime && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-lg"
                  >
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm">Real-time Active</span>
                  </motion.div>
                )}
                
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-lg">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
            
            {/* Performance Status */}
            <PerformanceStatus />
          </div>
        </motion.header>
        
        {/* Chart Area */}
        <div className="flex-1 p-6 overflow-hidden">
          <ChartErrorBoundary>
            {isLoading ? (
              <Card className="h-full bg-gray-900/50 backdrop-blur border-gray-800 p-4">
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Activity className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Loading market data...</p>
                  </div>
                </div>
              </Card>
            ) : displayData.length > 0 ? (
              // Use the new interactive chart
              <InteractiveTradingChart 
                data={displayData}
                isRealtime={isRealtime}
                onRangeChange={(start, end) => {
                  console.log(`[Chart] Range changed: ${start.toISOString()} to ${end.toISOString()}`);
                }}
              />
            ) : (
              <Card className="h-full bg-gray-900/50 backdrop-blur border-gray-800 p-4">
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                    <p className="text-gray-400">No data available</p>
                    <button
                      onClick={loadInitialData}
                      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Load Data
                    </button>
                  </div>
                </div>
              </Card>
            )}
          </ChartErrorBoundary>
        </div>
        
        {/* Bottom Status Bar */}
        <motion.footer
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gray-900/50 backdrop-blur-xl border-t border-gray-800 px-6 py-2"
        >
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <span>Data Points: {displayData.length}</span>
              <span>•</span>
              <span>Source: {dataSource.toUpperCase()}</span>
              <span>•</span>
              <span>Interval: 5min</span>
            </div>
            <div className="flex items-center gap-4">
              <span>24h Volume: ${(volume24h / 1000000).toFixed(2)}M</span>
              <span>•</span>
              <span>24h High: ${high24h.toFixed(2)}</span>
              <span>•</span>
              <span>24h Low: ${low24h.toFixed(2)}</span>
            </div>
          </div>
        </motion.footer>
      </div>
    </div>
  );
};

export default EnhancedTradingDashboard;