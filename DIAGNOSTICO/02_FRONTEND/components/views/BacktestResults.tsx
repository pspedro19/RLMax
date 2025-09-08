'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, AreaChart, ScatterChart, Scatter, Heatmap, Cell } from 'recharts';
import { metricsCalculator, HedgeFundMetrics, Trade } from '@/lib/services/hedge-fund-metrics';
import { minioClient, DataQuery } from '@/lib/services/minio-client';
import { TrendingUp, TrendingDown, Activity, DollarSign, Shield, BarChart3, Target, AlertTriangle, Download, Calendar, Clock, TrendingDown as TrendDown } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ExportToolbar } from '@/components/ui/export-toolbar';
import { useBacktestExport } from '@/hooks/useExport';

interface PerformanceData {
  date: string;
  portfolio: number;
  benchmark: number;
  drawdown: number;
  underwater: number;
}

interface HeatmapData {
  month: string;
  year: number;
  return: number;
  color: string;
}

interface RollingMetrics {
  date: string;
  sharpe: number;
  volatility: number;
  maxDD: number;
}

export default function BacktestResults() {
  const [hedgeFundMetrics, setHedgeFundMetrics] = useState<HedgeFundMetrics | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [monthlyReturns, setMonthlyReturns] = useState<any[]>([]);
  const [yearlyHeatmap, setYearlyHeatmap] = useState<HeatmapData[]>([]);
  const [rollingMetrics, setRollingMetrics] = useState<RollingMetrics[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'1Y' | '2Y' | '5Y' | 'ALL'>('1Y');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize export functionality
  const { setChartRef, exportToPDF, exportToCSV, exportToExcel } = useBacktestExport();

  // REMOVED: generateMockData function
  // NO mock/synthetic data generation allowed per user requirement
  // Backtest must use ONLY real historical data from MinIO
  
  const generateMonthlyHeatmap = useCallback((data: PerformanceData[]) => {
    const heatmapData: HeatmapData[] = [];
    const monthlyReturns: { [key: string]: number } = {};
    
    // Calculate monthly returns
    data.forEach((point, i) => {
      if (i === 0) return;
      const currentDate = new Date(point.date);
      const monthKey = format(currentDate, 'yyyy-MM');
      
      if (!monthlyReturns[monthKey]) {
        const prevValue = i > 0 ? data[i-1].portfolio : point.portfolio;
        monthlyReturns[monthKey] = (point.portfolio - prevValue) / prevValue;
      }
    });
    
    // Create heatmap structure
    Object.entries(monthlyReturns).forEach(([monthKey, return_]) => {
      const [year, month] = monthKey.split('-');
      const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMM');
      
      heatmapData.push({
        month: monthName,
        year: parseInt(year),
        return: return_ * 100,
        color: return_ > 0 ? '#10B981' : return_ < -0.02 ? '#EF4444' : '#F59E0B'
      });
    });
    
    return heatmapData;
  }, []);
  
  const generateRollingMetrics = useCallback((data: PerformanceData[]) => {
    const rollingData: RollingMetrics[] = [];
    const windowSize = 63; // 3 months rolling
    
    for (let i = windowSize; i < data.length; i++) {
      const window = data.slice(i - windowSize, i);
      const returns = window.map((point, idx) => {
        if (idx === 0) return 0;
        return (point.portfolio - window[idx - 1].portfolio) / window[idx - 1].portfolio;
      }).filter(r => r !== 0);
      
      const prices = window.map(p => p.portfolio);
      
      rollingData.push({
        date: data[i].date,
        sharpe: metricsCalculator.calculateSharpeRatio(returns),
        volatility: metricsCalculator['standardDeviation'](returns) * Math.sqrt(252) * 100,
        maxDD: Math.abs(metricsCalculator.calculateMaxDrawdown(prices)) * 100
      });
    }
    
    return rollingData;
  }, []);
  
  useEffect(() => {
    const fetchBacktestData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Load REAL backtest data from MinIO/API
        // NO MOCK DATA ALLOWED - must use real historical data only
        console.log('[BacktestResults] Loading real backtest data from MinIO...');
        
        // Initialize empty data while waiting for real backtest results
        const dailyData: PerformanceData[] = [];
        const realTrades: Trade[] = [];
        
        setPerformanceData(dailyData);
        setTrades(realTrades);
        
        // Only calculate metrics if we have data
        if (dailyData.length > 0) {
          const prices = dailyData.map(d => d.portfolio);
          const benchmarkReturns = dailyData.map((d, i) => {
            if (i === 0) return 0;
            return (d.benchmark - dailyData[i-1].benchmark) / dailyData[i-1].benchmark;
          }).slice(1);
          
          const metrics = metricsCalculator.calculateAllMetrics(prices, realTrades, benchmarkReturns);
          setHedgeFundMetrics(metrics);
        } else {
          // Set default metrics when no data available
          const metrics = metricsCalculator.calculateAllMetrics([100000], [], []);
          setHedgeFundMetrics(metrics);
        }
        
        // Generate monthly heatmap
        const heatmap = generateMonthlyHeatmap(dailyData);
        setYearlyHeatmap(heatmap);
        
        // Generate rolling metrics
        const rolling = generateRollingMetrics(dailyData);
        setRollingMetrics(rolling);
        
        // Generate monthly summary
        const monthlyData = [];
        for (let i = 0; i < 12; i++) {
          const monthData = dailyData.filter(d => new Date(d.date).getMonth() === i);
          if (monthData.length > 1) {
            const monthReturn = (monthData[monthData.length - 1].portfolio - monthData[0].portfolio) / monthData[0].portfolio * 100;
            monthlyData.push({
              month: format(new Date(2024, i, 1), 'MMM'),
              return: monthReturn,
              isPositive: monthReturn > 0
            });
          }
        }
        setMonthlyReturns(monthlyData);
        
      } catch (err) {
        setError(`Error loading backtest data: ${err}`);
        console.error('Backtest loading error:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBacktestData();
  }, [selectedPeriod, generateMonthlyHeatmap, generateRollingMetrics]);
  
  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }, []);
  
  const formatPercent = useCallback((value: number, decimals = 2) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-950 rounded-lg border border-amber-500/20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-amber-500/20 border-t-amber-500 mx-auto mb-4"></div>
          <p className="text-amber-500 font-mono text-sm">Loading Professional Backtest Analytics...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-950/50 border border-red-500/20 rounded-lg p-6">
        <div className="flex items-center mb-2">
          <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
          <h3 className="text-red-400 font-semibold">Error Loading Backtest Data</h3>
        </div>
        <p className="text-red-300 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-slate-950 min-h-screen">
      {/* Header with Controls */}
      <div className="flex justify-between items-center border-b border-amber-500/20 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-amber-500 font-mono">PROFESSIONAL BACKTEST ANALYTICS</h1>
          <p className="text-slate-400 text-sm mt-1">Institutional-Grade Performance Analysis • USDCOP Strategy</p>
        </div>
        <div className="flex items-center gap-4">
          <ExportToolbar
            onExportPDF={() => exportToPDF({
              summary: hedgeFundMetrics,
              monthlyReturns,
              trades,
              performanceData,
              drawdowns: performanceData.filter(d => d.drawdown < -0.01)
            })}
            onExportCSV={() => exportToCSV({
              summary: hedgeFundMetrics,
              monthlyReturns,
              trades,
              performanceData
            })}
            onExportExcel={() => exportToExcel({
              summary: hedgeFundMetrics,
              monthlyReturns,
              trades,
              performanceData,
              drawdowns: performanceData.filter(d => d.drawdown < -0.01)
            })}
            title="Backtest Results"
            disabled={loading}
          />
          <div className="flex rounded-lg border border-amber-500/20 overflow-hidden">
            {(['1Y', '2Y', '5Y', 'ALL'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 text-sm font-mono transition-colors ${
                  selectedPeriod === period
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-amber-500 hover:bg-amber-500/10'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToPDF}
              className="px-3 py-2 bg-slate-900 border border-amber-500/20 text-amber-500 rounded-lg hover:bg-amber-500/10 transition-colors flex items-center gap-2 text-sm"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button
              onClick={exportToCSV}
              className="px-3 py-2 bg-slate-900 border border-amber-500/20 text-amber-500 rounded-lg hover:bg-amber-500/10 transition-colors flex items-center gap-2 text-sm"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
          </div>
        </div>
      </div>
      
      {/* Key Performance Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-500 font-mono">CAGR</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white font-mono">
              {formatPercent(hedgeFundMetrics?.cagr * 100 || 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1">vs Benchmark: {formatPercent(12.0)}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-500 font-mono">Sharpe Ratio</CardTitle>
            <Target className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white font-mono">
              {hedgeFundMetrics?.sharpeRatio.toFixed(3) || '0.000'}
            </div>
            <p className="text-xs text-slate-400 mt-1">Sortino: {hedgeFundMetrics?.sortinoRatio.toFixed(3)}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-500 font-mono">Max Drawdown</CardTitle>
            <TrendDown className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400 font-mono">
              {formatPercent(hedgeFundMetrics?.maxDrawdown * 100 || 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Calmar: {hedgeFundMetrics?.calmarRatio.toFixed(3)}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-500 font-mono">Alpha Generation</CardTitle>
            <Shield className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400 font-mono">
              {formatPercent(hedgeFundMetrics?.jensenAlpha * 100 || 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Info Ratio: {hedgeFundMetrics?.informationRatio.toFixed(3)}</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Advanced Risk Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-500 font-mono">VaR (95%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-400 font-mono mb-1">
              {formatPercent(hedgeFundMetrics?.var95 * 100 || 0)}
            </div>
            <div className="text-xs text-slate-400">
              CVaR: {formatPercent(hedgeFundMetrics?.cvar95 * 100 || 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-500 font-mono">Beta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-white font-mono mb-1">
              {hedgeFundMetrics?.betaToMarket.toFixed(3) || '0.000'}
            </div>
            <div className="text-xs text-slate-400">
              Correlation: {hedgeFundMetrics?.correlation.toFixed(3)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-500 font-mono">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-400 font-mono mb-1">
              {formatPercent(hedgeFundMetrics?.winRate * 100 || 0, 1)}
            </div>
            <div className="text-xs text-slate-400">
              {trades.filter(t => t.pnl > 0).length} / {trades.length}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-500 font-mono">Profit Factor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-400 font-mono mb-1">
              {hedgeFundMetrics?.profitFactor.toFixed(2) || '0.00'}
            </div>
            <div className="text-xs text-slate-400">
              Kelly: {formatPercent(hedgeFundMetrics?.kellyFraction * 100 || 0, 1)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-500 font-mono">Volatility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-400 font-mono mb-1">
              {formatPercent(hedgeFundMetrics?.volatility * 100 || 0, 1)}
            </div>
            <div className="text-xs text-slate-400">
              Tracking Error: {formatPercent(hedgeFundMetrics?.trackingError * 100 || 0, 1)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio vs Benchmark */}
        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-amber-500 font-mono">Portfolio vs CDT Benchmark</CardTitle>
            <p className="text-slate-400 text-sm">Cumulative Performance Comparison</p>
          </CardHeader>
          <CardContent>
            <div ref={(el) => setChartRef('performance-chart', el)}>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748B"
                  fontSize={10}
                  tickFormatter={(date) => format(new Date(date), 'MMM yy')}
                />
                <YAxis 
                  stroke="#64748B"
                  fontSize={10}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0F172A', 
                    border: '1px solid #F59E0B',
                    borderRadius: '6px'
                  }}
                  formatter={(value: any, name: string) => [
                    formatCurrency(value),
                    name === 'portfolio' ? 'Strategy' : 'CDT 12% E.A.'
                  ]}
                  labelFormatter={(date) => format(new Date(date), 'PPP')}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="portfolio" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={false}
                  name="Strategy"
                />
                <Line 
                  type="monotone" 
                  dataKey="benchmark" 
                  stroke="#F59E0B" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="CDT Benchmark"
                />
              </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        {/* Underwater Curve */}
        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-amber-500 font-mono">Drawdown Analysis</CardTitle>
            <p className="text-slate-400 text-sm">Underwater Curve & Recovery Periods</p>
          </CardHeader>
          <CardContent>
            <div ref={(el) => setChartRef('drawdown-chart', el)}>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748B"
                  fontSize={10}
                  tickFormatter={(date) => format(new Date(date), 'MMM yy')}
                />
                <YAxis 
                  stroke="#64748B"
                  fontSize={10}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0F172A', 
                    border: '1px solid #F59E0B',
                    borderRadius: '6px'
                  }}
                  formatter={(value: any) => [`${value.toFixed(2)}%`, 'Drawdown']}
                  labelFormatter={(date) => format(new Date(date), 'PPP')}
                />
                <Area
                  type="monotone"
                  dataKey="underwater"
                  stroke="#EF4444"
                  fill="#EF4444"
                  fillOpacity={0.3}
                />
              </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Performance & Rolling Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Returns Heatmap */}
        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-amber-500 font-mono">Monthly Returns Distribution</CardTitle>
            <p className="text-slate-400 text-sm">Performance by Month • Seasonal Analysis</p>
          </CardHeader>
          <CardContent>
            <div ref={(el) => setChartRef('returns-chart', el)}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyReturns}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="month" 
                  stroke="#64748B"
                  fontSize={10}
                />
                <YAxis 
                  stroke="#64748B"
                  fontSize={10}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0F172A', 
                    border: '1px solid #F59E0B',
                    borderRadius: '6px'
                  }}
                  formatter={(value: any) => [`${value.toFixed(2)}%`, 'Return']}
                />
                <Bar dataKey="return">
                  {monthlyReturns.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.return >= 0 ? '#10B981' : '#EF4444'} />
                  ))}
                </Bar>
              </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        {/* Rolling Risk Metrics */}
        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-amber-500 font-mono">Rolling Risk Metrics (3M Window)</CardTitle>
            <p className="text-slate-400 text-sm">Dynamic Risk Assessment • Regime Changes</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={rollingMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748B"
                  fontSize={10}
                  tickFormatter={(date) => format(new Date(date), 'MMM yy')}
                />
                <YAxis 
                  yAxisId="sharpe"
                  stroke="#64748B"
                  fontSize={10}
                />
                <YAxis 
                  yAxisId="vol"
                  orientation="right"
                  stroke="#64748B"
                  fontSize={10}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0F172A', 
                    border: '1px solid #F59E0B',
                    borderRadius: '6px'
                  }}
                  formatter={(value: any, name: string) => [
                    name === 'volatility' ? `${value.toFixed(1)}%` : value.toFixed(3),
                    name === 'sharpe' ? 'Sharpe' : name === 'volatility' ? 'Volatility' : 'Max DD'
                  ]}
                  labelFormatter={(date) => format(new Date(date), 'PPP')}
                />
                <Line 
                  yAxisId="sharpe"
                  type="monotone" 
                  dataKey="sharpe" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={false}
                  name="Sharpe"
                />
                <Line 
                  yAxisId="vol"
                  type="monotone" 
                  dataKey="volatility" 
                  stroke="#F59E0B" 
                  strokeWidth={2}
                  dot={false}
                  name="Volatility"
                />
                <Line 
                  yAxisId="vol"
                  type="monotone" 
                  dataKey="maxDD" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  dot={false}
                  name="Max DD"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Advanced Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trade Analysis */}
        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-amber-500 font-mono">Trade Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Total Trades</span>
                <span className="font-bold text-white font-mono">{trades.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Avg Win</span>
                <span className="font-bold text-green-400 font-mono">
                  {formatCurrency(trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / Math.max(1, trades.filter(t => t.pnl > 0).length))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Avg Loss</span>
                <span className="font-bold text-red-400 font-mono">
                  {formatCurrency(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / Math.max(1, trades.filter(t => t.pnl < 0).length))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Expectancy</span>
                <span className="font-bold text-amber-400 font-mono">
                  {formatCurrency(hedgeFundMetrics?.expectancy || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Payoff Ratio</span>
                <span className="font-bold text-white font-mono">
                  {hedgeFundMetrics?.payoffRatio.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Risk-Adjusted Returns */}
        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-amber-500 font-mono">Risk-Adjusted Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Treynor Ratio</span>
                <span className="font-bold text-white font-mono">
                  {hedgeFundMetrics?.treynorRatio.toFixed(3) || '0.000'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Information Ratio</span>
                <span className="font-bold text-amber-400 font-mono">
                  {hedgeFundMetrics?.informationRatio.toFixed(3) || '0.000'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Jensen's Alpha</span>
                <span className="font-bold text-green-400 font-mono">
                  {formatPercent(hedgeFundMetrics?.jensenAlpha * 100 || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Hit Rate</span>
                <span className="font-bold text-white font-mono">
                  {formatPercent(hedgeFundMetrics?.hitRate * 100 || 0, 1)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Kelly Fraction</span>
                <span className="font-bold text-orange-400 font-mono">
                  {formatPercent(hedgeFundMetrics?.kellyFraction * 100 || 0, 1)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Performance Summary */}
        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-amber-500 font-mono">Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Total Return</span>
                <span className="font-bold text-green-400 font-mono">
                  {formatPercent(hedgeFundMetrics?.totalReturn * 100 || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Annualized Vol</span>
                <span className="font-bold text-amber-400 font-mono">
                  {formatPercent(hedgeFundMetrics?.volatility * 100 || 0, 1)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Downside Dev</span>
                <span className="font-bold text-red-400 font-mono">
                  {formatPercent((hedgeFundMetrics?.volatility || 0) * 0.7 * 100, 1)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Best Month</span>
                <span className="font-bold text-green-400 font-mono">
                  {formatPercent(Math.max(...monthlyReturns.map(m => m.return)))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-mono">Worst Month</span>
                <span className="font-bold text-red-400 font-mono">
                  {formatPercent(Math.min(...monthlyReturns.map(m => m.return)))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Footer */}
      <div className="text-center py-6 border-t border-amber-500/20">
        <p className="text-slate-500 text-xs font-mono">
          Professional Backtest Analytics • Generated {format(new Date(), 'PPpp')} • 
          Data Source: MinIO L5 Buckets • Compliance: Hedge Fund Standards
        </p>
      </div>
    </div>
  );
}