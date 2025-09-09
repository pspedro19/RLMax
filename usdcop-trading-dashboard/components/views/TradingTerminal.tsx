'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Maximize2, 
  Settings,
  Activity,
  BarChart3,
  Info,
  X
} from 'lucide-react';
import { useMarketStore } from '@/lib/store/market-store';

// Dynamically import heavy chart component
const TradingChart = dynamic(() => import('@/components/charts/InteractiveChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />
});

// Skeleton loader for chart
function ChartSkeleton() {
  return (
    <div className="skeleton-chart" style={{
      width: '100%',
      height: '100%',
      background: '#1a1d29',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    }}>
      <div className="skeleton-price pulse" style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        width: '200px',
        height: '60px',
        background: 'linear-gradient(90deg, #2a2d3a 0%, #363945 50%, #2a2d3a 100%)',
        borderRadius: '12px',
        animation: 'pulse 1.5s ease-in-out infinite'
      }} />
      <div className="skeleton-graph pulse" style={{
        width: '90%',
        height: '80%',
        background: 'linear-gradient(90deg, #2a2d3a 0%, #363945 50%, #2a2d3a 100%)',
        borderRadius: '12px',
        animation: 'pulse 1.5s ease-in-out infinite'
      }} />
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

interface TradingTerminalProps {
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
}

export default function TradingTerminal({ 
  isFullscreen = false,
  onFullscreenToggle 
}: TradingTerminalProps) {
  const [showQuickTrade, setShowQuickTrade] = useState(true);
  const [showPriceTicker, setShowPriceTicker] = useState(true);
  const [showIndicators, setShowIndicators] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const {
    currentPrice,
    previousClose,
    priceChange,
    dayHigh,
    dayLow,
    volume,
    marketStatus,
    connectionStatus,
    dataSource,
    loadInitialData,
    checkMarketStatus
  } = useMarketStore();

  // Calculate percentage change
  const priceChangePercent = previousClose > 0 
    ? ((currentPrice - previousClose) / previousClose) * 100 
    : 0;
  const isPositive = priceChangePercent >= 0;

  // Load data on mount
  useEffect(() => {
    loadInitialData();
    checkMarketStatus();
    
    const interval = setInterval(() => {
      checkMarketStatus();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [loadInitialData, checkMarketStatus]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        onFullscreenToggle?.();
      }
      if (e.key === 'b' && e.altKey) {
        handleQuickBuy();
      }
      if (e.key === 's' && e.altKey) {
        handleQuickSell();
      }
      if (e.key === 'Escape' && isFullscreen) {
        onFullscreenToggle?.();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFullscreen, onFullscreenToggle]);

  const handleQuickBuy = useCallback(() => {
    console.log('Quick Buy at', currentPrice);
    // Implement buy logic
  }, [currentPrice]);

  const handleQuickSell = useCallback(() => {
    console.log('Quick Sell at', currentPrice);
    // Implement sell logic
  }, [currentPrice]);

  return (
    <div 
      ref={chartRef}
      className="trading-terminal"
      style={{
        width: '100%',
        height: '100%',
        background: '#1a1d29',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Main Trading Chart */}
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative'
      }}>
        <TradingChart />
      </div>

      {/* Floating Price Ticker */}
      <AnimatePresence>
        {showPriceTicker && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="price-ticker"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(13, 15, 20, 0.95)',
              backdropFilter: 'blur(20px)',
              padding: '16px 24px',
              borderRadius: '16px',
              border: '1px solid rgba(42, 45, 58, 0.5)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              minWidth: '220px',
              zIndex: 10
            }}
          >
            <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#8b92a9' }}>USD/COP</span>
              <div style={{
                padding: '2px 8px',
                borderRadius: '4px',
                background: marketStatus === 'open' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: marketStatus === 'open' ? '#22c55e' : '#ef4444',
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase'
              }}>
                {marketStatus}
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
              <span style={{
                fontSize: '32px',
                fontWeight: 700,
                color: '#fff',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {isPositive ? <TrendingUp size={16} color="#22c55e" /> : <TrendingDown size={16} color="#ef4444" />}
                <span style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: isPositive ? '#22c55e' : '#ef4444'
                }}>
                  {isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%
                </span>
              </div>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '12px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(42, 45, 58, 0.5)'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#5a6378', marginBottom: '2px' }}>HIGH</div>
                <div style={{ fontSize: '14px', color: '#22c55e', fontWeight: 500 }}>
                  {dayHigh.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#5a6378', marginBottom: '2px' }}>LOW</div>
                <div style={{ fontSize: '14px', color: '#ef4444', fontWeight: 500 }}>
                  {dayLow.toLocaleString()}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Trade Buttons */}
      <AnimatePresence>
        {showQuickTrade && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="quick-trade"
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              display: 'flex',
              gap: '12px',
              zIndex: 10
            }}
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleQuickBuy}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(34, 197, 94, 0.3)',
                transition: 'all 0.2s ease'
              }}
            >
              <TrendingUp size={18} />
              BUY
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleQuickSell}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.3)',
                transition: 'all 0.2s ease'
              }}
            >
              <TrendingDown size={18} />
              SELL
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hotkey Hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          fontSize: '11px',
          color: '#5a6378',
          display: 'flex',
          gap: '16px',
          zIndex: 10
        }}
      >
        <span>
          <kbd style={{ 
            padding: '2px 6px', 
            background: 'rgba(255, 255, 255, 0.1)', 
            borderRadius: '4px',
            border: '1px solid rgba(42, 45, 58, 0.5)'
          }}>F</kbd> Fullscreen
        </span>
        <span>
          <kbd style={{ 
            padding: '2px 6px', 
            background: 'rgba(255, 255, 255, 0.1)', 
            borderRadius: '4px',
            border: '1px solid rgba(42, 45, 58, 0.5)'
          }}>Alt+B</kbd> Buy
        </span>
        <span>
          <kbd style={{ 
            padding: '2px 6px', 
            background: 'rgba(255, 255, 255, 0.1)', 
            borderRadius: '4px',
            border: '1px solid rgba(42, 45, 58, 0.5)'
          }}>Alt+S</kbd> Sell
        </span>
      </motion.div>

      {/* Connection Status Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: 'rgba(13, 15, 20, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '8px',
          border: '1px solid rgba(42, 45, 58, 0.5)',
          zIndex: 10
        }}
      >
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: connectionStatus === 'connected' ? '#22c55e' : 
                     connectionStatus === 'connecting' ? '#f59e0b' : '#ef4444',
          animation: connectionStatus === 'connecting' ? 'pulse 1.5s ease-in-out infinite' : 'none'
        }} />
        <span style={{ fontSize: '12px', color: '#8b92a9', fontWeight: 500 }}>
          {dataSource.toUpperCase()} • {connectionStatus}
        </span>
      </motion.div>

      {/* Fullscreen Toggle */}
      {onFullscreenToggle && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onFullscreenToggle}
          style={{
            position: 'absolute',
            top: '80px',
            right: '20px',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(13, 15, 20, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(42, 45, 58, 0.5)',
            color: '#8b92a9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#8b92a9';
            e.currentTarget.style.background = 'rgba(13, 15, 20, 0.95)';
          }}
        >
          <Maximize2 size={20} />
        </motion.button>
      )}
    </div>
  );
}