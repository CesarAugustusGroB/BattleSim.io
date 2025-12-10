
import React from 'react';
import { UnitType, TEAM_RED, TEAM_BLUE } from '../constants';

interface ControlPanelProps {
  onSpawn: (team: string, type: UnitType, count: number) => void;
  onReset: () => void;
  onPauseToggle: () => void;
  isPaused: boolean;
  allyOverlapTolerance: number;
  onOverlapToleranceChange: (val: number) => void;
  onToggleAdvisor: () => void;
  isAdvisorOpen: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  onSpawn,
  onReset,
  onPauseToggle,
  isPaused,
  allyOverlapTolerance,
  onOverlapToleranceChange,
  onToggleAdvisor,
  isAdvisorOpen
}) => {
  return (
    <div className="h-full w-full flex flex-col gap-6 overflow-y-auto p-4 scrollbar-thin">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white tracking-tight">Deployment</h2>
        <p className="text-neutral-500 text-xs">Command your forces</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <h3 className="text-neutral-300 text-xs font-bold uppercase tracking-wider">Red Legion</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onSpawn(TEAM_RED, UnitType.SOLDIER, 5)}
            className="px-2 py-2 bg-gradient-to-br from-red-900/40 to-transparent hover:from-red-900/60 border border-red-900/30 rounded text-red-100 text-xs transition-all hover:scale-[1.02] active:scale-95"
          >
            +5 Soldiers
          </button>
          <button
            onClick={() => onSpawn(TEAM_RED, UnitType.TANK, 1)}
            className="px-2 py-2 bg-gradient-to-br from-red-900/40 to-transparent hover:from-red-900/60 border border-red-900/30 rounded text-red-100 text-xs transition-all hover:scale-[1.02] active:scale-95"
          >
            +1 Tank
          </button>
          <button
            onClick={() => onSpawn(TEAM_RED, UnitType.ARCHER, 5)}
            className="px-2 py-2 bg-gradient-to-br from-red-900/40 to-transparent hover:from-red-900/60 border border-red-900/30 rounded text-red-100 text-xs transition-all hover:scale-[1.02] active:scale-95"
          >
            +5 Archers
          </button>
          <button
            onClick={() => onSpawn(TEAM_RED, UnitType.SOLDIER, 50)}
            className="px-2 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold transition-all shadow-lg hover:shadow-red-900/50"
          >
            +50 HORDE
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <h3 className="text-neutral-300 text-xs font-bold uppercase tracking-wider">Blue Alliance</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onSpawn(TEAM_BLUE, UnitType.SOLDIER, 5)}
            className="px-2 py-2 bg-gradient-to-br from-blue-900/40 to-transparent hover:from-blue-900/60 border border-blue-900/30 rounded text-blue-100 text-xs transition-all hover:scale-[1.02] active:scale-95"
          >
            +5 Soldiers
          </button>
          <button
            onClick={() => onSpawn(TEAM_BLUE, UnitType.TANK, 1)}
            className="px-2 py-2 bg-gradient-to-br from-blue-900/40 to-transparent hover:from-blue-900/60 border border-blue-900/30 rounded text-blue-100 text-xs transition-all hover:scale-[1.02] active:scale-95"
          >
            +1 Tank
          </button>
          <button
            onClick={() => onSpawn(TEAM_BLUE, UnitType.ARCHER, 5)}
            className="px-2 py-2 bg-gradient-to-br from-blue-900/40 to-transparent hover:from-blue-900/60 border border-blue-900/30 rounded text-blue-100 text-xs transition-all hover:scale-[1.02] active:scale-95"
          >
            +5 Archers
          </button>
          <button
            onClick={() => onSpawn(TEAM_BLUE, UnitType.SOLDIER, 50)}
            className="px-2 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-all shadow-lg hover:shadow-blue-900/50"
          >
            +50 HORDE
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider">Global Settings</h3>

        {/* Ally Overlap Slider */}
        <div className="space-y-2 bg-black/40 p-3 rounded border border-neutral-800">
          <div className="flex justify-between text-xs text-neutral-300 font-medium">
            <span>Collision Layer</span>
            <span className="text-blue-400 font-mono">{(allyOverlapTolerance * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="0.9"
            step="0.05"
            value={allyOverlapTolerance}
            onChange={(e) => onOverlapToleranceChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[9px] text-neutral-500 uppercase">
            <span>Solid</span>
            <span>Fluid</span>
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-2">
        <button
          onClick={onToggleAdvisor}
          className={`w-full py-2.5 rounded font-medium text-xs transition-all border ${isAdvisorOpen
            ? 'bg-purple-900/30 border-purple-500/50 text-purple-200'
            : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300'
            }`}
        >
          {isAdvisorOpen ? 'Close Advisor' : '✨ AI Strat Advisor'}
        </button>

        <button
          onClick={onPauseToggle}
          className={`w-full py-3 rounded font-bold text-sm transition-all shadow-lg ${isPaused
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-yellow-600 hover:bg-yellow-500 text-white'
            }`}
        >
          {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
        </button>

        <button
          onClick={onReset}
          className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white border border-neutral-700 rounded text-xs transition-colors"
        >
          Reset Board
        </button>
      </div>

      <div className="pt-2 border-t border-neutral-800 text-[10px] text-neutral-600 text-center">
        L-Click: Red | R-Click: Blue
      </div>
    </div>
  );
};

export default ControlPanel;
