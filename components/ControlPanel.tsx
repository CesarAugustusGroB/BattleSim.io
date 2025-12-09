
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
    <div className="bg-neutral-900 border-l border-neutral-800 p-6 flex flex-col h-full gap-6 w-80 overflow-y-auto">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">BattleSim.io</h2>
        <p className="text-neutral-500 text-sm">Deployment & Control</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-neutral-400 text-xs font-bold uppercase tracking-wider">Red Team Deployment</h3>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => onSpawn(TEAM_RED, UnitType.SOLDIER, 5)}
            className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-900/50 rounded text-red-200 text-sm transition-colors"
          >
            +5 Soldiers
          </button>
          <button 
            onClick={() => onSpawn(TEAM_RED, UnitType.TANK, 1)}
            className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-900/50 rounded text-red-200 text-sm transition-colors"
          >
            +1 Tank
          </button>
           <button 
            onClick={() => onSpawn(TEAM_RED, UnitType.ARCHER, 5)}
            className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-900/50 rounded text-red-200 text-sm transition-colors"
          >
            +5 Archers
          </button>
          <button 
            onClick={() => onSpawn(TEAM_RED, UnitType.SOLDIER, 50)}
            className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm font-semibold transition-colors"
          >
            +50 Horde
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-neutral-400 text-xs font-bold uppercase tracking-wider">Blue Team Deployment</h3>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => onSpawn(TEAM_BLUE, UnitType.SOLDIER, 5)}
            className="px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-900/50 rounded text-blue-200 text-sm transition-colors"
          >
            +5 Soldiers
          </button>
          <button 
            onClick={() => onSpawn(TEAM_BLUE, UnitType.TANK, 1)}
            className="px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-900/50 rounded text-blue-200 text-sm transition-colors"
          >
            +1 Tank
          </button>
           <button 
            onClick={() => onSpawn(TEAM_BLUE, UnitType.ARCHER, 5)}
            className="px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-900/50 rounded text-blue-200 text-sm transition-colors"
          >
            +5 Archers
          </button>
          <button 
            onClick={() => onSpawn(TEAM_BLUE, UnitType.SOLDIER, 50)}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-semibold transition-colors"
          >
            +50 Horde
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-neutral-400 text-xs font-bold uppercase tracking-wider">Simulation Settings</h3>
        
        {/* Ally Overlap Slider */}
        <div className="space-y-2 bg-neutral-800 p-3 rounded-lg border border-neutral-700">
            <div className="flex justify-between text-xs text-gray-300 font-medium">
                <span>Ally Overlap Tolerance</span>
                <span className="text-blue-400">{(allyOverlapTolerance * 100).toFixed(0)}%</span>
            </div>
            <input
                type="range"
                min="0"
                max="0.9"
                step="0.05"
                value={allyOverlapTolerance}
                onChange={(e) => onOverlapToleranceChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-gray-500">
                <span>Hard Collisions</span>
                <span>Swarm</span>
            </div>
        </div>
      </div>

      <div className="mt-auto space-y-3">
         <button 
          onClick={onToggleAdvisor}
          className={`w-full py-2 rounded-lg font-medium text-sm transition-all border ${
            isAdvisorOpen
              ? 'bg-blue-900/50 border-blue-500/50 text-blue-200' 
              : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-600 text-neutral-300'
          }`}
        >
          {isAdvisorOpen ? 'Close Battle Advisor' : '✨ Open Battle Advisor'}
        </button>

        <button 
          onClick={onPauseToggle}
          className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${
            isPaused 
              ? 'bg-green-600 hover:bg-green-500 text-white' 
              : 'bg-yellow-600 hover:bg-yellow-500 text-white'
          }`}
        >
          {isPaused ? '▶ Resume Simulation' : '⏸ Pause Simulation'}
        </button>

        <button 
          onClick={onReset}
          className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 rounded-lg text-sm transition-colors"
        >
          Reset Battlefield
        </button>
      </div>

      <div className="pt-4 border-t border-neutral-800">
        <p className="text-xs text-neutral-600">
            Click on the battlefield to spawn units directly.
            Left Click: Red | Right Click: Blue
        </p>
      </div>
    </div>
  );
};

export default ControlPanel;
