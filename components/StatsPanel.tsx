import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { GameStats } from '../types';
import { COLOR_BLUE, COLOR_RED } from '../constants';

interface StatsPanelProps {
  stats: GameStats;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => {
  const data = [
    { name: 'Red Army', count: stats.redCount, color: COLOR_RED },
    { name: 'Blue Army', count: stats.blueCount, color: COLOR_BLUE },
  ];

  const casualtyData = [
    { name: 'Red Losses', count: stats.redCasualties, color: '#7f1d1d' },
    { name: 'Blue Losses', count: stats.blueCasualties, color: '#1e3a8a' },
  ];

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="bg-black/30 rounded p-3 border border-neutral-800/50">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-neutral-400 text-[10px] font-bold uppercase tracking-wider">Active Forces</h3>
          <span className="text-[10px] text-neutral-600">Total: {stats.redCount + stats.blueCount}</span>
        </div>

        <div style={{ width: '100%', height: '128px', minHeight: '128px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" barSize={12}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                width={70}
                tick={{ fill: '#a3a3a3', fontSize: 10, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '4px', fontSize: '10px' }}
                itemStyle={{ color: '#fff' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="count" radius={[0, 2, 2, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-black/30 rounded p-3 border border-neutral-800/50">
        <h3 className="text-neutral-400 text-[10px] font-bold uppercase tracking-wider mb-2">Casualty Report</h3>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="text-center p-2 rounded bg-red-900/10 border border-red-900/20">
            <div className="text-xl font-bold text-red-500">{stats.redCasualties}</div>
            <div className="text-[10px] text-red-300/50 uppercase">Red Lost</div>
          </div>
          <div className="text-center p-2 rounded bg-blue-900/10 border border-blue-900/20">
            <div className="text-xl font-bold text-blue-500">{stats.blueCasualties}</div>
            <div className="text-[10px] text-blue-300/50 uppercase">Blue Lost</div>
          </div>
        </div>
      </div>

      <div className="bg-black/30 rounded p-3 border border-neutral-800/50">
        <h3 className="text-neutral-400 text-[10px] font-bold uppercase tracking-wider mb-1">Time Elapsed</h3>
        <div className="text-2xl font-mono text-neutral-200">{stats.totalTime.toFixed(1)}s</div>
      </div>
    </div>
  );
};

export default StatsPanel;