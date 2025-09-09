'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import NavigationHub from '@/components/navigation/NavigationHub';
import TradingTerminal from '@/components/views/TradingTerminal';
import { getSmartHideManager } from '@/lib/services/SmartHideManager';
import { getDataConnectionManager } from '@/lib/services/DataConnectionManager';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy load heavy components
const BacktestResults = dynamic(() => import('@/components/views/BacktestResults'), {
  ssr: false,
  loading: () => <LoadingView />
});

const MLAnalytics = dynamic(() => import('@/components/views/MLAnalytics'), {
  ssr: false,
  loading: () => <LoadingView />
});

function LoadingView() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1d29]">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Loading view...</p>
      </div>
    </div>
  );
}

export default function UnifiedTradingDashboard() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState('trading-terminal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [navState, setNavState] = useState<'expanded' | 'collapsed' | 'hidden'>('expanded');
  const [smartHideManager, setSmartHideManager] = useState<any>(null);
  const [dataManager, setDataManager] = useState<any>(null);

  // Check authentication
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated') || 
                          localStorage.getItem('isAuthenticated');
    
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [router]);

  // Initialize managers
  useEffect(() => {
    const hideManager = getSmartHideManager({
      edgeThreshold: 50,
      hideDelay: 3000,
      debounceTime: 200,
      autoHideInTradingMode: true
    });
    setSmartHideManager(hideManager);

    const dataConnectionManager = getDataConnectionManager();
    setDataManager(dataConnectionManager);
    
    // Start loading market data
    dataConnectionManager.loadMarketData();

    return () => {
      hideManager.destroy();
      dataConnectionManager.cancelConnection();
    };
  }, []);

  const handleViewChange = useCallback((viewId: string) => {
    setCurrentView(viewId);
    
    // Enter trading mode for terminal view
    if (viewId === 'trading-terminal' && smartHideManager) {
      smartHideManager.enterTradingMode();
    } else if (smartHideManager) {
      smartHideManager.exitTradingMode();
    }
  }, [smartHideManager]);

  const handleFullscreenToggle = useCallback(() => {
    setIsFullscreen(!isFullscreen);
    
    if (!isFullscreen && smartHideManager) {
      smartHideManager.toggleFullscreen();
    } else if (smartHideManager) {
      smartHideManager.exitAllModes();
    }
  }, [isFullscreen, smartHideManager]);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('isAuthenticated');
    localStorage.removeItem('isAuthenticated');
    router.push('/login');
  }, [router]);

  // Render current view
  const renderView = () => {
    switch (currentView) {
      case 'trading-terminal':
        return (
          <TradingTerminal 
            isFullscreen={isFullscreen}
            onFullscreenToggle={handleFullscreenToggle}
          />
        );
      
      case 'backtest-results':
        return <BacktestResults />;
      
      case 'ml-analytics':
        return <MLAnalytics />;
      
      // Pipeline views
      case 'l0-raw-data':
      case 'l1-features':
      case 'l3-correlations':
      case 'l4-rl-data':
      case 'l5-model':
      case 'l6-backtests':
        return (
          <div className="w-full h-full flex items-center justify-center bg-[#1a1d29]">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-4">
                {currentView.toUpperCase().replace(/-/g, ' ')}
              </h2>
              <p className="text-slate-400">Pipeline view coming soon...</p>
            </div>
          </div>
        );
      
      // Risk views
      case 'risk-management':
      case 'risk-monitor':
      case 'exposure-analysis':
      case 'risk-alerts':
        return (
          <div className="w-full h-full flex items-center justify-center bg-[#1a1d29]">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-4">
                {currentView.toUpperCase().replace(/-/g, ' ')}
              </h2>
              <p className="text-slate-400">Risk management view coming soon...</p>
            </div>
          </div>
        );
      
      default:
        return <TradingTerminal isFullscreen={isFullscreen} onFullscreenToggle={handleFullscreenToggle} />;
    }
  };

  return (
    <div className="app-container" style={{
      display: 'grid',
      gridTemplateAreas: `"nav-hub chart"`,
      gridTemplateColumns: navState === 'expanded' ? '280px 1fr' : 
                           navState === 'collapsed' ? '60px 1fr' : '0 1fr',
      height: '100vh',
      background: '#1a1d29',
      overflow: 'hidden',
      transition: 'grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      {/* Navigation Hub (Left Side Only) */}
      <NavigationHub 
        onViewChange={handleViewChange}
        currentView={currentView}
      />

      {/* Main Content Area */}
      <main style={{
        gridArea: 'chart',
        position: 'relative',
        overflow: 'hidden',
        background: '#1a1d29'
      }}>
        {/* Top Bar (Auto-hide) */}
        <motion.div 
          className="top-bar"
          initial={{ y: 0 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '52px',
            background: 'linear-gradient(180deg, rgba(13, 15, 20, 0.98) 0%, rgba(13, 15, 20, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(42, 45, 58, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            gap: '12px',
            zIndex: 50,
            transition: 'transform 0.3s ease'
          }}
        >
          {/* Left group */}
          <div className="button-group left" style={{ display: 'flex', gap: '8px' }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentView('trading-terminal')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(42, 45, 58, 0.5)',
                background: currentView === 'trading-terminal' ? 
                  'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(0, 153, 255, 0.15) 100%)' :
                  'rgba(255, 255, 255, 0.05)',
                color: currentView === 'trading-terminal' ? '#00d4ff' : '#8b92a9',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '44px',
                height: '36px',
                flexShrink: 0
              }}
            >
              Terminal
            </motion.button>
          </div>

          {/* Center group */}
          <div className="button-group center" style={{ 
            flex: 1, 
            display: 'flex', 
            justifyContent: 'center',
            gap: '8px'
          }}>
            <span style={{ 
              fontSize: '14px', 
              color: '#8b92a9',
              fontWeight: 500
            }}>
              USD/COP Trading Terminal
            </span>
          </div>

          {/* Right group */}
          <div className="button-group right" style={{ display: 'flex', gap: '8px' }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '44px',
                height: '36px',
                flexShrink: 0
              }}
            >
              Logout
            </motion.button>
          </div>
        </motion.div>

        {/* View Content */}
        <div style={{
          position: 'absolute',
          top: currentView === 'trading-terminal' && isFullscreen ? 0 : '52px',
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden'
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ width: '100%', height: '100%' }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Global Styles */}
      <style jsx global>{`
        .app-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        
        /* Prevent icon overlapping */
        .top-bar button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }
        
        /* Ensure no overflow */
        .button-group {
          display: flex;
          align-items: center;
          overflow: hidden;
        }
        
        /* Trading mode styles */
        .trading-mode .top-bar {
          transform: translateY(-100%);
        }
        
        .trading-mode .navigation-hub {
          transform: translateX(-100%);
        }
        
        /* Smooth transitions */
        * {
          box-sizing: border-box;
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(42, 45, 58, 0.2);
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(139, 146, 169, 0.3);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 146, 169, 0.5);
        }
      `}</style>
    </div>
  );
}