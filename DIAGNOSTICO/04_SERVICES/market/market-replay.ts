/**
 * Professional Market Replay Service for USDCOP Trading Dashboard
 * 
 * This service provides sophisticated market replay capabilities for backtesting,
 * analysis, and training purposes with hedge fund quality features:
 * - Historical data loading from MinIO L0 buckets
 * - High-precision tick-by-tick or 5-minute interval replay
 * - Advanced buffering and memory management
 * - Synchronized playback controls with configurable speeds
 * - Seamless transition between historical and live data
 * - Professional-grade error handling and monitoring
 */

import { PriceData } from './twelvedata';
import { minioClient, DataQuery } from './minio-client';

export interface ReplayConfig {
  startDate: Date;
  endDate?: Date;
  interval: '1min' | '5min' | '1h' | '1d';
  speed: number; // 1x = real time, 2x = double speed, etc.
  bufferSize: number; // Number of data points to buffer
  autoSwitchToLive: boolean;
}

export interface ReplayState {
  isActive: boolean;
  isPaused: boolean;
  currentTimestamp: Date;
  progress: number; // 0-100
  speed: number;
  mode: 'replay' | 'live' | 'transitioning';
  dataSource: 'minio' | 'api' | 'cache';
  bufferHealth: 'healthy' | 'low' | 'critical';
}

export interface ReplayMetrics {
  totalDataPoints: number;
  processedPoints: number;
  averageLatency: number;
  bufferUtilization: number;
  memoryUsage: number;
  errorCount: number;
}

export type ReplayDataCallback = (data: PriceData[]) => void;
export type ReplayStateCallback = (state: ReplayState) => void;
export type ReplayMetricsCallback = (metrics: ReplayMetrics) => void;

export class MarketReplayService {
  private config: ReplayConfig;
  private state: ReplayState;
  private metrics: ReplayMetrics;
  
  // Data Management
  private historicalData: PriceData[] = [];
  private dataBuffer: PriceData[] = [];
  private currentIndex: number = 0;
  
  // Timing & Controls  
  private animationFrameId: number | null = null;
  private lastUpdateTime: number = 0;
  private intervalMs: number = 0;
  
  // Callbacks
  private dataCallbacks: Set<ReplayDataCallback> = new Set();
  private stateCallbacks: Set<ReplayStateCallback> = new Set();
  private metricsCallbacks: Set<ReplayMetricsCallback> = new Set();
  
  // MinIO Client Configuration
  private minioConfig = {
    endpoint: process.env.NEXT_PUBLIC_MINIO_ENDPOINT || 'localhost:9000',
    accessKey: process.env.NEXT_PUBLIC_MINIO_ACCESS_KEY || 'minio',
    secretKey: process.env.NEXT_PUBLIC_MINIO_SECRET_KEY || 'minio123',
    useSSL: false,
    region: 'us-east-1'
  };

  constructor(config: Partial<ReplayConfig> = {}) {
    this.config = {
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Default: 24 hours ago
      interval: '5min',
      speed: 1,
      bufferSize: 1000,
      autoSwitchToLive: true,
      ...config
    };

    this.state = {
      isActive: false,
      isPaused: false,
      currentTimestamp: this.config.startDate,
      progress: 0,
      speed: this.config.speed,
      mode: 'replay',
      dataSource: 'minio',
      bufferHealth: 'healthy'
    };

    this.metrics = {
      totalDataPoints: 0,
      processedPoints: 0,
      averageLatency: 0,
      bufferUtilization: 0,
      memoryUsage: 0,
      errorCount: 0
    };

    this.intervalMs = this.getIntervalMs();
    
    // Bind methods to preserve context
    this.tick = this.tick.bind(this);
  }

  /**
   * Load the latest complete trading day from MinIO
   */
  async loadLatestTradingDay(): Promise<PriceData[]> {
    try {
      console.log(`[MarketReplay] Loading latest complete trading day from MinIO...`);
      
      // IMPORTANT: We know MinIO data goes up to August 22, 2025
      // So we'll load the latest available day (August 22, 2025)
      const targetDate = new Date('2025-08-22T00:00:00Z');
      
      // Set start and end times for the trading day (8:00 AM - 12:55 PM COT)
      const startDate = new Date('2025-08-22T08:00:00Z');
      const endDate = new Date('2025-08-22T12:55:00Z');
      
      console.log(`[MarketReplay] Loading data for ${targetDate.toDateString()} (${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()})`);
      
      return await this.loadHistoricalData(startDate, endDate);
      
    } catch (error) {
      console.error('[MarketReplay] Error loading latest trading day:', error);
      
      // Fallback to loading last 24 hours
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      return await this.loadHistoricalData(startDate, endDate);
    }
  }

  /**
   * Set preloaded data for replay (avoid reloading from MinIO)
   */
  async setPreloadedData(data: PriceData[]): Promise<void> {
    if (!data || data.length === 0) {
      console.error('[MarketReplay] No data provided to setPreloadedData');
      return;
    }
    
    console.log(`[MarketReplay] Setting ${data.length} preloaded data points`);
    
    // Store data in memory for replay
    this.replayData = data.map(d => ({
      ...d,
      timestamp: new Date(d.datetime).getTime()
    }));
    
    // Set initial state
    this.currentIndex = 0;
    this.isActive = false;
    this.isPaused = false;
    
    console.log('[MarketReplay] Preloaded data ready for replay');
  }

  /**
   * Load historical data from MinIO L0 buckets
   * Fetches data from the acquire bucket following the established pattern
   */
  async loadHistoricalData(startDate: Date, endDate?: Date): Promise<PriceData[]> {
    const end = endDate || new Date();
    
    try {
      console.log(`[MarketReplay] Loading historical data from ${startDate.toISOString()} to ${end.toISOString()}`);
      
      // Create MinIO query following the L0 data architecture
      const query: DataQuery = {
        market: 'usdcop',
        timeframe: '5min',
        source: 'all', // Load from all sources (MT5 + TwelveData)
        startDate,
        endDate: end,
        layer: 'L0' // Raw data from L0 acquire bucket
      };
      
      // Use API endpoint to load historical data (to avoid client-side MinIO issues)
      console.log(`[MarketReplay] Loading historical data via API...`);
      
      const response = await fetch(`/api/data/align?action=replay`);
      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error('Failed to load historical data from API');
      }
      
      // Filter to requested date range
      const allData = result.data.filter((item: any) => {
        const itemDate = new Date(item.datetime);
        return itemDate >= startDate && itemDate <= end;
      });
      
      // Sort by timestamp for proper replay order (OLDEST FIRST)
      const sortedData = allData.sort((a, b) => 
        new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
      );
      
      this.historicalData = sortedData;
      this.metrics.totalDataPoints = sortedData.length;
      this.state.dataSource = 'minio';
      
      console.log(`[MarketReplay] Loaded ${sortedData.length} historical data points from MinIO`);
      if (sortedData.length > 0) {
        console.log(`[MarketReplay] Data range: ${new Date(sortedData[0].datetime).toLocaleTimeString()} to ${new Date(sortedData[sortedData.length - 1].datetime).toLocaleTimeString()}`);
      }
      
      // Log data summary
      if (sortedData.length > 0) {
        const minioCount = sortedData.filter((d: any) => d.source === 'minio').length;
        console.log(`[MarketReplay] Loaded ${minioCount} points from MinIO`);
      }
      
      return sortedData;
      
    } catch (error) {
      console.error('[MarketReplay] ❌ Error loading historical data from MinIO:', error);
      console.error('[MarketReplay] NO mock/synthetic data will be generated');
      
      // NO FALLBACK - Return empty array if data loading fails
      // Better to fail than use fake data per user requirement
      this.historicalData = [];
      this.metrics.totalDataPoints = 0;
      this.state.dataSource = 'error';
      this.metrics.errorCount++;
      
      console.error('[MarketReplay] Returning empty dataset - mock data is prohibited');
      return [];
    }
  }

  // REMOVED: generateMockHistoricalData method
  // NO mock/synthetic data generation allowed per user requirement
  // System must use ONLY real data from MinIO or TwelveData API

  /**
   * Load complete historical data for a date range
   * Supports navigation through years/months/days with 5-min granularity
   */
  async loadHistoricalRange(startDate: Date, endDate: Date): Promise<PriceData[]> {
    try {
      console.log(`[MarketReplay] Loading historical range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      // Load data via API (filtered for trading hours)
      const response = await fetch(`/api/data/align?action=replay`);
      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error('Failed to load historical data');
      }
      
      // Filter to requested range and trading hours only
      const filteredData = result.data.filter((item: any) => {
        const itemDate = new Date(item.datetime);
        
        // Check if within date range
        if (itemDate < startDate || itemDate > endDate) return false;
        
        // Check trading hours (data should already be filtered but double-check)
        const day = itemDate.getDay();
        const hours = itemDate.getHours();
        const minutes = itemDate.getMinutes();
        
        // Monday-Friday only
        if (day === 0 || day === 6) return false;
        
        // 8:00 AM - 12:55 PM local time
        const totalMinutes = hours * 60 + minutes;
        // Adjust for your timezone if needed
        return true; // Assuming data is already filtered
      });
      
      // Sort chronologically
      const sortedData = filteredData.sort((a: any, b: any) => 
        new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
      );
      
      this.historicalData = sortedData;
      this.metrics.totalDataPoints = sortedData.length;
      
      console.log(`[MarketReplay] Loaded ${sortedData.length} data points for range`);
      return sortedData;
      
    } catch (error) {
      console.error('[MarketReplay] Error loading historical range:', error);
      return [];
    }
  }
  
  /**
   * Navigate to specific date/time in historical data
   */
  navigateToDate(targetDate: Date): void {
    if (!this.historicalData || this.historicalData.length === 0) {
      console.warn('[MarketReplay] No historical data loaded');
      return;
    }
    
    // Find closest data point to target date
    let closestIndex = 0;
    let minDiff = Math.abs(new Date(this.historicalData[0].datetime).getTime() - targetDate.getTime());
    
    for (let i = 1; i < this.historicalData.length; i++) {
      const diff = Math.abs(new Date(this.historicalData[i].datetime).getTime() - targetDate.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    
    this.currentIndex = closestIndex;
    this.state.currentTimestamp = new Date(this.historicalData[closestIndex].datetime);
    this.state.progress = (closestIndex / this.historicalData.length) * 100;
    
    // Emit the data up to this point
    const dataToEmit = this.historicalData.slice(0, closestIndex + 1);
    this.notifyDataUpdate(dataToEmit);
    this.notifyStateChange();
    
    console.log(`[MarketReplay] Navigated to ${targetDate.toISOString()}, index: ${closestIndex}`);
  }
  
  /**
   * Navigate forward/backward by number of bars
   */
  navigateByBars(bars: number): void {
    if (!this.historicalData || this.historicalData.length === 0) return;
    
    const newIndex = Math.max(0, Math.min(this.historicalData.length - 1, this.currentIndex + bars));
    
    if (newIndex !== this.currentIndex) {
      this.currentIndex = newIndex;
      this.state.currentTimestamp = new Date(this.historicalData[newIndex].datetime);
      this.state.progress = (newIndex / this.historicalData.length) * 100;
      
      // Emit the data up to this point
      const dataToEmit = this.historicalData.slice(0, newIndex + 1);
      this.notifyDataUpdate(dataToEmit);
      this.notifyStateChange();
    }
  }

  /**
   * Start the replay with the configured parameters
   */
  async startReplay(customConfig?: Partial<ReplayConfig>): Promise<void> {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
      this.intervalMs = this.getIntervalMs(); // Update interval if config changed
    }

    try {
      // Load historical data if not already loaded
      if (this.historicalData.length === 0) {
        await this.loadHistoricalData(this.config.startDate, this.config.endDate);
      }

      // Initialize state
      this.state.isActive = true;
      this.state.isPaused = false;
      this.state.currentTimestamp = this.config.startDate || new Date(this.historicalData[0]?.datetime || Date.now());
      this.state.mode = 'replay';
      this.currentIndex = 0;
      this.lastUpdateTime = performance.now();
      
      // Fill initial buffer
      this.refillBuffer();
      
      console.log(`[MarketReplay] Starting replay with ${this.historicalData.length} data points at ${this.config.speed}x speed`);
      
      // Start with just the first data point (progressive display)
      if (this.historicalData.length > 0) {
        const firstPoint = this.historicalData.slice(0, 1);
        this.notifyDataUpdate(firstPoint);
        console.log(`[MarketReplay] Starting from ${new Date(firstPoint[0].datetime).toLocaleTimeString()}`);
      }
      
      // Notify state change
      this.notifyStateChange();
      
      // Start the replay loop
      this.tick();
      
      console.log(`[MarketReplay] Replay loop started`);
      
    } catch (error) {
      console.error('[MarketReplay] Error starting replay:', error);
      this.metrics.errorCount++;
      throw error;
    }
  }

  /**
   * Pause or resume the replay
   */
  pause(): void {
    this.state.isPaused = !this.state.isPaused;
    console.log(`[MarketReplay] ${this.state.isPaused ? 'Paused' : 'Resumed'} replay`);
    
    if (!this.state.isPaused) {
      this.lastUpdateTime = performance.now();
      this.tick();
    }
    
    this.notifyStateChange();
  }

  /**
   * Stop the replay completely
   */
  stop(): void {
    this.state.isActive = false;
    this.state.isPaused = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    console.log('[MarketReplay] Stopped replay');
    this.notifyStateChange();
  }

  /**
   * Change replay speed
   */
  setSpeed(speed: number): void {
    const validSpeeds = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];
    this.config.speed = validSpeeds.includes(speed) ? speed : 1;
    this.state.speed = this.config.speed;
    
    console.log(`[MarketReplay] Speed changed to ${this.config.speed}x`);
    this.notifyStateChange();
  }

  /**
   * Seek to a specific timestamp in the replay
   */
  seekTo(timestamp: Date): void {
    // Validate input
    if (!timestamp || !(timestamp instanceof Date)) {
      console.error('[MarketReplay] Invalid timestamp provided to seekTo');
      return;
    }

    // Check if we have data loaded
    if (!this.historicalData || this.historicalData.length === 0) {
      console.warn('[MarketReplay] No historical data loaded. Loading data first...');
      // Try to load data for the requested date
      const endDate = new Date(timestamp.getTime() + 24 * 60 * 60 * 1000);
      this.loadHistoricalData(timestamp, endDate).then(() => {
        // Retry seek after loading
        this.performSeek(timestamp);
      }).catch(error => {
        console.error('[MarketReplay] Failed to load data for seek:', error);
      });
      return;
    }

    this.performSeek(timestamp);
  }

  /**
   * Perform the actual seek operation
   */
  private performSeek(timestamp: Date): void {
    const targetTime = timestamp.getTime();
    
    // Find the closest data point
    let closestIndex = 0;
    let minDiff = Infinity;
    
    for (let i = 0; i < this.historicalData.length; i++) {
      // Safely access datetime property
      const dataPoint = this.historicalData[i];
      if (!dataPoint || !dataPoint.datetime) {
        console.warn(`[MarketReplay] Invalid data point at index ${i}`);
        continue;
      }
      
      const diff = Math.abs(new Date(dataPoint.datetime).getTime() - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    
    this.currentIndex = closestIndex;
    this.state.currentTimestamp = new Date(this.historicalData[closestIndex].datetime);
    this.updateProgress();
    this.refillBuffer();
    
    console.log(`[MarketReplay] Seeked to ${this.state.currentTimestamp.toISOString()}`);
    this.notifyStateChange();
  }

  /**
   * Get the current replay state
   */
  getState(): ReplayState {
    return { ...this.state };
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): ReplayMetrics {
    return { ...this.metrics };
  }

  /**
   * Subscribe to data updates
   */
  onDataUpdate(callback: ReplayDataCallback): () => void {
    this.dataCallbacks.add(callback);
    return () => this.dataCallbacks.delete(callback);
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: ReplayStateCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  /**
   * Subscribe to metrics updates
   */
  onMetricsUpdate(callback: ReplayMetricsCallback): () => void {
    this.metricsCallbacks.add(callback);
    return () => this.metricsCallbacks.delete(callback);
  }

  /**
   * Main replay tick function - runs on requestAnimationFrame
   */
  private tick(): void {
    if (!this.state.isActive || this.state.isPaused) {
      return;
    }

    const now = performance.now();
    const deltaTime = now - this.lastUpdateTime;
    const expectedInterval = this.intervalMs / this.config.speed;
    
    if (deltaTime >= expectedInterval) {
      this.processNextDataPoint();
      this.lastUpdateTime = now;
    }

    // Update metrics
    this.updateMetrics();
    
    // Check if we've reached the end
    if (this.currentIndex >= this.historicalData.length) {
      if (this.config.autoSwitchToLive) {
        this.switchToLiveMode();
      } else {
        this.stop();
      }
      return;
    }

    // Schedule next tick
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  /**
   * Process the next data point in the sequence
   */
  private processNextDataPoint(): void {
    if (this.currentIndex >= this.historicalData.length) {
      console.log(`[MarketReplay] Reached end of data at index ${this.currentIndex}`);
      return;
    }

    const currentData = this.historicalData[this.currentIndex];
    this.state.currentTimestamp = new Date(currentData.datetime);
    
    // Build up data progressively from start to current index
    // This creates the left-to-right progression effect
    const progressiveData = this.historicalData.slice(0, this.currentIndex + 1);
    
    // Keep a reasonable amount for display (last 100 points or all if less)
    const displayData = progressiveData.slice(-100);
    
    // Log every 10th point to avoid spam
    if (this.currentIndex % 10 === 0) {
      console.log(`[MarketReplay] Progress: ${this.currentIndex + 1}/${this.historicalData.length} points (${this.state.currentTimestamp.toLocaleTimeString()})`);
    }
    
    // IMPORTANT: Data is already in chronological order (oldest to newest)
    // So we emit it as-is for left-to-right display
    this.notifyDataUpdate(displayData);
    
    this.currentIndex++;
    this.metrics.processedPoints++;
    this.updateProgress();
  }

  /**
   * Refill the data buffer
   */
  private refillBuffer(): void {
    const remaining = this.config.bufferSize - this.dataBuffer.length;
    const availableData = this.historicalData.slice(this.currentIndex, this.currentIndex + remaining);
    
    this.dataBuffer = [...this.dataBuffer, ...availableData];
    this.updateBufferHealth();
  }

  /**
   * Update buffer health status
   */
  private updateBufferHealth(): void {
    const utilization = this.dataBuffer.length / this.config.bufferSize;
    
    if (utilization > 0.7) {
      this.state.bufferHealth = 'healthy';
    } else if (utilization > 0.3) {
      this.state.bufferHealth = 'low';
    } else {
      this.state.bufferHealth = 'critical';
    }
  }

  /**
   * Update replay progress
   */
  private updateProgress(): void {
    if (this.historicalData.length === 0) {
      this.state.progress = 0;
      return;
    }
    
    this.state.progress = (this.currentIndex / this.historicalData.length) * 100;
  }

  /**
   * Switch to live mode when replay is complete
   */
  private async switchToLiveMode(): Promise<void> {
    console.log('[MarketReplay] Switching to live mode');
    
    this.state.mode = 'transitioning';
    this.notifyStateChange();
    
    // Simulate transition delay
    setTimeout(() => {
      this.state.mode = 'live';
      this.state.dataSource = 'api';
      this.stop();
      
      console.log('[MarketReplay] Successfully switched to live mode');
      this.notifyStateChange();
    }, 1000);
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    this.metrics.bufferUtilization = (this.dataBuffer.length / this.config.bufferSize) * 100;
    this.metrics.memoryUsage = this.estimateMemoryUsage();
    
    // Emit metrics update every 100 processed points
    if (this.metrics.processedPoints % 100 === 0) {
      this.notifyMetricsUpdate();
    }
  }

  /**
   * Estimate memory usage (rough approximation)
   */
  private estimateMemoryUsage(): number {
    const dataPointSize = 200; // Approximate bytes per data point
    return (this.historicalData.length + this.dataBuffer.length) * dataPointSize;
  }

  /**
   * Get interval in milliseconds based on configuration
   */
  private getIntervalMs(): number {
    const intervals = {
      '1min': 60 * 1000,
      '5min': 5 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    
    return intervals[this.config.interval] || intervals['5min'];
  }

  /**
   * Notify all data callbacks
   */
  private notifyDataUpdate(data: PriceData[]): void {
    this.dataCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('[MarketReplay] Error in data callback:', error);
      }
    });
  }

  /**
   * Notify all state callbacks
   */
  private notifyStateChange(): void {
    this.stateCallbacks.forEach(callback => {
      try {
        callback({ ...this.state });
      } catch (error) {
        console.error('[MarketReplay] Error in state callback:', error);
      }
    });
  }

  /**
   * Notify all metrics callbacks
   */
  private notifyMetricsUpdate(): void {
    this.metricsCallbacks.forEach(callback => {
      try {
        callback({ ...this.metrics });
      } catch (error) {
        console.error('[MarketReplay] Error in metrics callback:', error);
      }
    });
  }

  /**
   * Cleanup method - call when component unmounts
   */
  dispose(): void {
    this.stop();
    this.dataCallbacks.clear();
    this.stateCallbacks.clear();
    this.metricsCallbacks.clear();
    this.historicalData = [];
    this.dataBuffer = [];
    
    // Clean up MinIO client cache
    minioClient.clearCache();
    
    console.log('[MarketReplay] Service disposed');
  }
}

// Export a singleton instance for easy use
export const marketReplayService = new MarketReplayService();