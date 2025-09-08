'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import RealTimeChart from '@/components/views/RealTimeChart';
import TradingSignals from '@/components/views/TradingSignals';
import BacktestResults from '@/components/views/BacktestResults';
import PipelineMonitor from '@/components/views/PipelineMonitor';
import RiskManagement from '@/components/views/RiskManagement';
import ModelPerformance from '@/components/views/ModelPerformance';

// Enhanced Trading Dashboard with seamless replay
const EnhancedTradingDashboard = dynamic(
  () => import('@/components/views/EnhancedTradingDashboard'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <div className="text-terminal-accent font-mono animate-pulse">Loading Terminal...</div>
      </div>
    )
  }
);

// New comprehensive pipeline components
import L0RawDataDashboard from '@/components/views/L0RawDataDashboard';
import L1FeatureStats from '@/components/views/L1FeatureStats';
import L3CorrelationMatrix from '@/components/views/L3CorrelationMatrix';
import L4RLReadyData from '@/components/views/L4RLReadyData';
import L5ModelDashboard from '@/components/views/L5ModelDashboard';
import L6BacktestResults from '@/components/views/L6BacktestResults';
import PipelineHealthMonitor from '@/components/views/PipelineHealthMonitor';
import APIUsagePanel from '@/components/views/APIUsagePanel';

import { 
  LineChart, 
  Signal, 
  TrendingUp, 
  Database, 
  Shield, 
  Brain,
  Menu,
  X,
  Activity,
  BarChart3,
  GitBranch,
  Cpu,
  Target,
  PieChart,
  Zap,
  Key
} from 'lucide-react';

const views = [
  // Enhanced Terminal (Primary)
  { id: 'enhanced', name: 'Trading Terminal', icon: Activity, component: EnhancedTradingDashboard, category: 'Trading' },
  
  // Original views
  { id: 'realtime', name: 'Real-Time Chart', icon: LineChart, component: RealTimeChart, category: 'Trading' },
  { id: 'signals', name: 'Trading Signals', icon: Signal, component: TradingSignals, category: 'Trading' },
  { id: 'backtest', name: 'Backtest Results', icon: TrendingUp, component: BacktestResults, category: 'Trading' },
  { id: 'risk', name: 'Risk Management', icon: Shield, component: RiskManagement, category: 'Trading' },
  { id: 'model', name: 'Model Performance', icon: Brain, component: ModelPerformance, category: 'Trading' },
  
  // New comprehensive pipeline views
  { id: 'l0-raw', name: 'L0 Raw Data', icon: Activity, component: L0RawDataDashboard, category: 'Pipeline' },
  { id: 'l1-features', name: 'L1 Feature Stats', icon: BarChart3, component: L1FeatureStats, category: 'Pipeline' },
  { id: 'l3-correlation', name: 'L3 Correlations', icon: GitBranch, component: L3CorrelationMatrix, category: 'Pipeline' },
  { id: 'l4-rl-ready', name: 'L4 RL Data', icon: Cpu, component: L4RLReadyData, category: 'Pipeline' },
  { id: 'l5-serving', name: 'L5 Model Serving', icon: Target, component: L5ModelDashboard, category: 'Pipeline' },
  { id: 'l6-backtest', name: 'L6 Backtests', icon: PieChart, component: L6BacktestResults, category: 'Pipeline' },
  
  // System monitoring
  { id: 'pipeline-health', name: 'Pipeline Health', icon: Zap, component: PipelineHealthMonitor, category: 'System' },
  { id: 'api-usage', name: 'API Usage', icon: Key, component: APIUsagePanel, category: 'System' },
  { id: 'pipeline-monitor', name: 'Legacy Pipeline', icon: Database, component: PipelineMonitor, category: 'System' },
];

export default function Dashboard() {
  const [activeView, setActiveView] = useState('enhanced');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const ActiveComponent = views.find(v => v.id === activeView)?.component || RealTimeChart;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-hidden`}>
        <div className="p-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-8">
            USDCOP Trading
          </h1>
          <nav className="space-y-4">
            {/* Group views by category */}
            {['Trading', 'Pipeline', 'System'].map(category => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  {category}
                </h3>
                <div className="space-y-1">
                  {views.filter(view => view.category === category).map((view) => {
                    const Icon = view.icon;
                    return (
                      <button
                        key={view.id}
                        onClick={() => setActiveView(view.id)}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                          activeView === view.id
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{view.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {views.find(v => v.id === activeView)?.name}
              </h2>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Live</span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                USD/COP Trading System
              </span>
            </div>
          </div>
        </header>

        {/* Main View */}
        <main className="flex-1 overflow-auto p-6">
          <ActiveComponent />
        </main>
      </div>
    </div>
  );
}
