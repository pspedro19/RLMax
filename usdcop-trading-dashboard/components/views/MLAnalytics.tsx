'use client';

import React from 'react';
import { Brain, TrendingUp, Activity, BarChart3 } from 'lucide-react';

export default function MLAnalytics() {
  return (
    <div className="w-full h-full bg-[#1a1d29] p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">ML Analytics</h1>
          <p className="text-slate-400">Machine Learning model performance and predictions</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Metric Cards */}
          <div className="bg-[#0d0f14] rounded-xl p-6 border border-[#2a2d3a]">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="text-cyan-400" size={24} />
              <span className="text-sm text-slate-400">Model Accuracy</span>
            </div>
            <div className="text-2xl font-bold text-white">94.3%</div>
            <div className="text-sm text-green-400 mt-2">+2.1% from last week</div>
          </div>
          
          <div className="bg-[#0d0f14] rounded-xl p-6 border border-[#2a2d3a]">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="text-purple-400" size={24} />
              <span className="text-sm text-slate-400">Win Rate</span>
            </div>
            <div className="text-2xl font-bold text-white">67.8%</div>
            <div className="text-sm text-green-400 mt-2">+5.3% this month</div>
          </div>
          
          <div className="bg-[#0d0f14] rounded-xl p-6 border border-[#2a2d3a]">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="text-amber-400" size={24} />
              <span className="text-sm text-slate-400">Predictions Today</span>
            </div>
            <div className="text-2xl font-bold text-white">1,234</div>
            <div className="text-sm text-slate-400 mt-2">Real-time</div>
          </div>
          
          <div className="bg-[#0d0f14] rounded-xl p-6 border border-[#2a2d3a]">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="text-emerald-400" size={24} />
              <span className="text-sm text-slate-400">Sharpe Ratio</span>
            </div>
            <div className="text-2xl font-bold text-white">2.14</div>
            <div className="text-sm text-green-400 mt-2">Excellent</div>
          </div>
        </div>
        
        {/* Charts placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#0d0f14] rounded-xl p-6 border border-[#2a2d3a] h-80">
            <h3 className="text-lg font-semibold text-white mb-4">Model Performance</h3>
            <div className="w-full h-60 flex items-center justify-center text-slate-500">
              Chart placeholder
            </div>
          </div>
          
          <div className="bg-[#0d0f14] rounded-xl p-6 border border-[#2a2d3a] h-80">
            <h3 className="text-lg font-semibold text-white mb-4">Prediction Distribution</h3>
            <div className="w-full h-60 flex items-center justify-center text-slate-500">
              Chart placeholder
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}