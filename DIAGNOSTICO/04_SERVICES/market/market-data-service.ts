/**
 * Market Data Service
 * Connects to TwelveData API for real-time USD/COP prices
 * Manages data alignment, caching, and persistence to MinIO
 */

import * as Minio from 'minio';
import { apiKeyRotation } from './api-key-rotation';

interface MarketDataPoint {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: 'twelvedata' | 'minio' | 'cache';
  timestamp_utc: string;
  hour_cot: number;
  minute_cot: number;
}

interface TwelveDataResponse {
  meta: {
    symbol: string;
    interval: string;
    currency: string;
    exchange_timezone: string;
    exchange: string;
    type: string;
  };
  values: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
  }>;
  status: string;
}

class MarketDataService {
  private static instance: MarketDataService;
  private minioClient: Minio.Client;
  private apiKey: string;
  private baseUrl = 'https://api.twelvedata.com';
  private symbol = 'USD/COP';
  private interval = '5min';
  private updateInterval: NodeJS.Timeout | null = null;
  private dataCache: Map<string, MarketDataPoint> = new Map();
  private lastUpdate: Date | null = null;
  
  // MinIO buckets
  private readonly L0_BUCKET = '00-raw-usdcop-marketdata';
  private readonly L1_BUCKET = '01-l1-ds-usdcop-standardize';
  private readonly REALTIME_BUCKET = 'realtime-usdcop-data';

  private constructor() {
    // Initialize MinIO client
    this.minioClient = new Minio.Client({
      endPoint: 'localhost',
      port: 9000,
      useSSL: false,
      accessKey: 'minioadmin',
      secretKey: 'minioadmin123'
    });

    // TwelveData API key - using rotation service for multiple keys
    // Fallback to env variable if rotation service not available
    this.apiKey = process.env.TWELVE_DATA_API_KEY || '3656827e648a4c6fa2c4e2e7935c4fb8';
    
    // Initialize realtime bucket if it doesn't exist
    this.initializeBuckets();
  }

  static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  private async initializeBuckets() {
    try {
      const exists = await this.minioClient.bucketExists(this.REALTIME_BUCKET);
      if (!exists) {
        await this.minioClient.makeBucket(this.REALTIME_BUCKET, 'us-east-1');
        console.log(`[MarketDataService] Created bucket: ${this.REALTIME_BUCKET}`);
      }
    } catch (error) {
      console.error('[MarketDataService] Error initializing buckets:', error);
    }
  }

  /**
   * Fetch real-time data from TwelveData API
   */
  async fetchRealtimeData(outputsize: number = 100): Promise<MarketDataPoint[]> {
    try {
      // Get next available API key from rotation service
      const apiKey = apiKeyRotation.getNextApiKey();
      
      const url = `${this.baseUrl}/time_series`;
      const params = new URLSearchParams({
        symbol: this.symbol,
        interval: this.interval,
        apikey: apiKey,
        outputsize: outputsize.toString(),
        timezone: 'America/Bogota',
        format: 'JSON'
      });

      console.log(`[MarketDataService] Fetching from TwelveData: ${url}?${params}`);
      
      const response = await fetch(`${url}?${params}`);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data: TwelveDataResponse = await response.json();
      
      if (data.status === 'error') {
        throw new Error('TwelveData API error');
      }

      // Convert to our format
      const marketData: MarketDataPoint[] = data.values.map(point => {
        const datetime = new Date(point.datetime);
        return {
          datetime: point.datetime,
          open: parseFloat(point.open),
          high: parseFloat(point.high),
          low: parseFloat(point.low),
          close: parseFloat(point.close),
          volume: parseFloat(point.volume || '0'),
          source: 'twelvedata',
          timestamp_utc: datetime.toISOString(),
          hour_cot: datetime.getHours(),
          minute_cot: datetime.getMinutes()
        };
      });

      console.log(`[MarketDataService] Fetched ${marketData.length} REAL data points from TwelveData`);
      
      // Update cache
      marketData.forEach(point => {
        this.dataCache.set(point.datetime, point);
      });

      this.lastUpdate = new Date();
      
      return marketData;
    } catch (error) {
      console.error('[MarketDataService] ❌ ERROR fetching realtime data:', error);
      console.error('[MarketDataService] NO mock/synthetic data will be generated');
      
      // NO FALLBACK - Return empty array if API fails
      // Better to fail than to use fake data
      return [];
    }
  }

  // REMOVED: generateDemoData method - NO synthetic data allowed

  /**
   * Save data to MinIO for persistence
   */
  async saveToMinIO(data: MarketDataPoint[], bucket: string = this.REALTIME_BUCKET): Promise<boolean> {
    try {
      const now = new Date();
      const fileName = `usdcop_5min_${now.toISOString().split('T')[0]}_${now.getHours()}${now.getMinutes()}.json`;
      
      const jsonData = JSON.stringify({
        timestamp: now.toISOString(),
        symbol: this.symbol,
        interval: this.interval,
        data: data
      }, null, 2);

      await this.minioClient.putObject(
        bucket,
        fileName,
        Buffer.from(jsonData),
        jsonData.length,
        {
          'Content-Type': 'application/json',
          'X-Data-Source': 'twelvedata',
          'X-Update-Time': now.toISOString()
        }
      );

      console.log(`[MarketDataService] Saved ${data.length} points to MinIO: ${bucket}/${fileName}`);
      
      // Also save to L0 bucket for historical replay
      const l0Bucket = '00-raw-usdcop-marketdata';
      const l0FileName = `data/${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}/${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.json`;
      
      try {
        await this.minioClient.putObject(
          l0Bucket,
          l0FileName,
          Buffer.from(jsonData),
          jsonData.length,
          {
            'Content-Type': 'application/json',
            'X-Data-Source': 'realtime-aligned',
            'X-Update-Time': now.toISOString()
          }
        );
        console.log(`[MarketDataService] Also saved to L0 bucket: ${l0Bucket}/${l0FileName}`);
      } catch (l0Error) {
        console.error('[MarketDataService] Error saving to L0 bucket:', l0Error);
      }
      
      return true;
    } catch (error) {
      console.error('[MarketDataService] Error saving to MinIO:', error);
      return false;
    }
  }

  /**
   * Start automatic updates every 5 minutes
   */
  startRealtimeUpdates(callback?: (data: MarketDataPoint[]) => void) {
    // Clear existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Initial fetch
    this.fetchAndUpdate(callback);

    // Calculate time to next 5-minute mark
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const msToNext5Min = ((5 - (minutes % 5)) * 60 - seconds) * 1000;
    
    // First update at next 5-minute mark
    setTimeout(() => {
      this.fetchAndUpdate(callback);
      
      // Then set up interval for exact 5-minute updates
      this.updateInterval = setInterval(() => {
        this.fetchAndUpdate(callback);
      }, 5 * 60 * 1000); // Exactly every 5 minutes
    }, msToNext5Min);
    
    console.log(`[MarketDataService] Will start updates at next 5-min mark (in ${Math.round(msToNext5Min/1000)}s)`)

    console.log('[MarketDataService] Started realtime updates (every 5 minutes)');
  }

  /**
   * Fetch data and trigger callback
   */
  private async fetchAndUpdate(callback?: (data: MarketDataPoint[]) => void) {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const minutes = now.getMinutes();
    
    // Ensure we're at a 5-minute interval
    if (minutes % 5 !== 0) {
      console.log(`[MarketDataService] Not at 5-min interval (${minutes}), adjusting...`);
      // Adjust to nearest 5-minute mark
      now.setMinutes(Math.floor(minutes / 5) * 5, 0, 0);
    }
    
    // Only update during trading hours (Monday-Friday, 8:00 AM - 12:55 PM)
    if (day >= 1 && day <= 5 && hour >= 8 && (hour < 12 || (hour === 12 && minutes <= 55))) {
      console.log(`[MarketDataService] Fetching update at ${now.toLocaleTimeString()} (5-min aligned)`);
      
      const data = await this.fetchRealtimeData(20); // Get last 20 candles
      
      if (data.length > 0) {
        // Filter to only include 5-minute aligned timestamps
        const alignedData = data.filter(point => {
          const pointDate = new Date(point.datetime);
          return pointDate.getMinutes() % 5 === 0 && pointDate.getSeconds() === 0;
        });
        
        console.log(`[MarketDataService] Filtered ${data.length} points to ${alignedData.length} aligned points`);
        
        // Save to MinIO
        if (alignedData.length > 0) {
          await this.saveToMinIO(alignedData);
          
          // Trigger callback if provided
          if (callback) {
            callback(alignedData);
          }
        }
      }
    } else {
      console.log(`[MarketDataService] Market closed, skipping update at ${now.toLocaleTimeString()}`);
    }
  }

  /**
   * Stop automatic updates
   */
  stopRealtimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('[MarketDataService] Stopped realtime updates');
    }
  }

  /**
   * Get cached data
   */
  getCachedData(): MarketDataPoint[] {
    return Array.from(this.dataCache.values())
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  }

  /**
   * Merge historical and realtime data
   */
  async mergeWithHistorical(historicalData: any[]): Promise<any[]> {
    const realtimeData = this.getCachedData();
    
    // Create a map for deduplication
    const mergedMap = new Map<string, any>();
    
    // Add historical data first
    historicalData.forEach(point => {
      mergedMap.set(point.datetime, point);
    });
    
    // Override with realtime data (more recent)
    realtimeData.forEach(point => {
      mergedMap.set(point.datetime, {
        ...point,
        source: 'realtime'
      });
    });
    
    // Convert back to array and sort
    const merged = Array.from(mergedMap.values())
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    
    console.log(`[MarketDataService] Merged ${historicalData.length} historical + ${realtimeData.length} realtime = ${merged.length} total points`);
    
    return merged;
  }

  /**
   * Load historical data from MinIO
   */
  async loadHistoricalFromMinIO(): Promise<MarketDataPoint[]> {
    const allData: MarketDataPoint[] = [];
    
    try {
      // First try L1 standardized data
      const stream = this.minioClient.listObjectsV2(this.L1_BUCKET, '', true);
      
      for await (const obj of stream) {
        if (obj.name && obj.name.includes('standardized_data_all.csv')) {
          // Process CSV file
          const dataStream = await this.minioClient.getObject(this.L1_BUCKET, obj.name);
          const chunks = [];
          for await (const chunk of dataStream) {
            chunks.push(chunk);
          }
          
          const content = Buffer.concat(chunks).toString();
          const lines = content.trim().split('\n');
          
          if (lines.length > 1) {
            const headers = lines[0].split(',').map(h => h.trim());
            const timeIdx = headers.findIndex(h => h === 'time' || h === 'time_cot');
            const openIdx = headers.findIndex(h => h === 'open');
            const highIdx = headers.findIndex(h => h === 'high');
            const lowIdx = headers.findIndex(h => h === 'low');
            const closeIdx = headers.findIndex(h => h === 'close');
            
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',');
              if (values.length >= headers.length) {
                const datetime = values[timeIdx]?.trim();
                const point: MarketDataPoint = {
                  datetime,
                  open: parseFloat(values[openIdx]),
                  high: parseFloat(values[highIdx]),
                  low: parseFloat(values[lowIdx]),
                  close: parseFloat(values[closeIdx]),
                  volume: 0,
                  source: 'minio',
                  timestamp_utc: new Date(datetime).toISOString(),
                  hour_cot: new Date(datetime).getHours(),
                  minute_cot: new Date(datetime).getMinutes()
                };
                
                if (!isNaN(point.open) && !isNaN(point.close)) {
                  allData.push(point);
                }
              }
            }
          }
          
          // Only process first matching file
          break;
        }
      }
      
      console.log(`[MarketDataService] Loaded ${allData.length} historical points from MinIO`);
    } catch (error) {
      console.error('[MarketDataService] Error loading historical data:', error);
    }
    
    return allData;
  }

  /**
   * Get complete aligned dataset
   */
  async getAlignedDataset(): Promise<MarketDataPoint[]> {
    // Load historical data
    const historical = await this.loadHistoricalFromMinIO();
    
    // Calculate how much data we need to fetch
    const today = new Date();
    let pointsNeeded = 200; // Default: fetch last 200 points
    
    // Check if we have a gap in historical data
    if (historical.length > 0) {
      const lastHistoricalDate = new Date(historical[historical.length - 1].datetime);
      const daysSinceLastData = Math.floor((today.getTime() - lastHistoricalDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastData > 1) {
        console.log(`[MarketDataService] Gap detected: ${daysSinceLastData} days since last historical data`);
        console.log(`[MarketDataService] Last historical: ${lastHistoricalDate.toISOString()}`);
        console.log(`[MarketDataService] Today: ${today.toISOString()}`);
        
        // Calculate points needed to cover the gap
        // 59 candles per trading day (5-minute intervals from 8:00 AM to 12:55 PM)
        pointsNeeded = Math.min(daysSinceLastData * 59, 5000); // Cap at API limit
        console.log(`[MarketDataService] Fetching ${pointsNeeded} points to cover gap and get recent data`);
      }
    }
    
    // Fetch ALL the data we need in ONE call
    const realtimeData = await this.fetchRealtimeData(pointsNeeded);
    
    // Update cache with all fetched data
    realtimeData.forEach(point => {
      this.dataCache.set(point.datetime, point);
    });
    
    // Save today's data to MinIO for persistence
    if (realtimeData.length > 0) {
      console.log(`[MarketDataService] Saving ${realtimeData.length} realtime points to MinIO`);
      await this.saveToMinIO(realtimeData);
    }
    
    // Merge datasets
    const merged = await this.mergeWithHistorical(historical);
    
    // Filter for trading hours only
    const aligned = merged.filter(point => {
      const date = new Date(point.datetime);
      const day = date.getDay();
      const hour = date.getHours();
      const minutes = date.getMinutes();
      const totalMinutes = hour * 60 + minutes;
      
      return day >= 1 && day <= 5 && totalMinutes >= 480 && totalMinutes <= 775;
    });
    
    console.log(`[MarketDataService] Aligned dataset: ${aligned.length} points (trading hours only)`);
    console.log(`[MarketDataService] Date range: ${aligned[0]?.datetime} to ${aligned[aligned.length - 1]?.datetime}`);
    
    return aligned;
  }
}

export const marketDataService = MarketDataService.getInstance();