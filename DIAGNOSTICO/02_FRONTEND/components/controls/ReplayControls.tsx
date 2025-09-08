/**
 * Replay Controls Component
 * Controls for historical data replay and aligned dataset loading
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Play, Pause, RotateCcw, Download, Zap, Database, Cloud } from 'lucide-react';
import { useMarketStore } from '@/lib/store/market-store';
import { EnhancedDataService } from '@/lib/services/enhanced-data-service';

interface ReplayControlsProps {
  onAlignedDatasetClick?: () => void;
  onRealtimeToggle?: (enabled: boolean) => void;
}

export const ReplayControls: React.FC<ReplayControlsProps> = ({
  onAlignedDatasetClick,
  onRealtimeToggle
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [dataStats, setDataStats] = useState({
    total: 0,
    minio: 0,
    twelvedata: 0,
    realtime: 0
  });
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(false);
  
  const { 
    candles,
    setReplayState,
    connectionStatus,
    dataSource 
  } = useMarketStore();
  
  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    const newState = !isPlaying;
    setIsPlaying(newState);
    setReplayState(newState, replaySpeed);
  }, [isPlaying, replaySpeed, setReplayState]);
  
  // Handle speed change
  const handleSpeedChange = useCallback((speed: number) => {
    setReplaySpeed(speed);
    if (isPlaying) {
      setReplayState(true, speed);
    }
  }, [isPlaying, setReplayState]);
  
  // Handle reset
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setReplayState(false);
    // Reset to beginning of data
  }, [setReplayState]);
  
  // Handle aligned dataset loading
  const handleAlignedDataset = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('[ReplayControls] Loading aligned dataset...');
      
      // Initialize service
      const dataService = new EnhancedDataService();
      
      // Load complete history from MinIO
      const historicalData = await dataService.loadCompleteHistory();
      console.log(`[ReplayControls] Loaded ${historicalData.length} historical points`);
      
      // Get date range for gap filling
      const now = new Date();
      const lastHistoricalDate = historicalData.length > 0 
        ? new Date(historicalData[historicalData.length - 1].datetime)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      // Fill gaps with TwelveData
      const alignedData = await dataService.createAlignedDataset(
        lastHistoricalDate,
        now
      );
      
      console.log(`[ReplayControls] Created aligned dataset with ${alignedData.length} total points`);
      
      // Update stats
      setDataStats({
        total: alignedData.length,
        minio: alignedData.filter(d => d.source === 'minio').length,
        twelvedata: alignedData.filter(d => d.source === 'twelvedata').length,
        realtime: alignedData.filter(d => d.source === 'realtime').length
      });
      
      // Trigger callback
      if (onAlignedDatasetClick) {
        onAlignedDatasetClick();
      }
      
    } catch (error) {
      console.error('[ReplayControls] Error loading aligned dataset:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onAlignedDatasetClick]);
  
  // Handle realtime toggle
  const handleRealtimeToggle = useCallback(() => {
    const newState = !isRealtimeEnabled;
    setIsRealtimeEnabled(newState);
    if (onRealtimeToggle) {
      onRealtimeToggle(newState);
    }
  }, [isRealtimeEnabled, onRealtimeToggle]);
  
  // Update stats when candles change
  useEffect(() => {
    if (candles.length > 0) {
      setDataStats({
        total: candles.length,
        minio: candles.filter(d => d.source === 'minio').length,
        twelvedata: candles.filter(d => d.source === 'twelvedata').length,
        realtime: candles.filter(d => d.source === 'realtime').length
      });
    }
  }, [candles]);
  
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-terminal-accent font-mono text-sm uppercase tracking-wider">
          Replay Controls
        </h3>
        
        {/* Connection status */}
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-positive animate-pulse' : 
            connectionStatus === 'reconnecting' ? 'bg-warning animate-pulse' : 
            'bg-negative'
          }`} />
          <span className="text-terminal-text-dim text-xs font-mono">
            {connectionStatus}
          </span>
        </div>
      </div>
      
      {/* Control buttons */}
      <div className="flex items-center space-x-3 mb-4">
        {/* Play/Pause */}
        <button
          onClick={handlePlayPause}
          className="terminal-button p-2 rounded"
          disabled={isLoading}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        
        {/* Reset */}
        <button
          onClick={handleReset}
          className="terminal-button p-2 rounded"
          disabled={isLoading}
        >
          <RotateCcw size={16} />
        </button>
        
        {/* Speed selector */}
        <select
          value={replaySpeed}
          onChange={(e) => handleSpeedChange(Number(e.target.value))}
          className="bg-terminal-surface-variant border border-terminal-border text-terminal-text px-2 py-1 rounded text-sm font-mono"
          disabled={isLoading}
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={5}>5x</option>
          <option value={10}>10x</option>
        </select>
        
        {/* Aligned Dataset button */}
        <button
          onClick={handleAlignedDataset}
          className="terminal-button px-3 py-1 rounded flex items-center space-x-2"
          disabled={isLoading}
        >
          <Database size={16} />
          <span className="text-xs">
            {isLoading ? 'Loading...' : 'Aligned Dataset'}
          </span>
        </button>
        
        {/* Realtime toggle */}
        <button
          onClick={handleRealtimeToggle}
          className={`px-3 py-1 rounded flex items-center space-x-2 border ${
            isRealtimeEnabled 
              ? 'bg-terminal-accent text-terminal-bg border-terminal-accent' 
              : 'bg-terminal-surface-variant text-terminal-text-dim border-terminal-border'
          }`}
        >
          <Zap size={16} />
          <span className="text-xs">Real-time</span>
        </button>
      </div>
      
      {/* Data statistics */}
      <div className="grid grid-cols-4 gap-2 text-xs font-mono">
        <div className="bg-terminal-surface-variant p-2 rounded">
          <div className="text-terminal-text-muted">Total</div>
          <div className="text-terminal-text">{dataStats.total.toLocaleString()}</div>
        </div>
        
        <div className="bg-terminal-surface-variant p-2 rounded">
          <div className="text-terminal-text-muted flex items-center space-x-1">
            <Database size={10} />
            <span>MinIO</span>
          </div>
          <div className="text-terminal-accent">{dataStats.minio.toLocaleString()}</div>
        </div>
        
        <div className="bg-terminal-surface-variant p-2 rounded">
          <div className="text-terminal-text-muted flex items-center space-x-1">
            <Cloud size={10} />
            <span>TwelveData</span>
          </div>
          <div className="text-info-blue">{dataStats.twelvedata.toLocaleString()}</div>
        </div>
        
        <div className="bg-terminal-surface-variant p-2 rounded">
          <div className="text-terminal-text-muted flex items-center space-x-1">
            <Zap size={10} />
            <span>Real-time</span>
          </div>
          <div className="text-positive">{dataStats.realtime.toLocaleString()}</div>
        </div>
      </div>
      
      {/* Progress bar */}
      {isPlaying && (
        <div className="mt-4">
          <div className="h-1 bg-terminal-surface-variant rounded-full overflow-hidden">
            <div 
              className="h-full bg-terminal-accent transition-all duration-300"
              style={{ width: '45%' }}
            />
          </div>
          <div className="flex justify-between text-xs text-terminal-text-muted mt-1 font-mono">
            <span>Aug 22, 2024</span>
            <span>Current: Nov 15, 2024</span>
            <span>Today</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReplayControls;