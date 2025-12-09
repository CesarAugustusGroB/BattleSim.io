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
    <div className="w-full h-full flex flex-col gap-4">
      <div className="bg-neutral-800 rounded-lg p-4 shadow-lg border border-neutral-700">
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Live Unit Count</h3>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={80} tick={{fill: '#9ca3af', fontSize: 10}} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#262626', border: 'none', borderRadius: '4px' }}
                itemStyle={{ color: '#fff' }}
                cursor={{fill: 'transparent'}}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-neutral-800 rounded-lg p-4 shadow-lg border border-neutral-700">
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Casualties</h3>
        <div className="flex justify-between items-end h-16 px-2">
            <div className="text-center">
                <span className="text-2xl font-bold text-red-500">{stats.redCasualties}</span>
                <div className="text-xs text-gray-500">Red Lost</div>
            </div>
            <div className="text-center">
                <span className="text-2xl font-bold text-blue-500">{stats.blueCasualties}</span>
                <div className="text-xs text-gray-500">Blue Lost</div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;