import React, { useEffect, useState, useRef, useCallback } from 'react';
import BattleCanvas from './components/BattleCanvas';
import ControlPanel from './components/ControlPanel';
import StatsPanel from './components/StatsPanel';
import { SimulationEngine } from './services/simulation';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  TEAM_RED, 
  TEAM_BLUE,
  UnitType
} from './constants';
import { GameStats, Unit, Particle } from './types';

// Instantiate simulation outside component to persist state across re-renders
const engine = new SimulationEngine();

// Initial 1v1 Setup
engine.spawnUnit(200, CANVAS_HEIGHT / 2, TEAM_RED, UnitType.SOLDIER);
engine.spawnUnit(CANVAS_WIDTH - 200, CANVAS_HEIGHT / 2, TEAM_BLUE, UnitType.SOLDIER);

function App() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [stats, setStats] = useState<GameStats>(engine.stats);
  const [isPaused, setIsPaused] = useState(false);
  const requestRef = useRef<number>();

  const animate = useCallback(() => {
    if (!isPaused) {
      engine.update(0.016); // Approx 60fps
      const state = engine.getState();
      setUnits(state.units);
      setParticles(state.particles);
      setStats(state.stats);
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [isPaused]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  const handleSpawn = (team: string, type: UnitType, count: number) => {
    for (let i = 0; i < count; i++) {
        // Randomize spawn slightly
        const xOffset = (Math.random() - 0.5) * 100;
        const yOffset = (Math.random() - 0.5) * 400;
        const baseX = team === TEAM_RED ? 100 : CANVAS_WIDTH - 100;
        
        engine.spawnUnit(
            baseX + xOffset, 
            (CANVAS_HEIGHT / 2) + yOffset, 
            team, 
            type
        );
    }
  };

  const handleReset = () => {
    engine.reset();
    // Restart 1v1
    engine.spawnUnit(200, CANVAS_HEIGHT / 2, TEAM_RED, UnitType.SOLDIER);
    engine.spawnUnit(CANVAS_WIDTH - 200, CANVAS_HEIGHT / 2, TEAM_BLUE, UnitType.SOLDIER);
    const state = engine.getState();
    setUnits(state.units);
    setParticles(state.particles);
    setStats(state.stats);
  };

  const handleCanvasClick = (x: number, y: number, isRightClick: boolean) => {
      // Spawn exact position
      engine.spawnUnit(x, y, isRightClick ? TEAM_BLUE : TEAM_RED, UnitType.SOLDIER);
  };

  return (
    <div className="flex h-screen w-full bg-neutral-950 overflow-hidden">
      {/* Left Sidebar - Controls */}
      <ControlPanel 
        onSpawn={handleSpawn} 
        onReset={handleReset} 
        onPauseToggle={() => setIsPaused(!isPaused)}
        isPaused={isPaused}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full p-4 gap-4">
        <header className="flex justify-between items-center mb-2 px-2">
            <div>
                 <h1 className="text-white text-xl font-bold">Simulation View</h1>
                 <p className="text-neutral-500 text-sm">Real-time pathfinding & collision physics</p>
            </div>
            <div className="flex gap-4 text-sm font-mono text-neutral-400">
                <div>FPS: 60</div>
                <div>Entities: {units.length}</div>
            </div>
        </header>

        <div className="flex-1 flex gap-4 min-h-0">
            {/* The Battlefield */}
            <div className="flex-1 aspect-video min-h-0 bg-neutral-900 rounded-xl flex items-center justify-center p-2">
                <BattleCanvas 
                    units={units} 
                    particles={particles}
                    onCanvasClick={handleCanvasClick}
                />
            </div>

            {/* Right Panel - Stats */}
            <div className="w-64 flex-shrink-0">
                <StatsPanel stats={stats} />
            </div>
        </div>
      </main>
    </div>
  );
}

export default App;