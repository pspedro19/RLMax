'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, Cell
} from 'recharts';
import { fetchLatestPipelineOutput } from '@/lib/services/pipeline';

interface ModelPrediction {
  timestamp: string;
  predicted_action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  expected_return: number;
  risk_score: number;
  features_used: string[];
}

interface LatencyMetrics {
  avg_inference_time: number;
  p95_inference_time: number;
  p99_inference_time: number;
  total_predictions: number;
  predictions_per_second: number;
  model_load_time: number;
}

interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  win_rate: number;
  profit_factor: number;
}

interface L5ServingData {
  latest_predictions: ModelPrediction[];
  latency_metrics: LatencyMetrics;
  model_performance: ModelPerformance;
  model_info: {
    model_name: string;
    version: string;
    last_trained: string;
    training_samples: number;
    feature_count: number;
  };
  serving_status: {
    is_healthy: boolean;
    last_update: string;
    error_rate: number;
    uptime_minutes: number;
  };
}

export default function L5ModelDashboard() {
  const [servingData, setServingData] = useState<L5ServingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchL5Data = async () => {
    try {
      setError(null);
      const pipelineData = await fetchLatestPipelineOutput('L5');
      
      // Mock L5 serving data
      const mockServingData: L5ServingData = {
        latest_predictions: [
          { timestamp: '2025-09-01T10:30:00Z', predicted_action: 'BUY', confidence: 0.87, expected_return: 0.0045, risk_score: 0.23, features_used: ['RSI_14', 'MACD', 'Volume'] },
          { timestamp: '2025-09-01T10:25:00Z', predicted_action: 'HOLD', confidence: 0.92, expected_return: 0.0012, risk_score: 0.15, features_used: ['RSI_14', 'ATR', 'Hour'] },
          { timestamp: '2025-09-01T10:20:00Z', predicted_action: 'SELL', confidence: 0.78, expected_return: -0.0023, risk_score: 0.31, features_used: ['MACD', 'BB_Width', 'Spread'] },
        ],
        latency_metrics: {
          avg_inference_time: 23.4,
          p95_inference_time: 45.2,
          p99_inference_time: 67.8,
          total_predictions: 15847,
          predictions_per_second: 42.3,
          model_load_time: 2340,
        },
        model_performance: {
          accuracy: 0.734,
          precision: 0.712,
          recall: 0.689,
          f1_score: 0.698,
          sharpe_ratio: 1.87,
          sortino_ratio: 2.34,
          max_drawdown: 0.087,
          win_rate: 0.623,
          profit_factor: 1.45,
        },
        model_info: {
          model_name: 'USDCOP_RL_Agent_v2.1',
          version: '2.1.0',
          last_trained: '2025-08-29T14:30:00Z',
          training_samples: 485920,
          feature_count: 42,
        },
        serving_status: {
          is_healthy: true,
          last_update: '2025-09-01T10:30:15Z',
          error_rate: 0.023,
          uptime_minutes: 14523,
        },
      };
      
      setServingData(mockServingData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch L5 data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchL5Data();
    const interval = setInterval(fetchL5Data, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return <div className="animate-pulse h-96 bg-gray-200 rounded"></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">L5 Model Serving Dashboard</h2>
        <Badge className={servingData?.serving_status.is_healthy ? 'bg-green-500' : 'bg-red-500'}>
          {servingData?.serving_status.is_healthy ? 'Healthy' : 'Error'}
        </Badge>
      </div>

      {error && <Alert><div className="text-red-600">Error: {error}</div></Alert>}

      {servingData && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <p className="text-sm text-gray-600">Avg Latency</p>
              <p className="text-2xl font-bold">{servingData.latency_metrics.avg_inference_time.toFixed(1)}ms</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-sm text-gray-600">Accuracy</p>
              <p className="text-2xl font-bold">{(servingData.model_performance.accuracy * 100).toFixed(1)}%</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-sm text-gray-600">Sharpe Ratio</p>
              <p className="text-2xl font-bold">{servingData.model_performance.sharpe_ratio.toFixed(2)}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-sm text-gray-600">Predictions/sec</p>
              <p className="text-2xl font-bold">{servingData.latency_metrics.predictions_per_second.toFixed(1)}</p>
            </Card>
          </div>

          {/* Latest Predictions */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Predictions</h3>
            <div className="space-y-3">
              {servingData.latest_predictions.map((pred, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center space-x-3">
                    <Badge className={
                      pred.predicted_action === 'BUY' ? 'bg-green-500' :
                      pred.predicted_action === 'SELL' ? 'bg-red-500' : 'bg-gray-500'
                    }>
                      {pred.predicted_action}
                    </Badge>
                    <div>
                      <p className="font-medium">Confidence: {(pred.confidence * 100).toFixed(1)}%</p>
                      <p className="text-sm text-gray-600">{new Date(pred.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">Return: {(pred.expected_return * 100).toFixed(2)}%</p>
                    <p className="text-sm text-gray-600">Risk: {(pred.risk_score * 100).toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Model Performance</h3>
              <div className="space-y-4">
                {Object.entries(servingData.model_performance).map(([metric, value]) => (
                  <div key={metric} className="flex justify-between items-center">
                    <span className="capitalize">{metric.replace('_', ' ')}</span>
                    <span className="font-bold">
                      {metric.includes('ratio') || metric === 'profit_factor' 
                        ? value.toFixed(2) 
                        : `${(value * 100).toFixed(1)}%`}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Latency Distribution</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Average</span>
                    <span>{servingData.latency_metrics.avg_inference_time.toFixed(1)}ms</span>
                  </div>
                  <Progress value={Math.min(100, servingData.latency_metrics.avg_inference_time)} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>95th percentile</span>
                    <span>{servingData.latency_metrics.p95_inference_time.toFixed(1)}ms</span>
                  </div>
                  <Progress value={Math.min(100, servingData.latency_metrics.p95_inference_time)} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>99th percentile</span>
                    <span>{servingData.latency_metrics.p99_inference_time.toFixed(1)}ms</span>
                  </div>
                  <Progress value={Math.min(100, servingData.latency_metrics.p99_inference_time)} />
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}