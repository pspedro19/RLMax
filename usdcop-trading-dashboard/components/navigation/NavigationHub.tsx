'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  BarChart3,
  Shield,
  Database,
  Brain,
  History,
  ChevronLeft,
  ChevronRight,
  Layers,
  Activity,
  AlertTriangle,
  Zap,
  GitBranch,
  Server,
  BarChart,
  Menu,
  X
} from 'lucide-react';

type NavState = 'expanded' | 'collapsed' | 'hidden';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  section: string;
  hotkey?: string;
}

const navigationItems: NavItem[] = [
  // TRADING SECTION
  { id: 'trading-terminal', label: 'Trading Terminal', icon: TrendingUp, section: 'TRADING', hotkey: 'T' },
  { id: 'trading-signals', label: 'Trading Signals', icon: Zap, section: 'TRADING', hotkey: 'S' },
  { id: 'backtest-results', label: 'Backtest Results', icon: History, section: 'TRADING', hotkey: 'B' },
  { id: 'ml-analytics', label: 'ML Analytics', icon: Brain, section: 'TRADING', hotkey: 'M' },
  
  // RISK SECTION
  { id: 'risk-management', label: 'Risk Management', icon: Shield, section: 'RISK', hotkey: 'R' },
  { id: 'risk-monitor', label: 'Risk Monitor', icon: Activity, section: 'RISK' },
  { id: 'exposure-analysis', label: 'Exposure Analysis', icon: BarChart3, section: 'RISK' },
  { id: 'risk-alerts', label: 'Risk Alerts', icon: AlertTriangle, section: 'RISK' },
  
  // PIPELINE SECTION
  { id: 'l0-raw-data', label: 'L0 Raw Data', icon: Database, section: 'PIPELINE' },
  { id: 'l1-features', label: 'L1 Feature Stats', icon: Layers, section: 'PIPELINE' },
  { id: 'l3-correlations', label: 'L3 Correlations', icon: GitBranch, section: 'PIPELINE' },
  { id: 'l4-rl-data', label: 'L4 RL Data', icon: Server, section: 'PIPELINE' },
  { id: 'l5-model', label: 'L5 Model Serving', icon: Brain, section: 'PIPELINE' },
  { id: 'l6-backtests', label: 'L6 Backtests', icon: BarChart, section: 'PIPELINE' },
];

export default function NavigationHub({ 
  onViewChange,
  currentView = 'trading-terminal' 
}: {
  onViewChange: (viewId: string) => void;
  currentView?: string;
}) {
  const [navState, setNavState] = useState<NavState>('expanded');
  const [activeSection, setActiveSection] = useState('TRADING');
  const [isHovering, setIsHovering] = useState(false);

  // Load saved state
  useEffect(() => {
    const savedState = localStorage.getItem('nav-state') as NavState;
    if (savedState) {
      setNavState(savedState);
    }
  }, []);

  // Toggle navigation state
  const toggleNav = useCallback(() => {
    const states: NavState[] = ['expanded', 'collapsed', 'hidden'];
    const currentIndex = states.indexOf(navState);
    const nextState = states[(currentIndex + 1) % 3];
    setNavState(nextState);
    localStorage.setItem('nav-state', nextState);
  }, [navState]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '\\\\') {
          toggleNav();
        }
      }
      
      // Direct navigation hotkeys
      if (e.altKey) {
        const item = navigationItems.find(item => 
          item.hotkey?.toLowerCase() === e.key.toLowerCase()
        );
        if (item) {
          onViewChange(item.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [toggleNav, onViewChange]);

  // Group items by section
  const sections = navigationItems.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  const widthMap = {
    expanded: '280px',
    collapsed: '60px',
    hidden: '0px'
  };

  return (
    <AnimatePresence mode="wait">
      <motion.aside
        className="navigation-hub"
        initial={{ width: widthMap[navState] }}
        animate={{ width: widthMap[navState] }}
        exit={{ width: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          background: 'linear-gradient(180deg, #0d0f14 0%, #1a1d29 100%)',
          borderRight: navState !== 'hidden' ? '1px solid #2a2d3a' : 'none',
          zIndex: 100,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div className="nav-header" style={{
          padding: navState === 'expanded' ? '20px' : '12px',
          borderBottom: '1px solid #2a2d3a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: navState === 'expanded' ? 'space-between' : 'center',
          minHeight: '60px'
        }}>
          {navState === 'expanded' && (
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#fff',
                margin: 0,
                background: 'linear-gradient(135deg, #00d4ff 0%, #0099ff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Navigation Hub
            </motion.h2>
          )}
          
          <motion.button
            onClick={toggleNav}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid #2a2d3a',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#8b92a9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = '#8b92a9';
            }}
          >
            {navState === 'expanded' ? <ChevronLeft size={20} /> : 
             navState === 'collapsed' ? <ChevronRight size={20} /> : 
             <Menu size={20} />}
          </motion.button>
        </div>

        {/* Navigation Items */}
        <div className="nav-content" style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: navState === 'expanded' ? '12px' : '8px'
        }}>
          {Object.entries(sections).map(([sectionName, items]) => (
            <div key={sectionName} style={{ marginBottom: '24px' }}>
              {navState === 'expanded' && (
                <motion.h3
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: '#5a6378',
                    letterSpacing: '1.2px',
                    marginBottom: '12px',
                    paddingLeft: '12px'
                  }}
                >
                  {sectionName}
                </motion.h3>
              )}
              
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      width: '100%',
                      padding: navState === 'expanded' ? '12px 16px' : '12px',
                      marginBottom: '4px',
                      borderRadius: '10px',
                      border: 'none',
                      background: isActive ? 
                        'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(0, 153, 255, 0.15) 100%)' : 
                        'transparent',
                      color: isActive ? '#00d4ff' : '#8b92a9',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      justifyContent: navState === 'collapsed' ? 'center' : 'flex-start',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.color = '#fff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#8b92a9';
                      }
                    }}
                  >
                    <Icon size={20} style={{ flexShrink: 0 }} />
                    
                    {navState === 'expanded' && (
                      <>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: isActive ? 500 : 400,
                          flex: 1,
                          textAlign: 'left'
                        }}>
                          {item.label}
                        </span>
                        
                        {item.hotkey && (
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: '#5a6378'
                          }}>
                            Alt+{item.hotkey}
                          </span>
                        )}
                      </>
                    )}
                    
                    {/* Tooltip for collapsed state */}
                    {navState === 'collapsed' && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: isHovering ? 1 : 0, x: isHovering ? 0 : -10 }}
                        style={{
                          position: 'absolute',
                          left: '100%',
                          marginLeft: '8px',
                          padding: '8px 12px',
                          background: '#1a1d29',
                          border: '1px solid #2a2d3a',
                          borderRadius: '8px',
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none',
                          zIndex: 1000
                        }}
                      >
                        {item.label}
                      </motion.div>
                    )}
                    
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="active-indicator"
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: '3px',
                          height: '60%',
                          background: 'linear-gradient(180deg, #00d4ff 0%, #0099ff 100%)',
                          borderRadius: '0 3px 3px 0'
                        }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer with keyboard hint */}
        {navState === 'expanded' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              padding: '16px',
              borderTop: '1px solid #2a2d3a',
              fontSize: '11px',
              color: '#5a6378',
              textAlign: 'center'
            }}
          >
            <kbd style={{
              padding: '2px 6px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              border: '1px solid #2a2d3a'
            }}>
              Ctrl+\\
            </kbd> to toggle
          </motion.div>
        )}
      </motion.aside>
    </AnimatePresence>
  );
}