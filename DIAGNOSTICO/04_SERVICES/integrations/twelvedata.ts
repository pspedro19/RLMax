import axios from 'axios';
import { apiMonitor } from './api-monitor';

const API_KEYS = [
  process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY_1,
  process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY_2,
  process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY_3,
  process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY_4,
  process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY_5,
  process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY_6,
  process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY_7,
  process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY_8,
].filter(Boolean);

let currentKeyIndex = 0;

function getNextApiKey(): { key: string; keyId: string } | null {
  // Get next available key from API monitor
  const availableKeyId = apiMonitor.getNextAvailableKey();
  
  if (availableKeyId) {
    const keyIndex = parseInt(availableKeyId.split('_')[1]) - 1;
    const key = API_KEYS[keyIndex];
    if (key) {
      return { key, keyId: availableKeyId };
    }
  }
  
  // Fallback to round-robin
  const key = API_KEYS[currentKeyIndex];
  const keyId = `key_${currentKeyIndex + 1}`;
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key ? { key, keyId } : null;
}

async function makeAPICall(endpoint: string, params: any, endpointName: string) {
  const apiKeyData = getNextApiKey();
  if (!apiKeyData) {
    throw new Error('No API keys available');
  }
  
  const { key, keyId } = apiKeyData;
  const startTime = Date.now();
  
  try {
    const response = await axios.get(endpoint, {
      params: {
        ...params,
        apikey: key,
      },
      timeout: 10000,
    });
    
    const endTime = Date.now();
    apiMonitor.recordAPICall(keyId, endpointName, true, endTime - startTime);
    
    return response;
  } catch (error) {
    const endTime = Date.now();
    apiMonitor.recordAPICall(keyId, endpointName, false, endTime - startTime);
    throw error;
  }
}

export interface PriceData {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface QuoteData {
  symbol: string;
  name?: string;
  exchange?: string;
  currency?: string;
  datetime: string;
  timestamp?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  previous_close?: number;
  change?: number;
  percent_change?: number;
  average_volume?: number;
  is_market_open?: boolean;
  fifty_two_week?: {
    low: number;
    high: number;
    low_change: number;
    high_change: number;
    low_change_percent: number;
    high_change_percent: number;
    range: string;
  };
}

export async function fetchRealTimeQuote(symbol: string = 'USD/COP'): Promise<QuoteData> {
  const response = await makeAPICall('https://api.twelvedata.com/quote', { symbol }, 'quote');
  return response.data;
}

export async function fetchTimeSeries(
  symbol: string = 'USD/COP',
  interval: string = '5min',
  outputsize: number = 100
): Promise<PriceData[]> {
  const response = await makeAPICall('https://api.twelvedata.com/time_series', {
    symbol,
    interval,
    outputsize,
  }, 'time_series');
  return response.data.values || [];
}

export async function fetchTechnicalIndicators(symbol: string = 'USD/COP') {
  const [rsi, macd, sma, ema, bbands, stoch] = await Promise.all([
    makeAPICall('https://api.twelvedata.com/rsi', {
      symbol, interval: '5min', time_period: 14
    }, 'rsi'),
    makeAPICall('https://api.twelvedata.com/macd', {
      symbol, interval: '5min'
    }, 'macd'),
    makeAPICall('https://api.twelvedata.com/sma', {
      symbol, interval: '5min', time_period: 20
    }, 'sma'),
    makeAPICall('https://api.twelvedata.com/ema', {
      symbol, interval: '5min', time_period: 20
    }, 'ema'),
    makeAPICall('https://api.twelvedata.com/bbands', {
      symbol, interval: '5min', time_period: 20
    }, 'bbands'),
    makeAPICall('https://api.twelvedata.com/stoch', {
      symbol, interval: '5min'
    }, 'stoch'),
  ]);

  return {
    rsi: rsi.data.values?.[0],
    macd: macd.data.values?.[0],
    sma: sma.data.values?.[0],
    ema: ema.data.values?.[0],
    bbands: bbands.data.values?.[0],
    stoch: stoch.data.values?.[0],
  };
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private subscribers: Map<string, (data: any) => void> = new Map();

  connect() {
    // Skip WebSocket connection for now (requires valid API key and subscription)
    console.log('WebSocket connection disabled in development');
    return;
    
    const wsUrl = process.env.NEXT_PUBLIC_WS_ENDPOINT || 'wss://ws.twelvedata.com/v1/quotes/price';
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.subscribe('USD/COP');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'price') {
        this.notifySubscribers(data);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.reconnect();
    };
  }

  private reconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 5000);
  }

  private subscribe(symbol: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    const apiKeyData = getNextApiKey();
    if (!apiKeyData) return;
    
    this.ws.send(JSON.stringify({
      action: 'subscribe',
      params: {
        symbols: symbol,
        apikey: apiKeyData.key,
      },
    }));
  }

  onPriceUpdate(callback: (data: any) => void) {
    const id = Math.random().toString(36);
    this.subscribers.set(id, callback);
    return () => this.subscribers.delete(id);
  }

  private notifySubscribers(data: any) {
    this.subscribers.forEach(callback => callback(data));
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WebSocketClient();