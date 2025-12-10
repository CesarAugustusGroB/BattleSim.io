
import React, { useEffect, useState, useRef, useCallback } from 'react';
import BattleCanvas from './components/BattleCanvas';
import ControlPanel from './components/ControlPanel';
import StatsPanel from './components/StatsPanel';
import BattleAdvisor from './components/BattleAdvisor';
import { SimulationEngine, unitQuery } from './services/simulation';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  TEAM_RED, 
  TEAM_BLUE,
  UnitType
} from './constants';
import { GameStats } from './types';

function App() {
  // Lazy init the engine to catch constructor errors if libs fail
  const [engine] = useState(() => {
    try {
        const eng = new SimulationEngine();
        // Initial Setup
        if (eng.world) {
            eng.spawnUnit(200, CANVAS_HEIGHT / 2, TEAM_RED, UnitType.SOLDIER);
            eng.spawnUnit(CANVAS_WIDTH - 200, CANVAS_HEIGHT / 2, TEAM_BLUE, UnitType.SOLDIER);
        }
        return eng;
    } catch (e) {
        console.error("Engine failed to init", e);
        return new SimulationEngine(); // Fallback empty
    }
  });

  const [stats, setStats] = useState<GameStats>(engine.stats);
  const [isPaused, setIsPaused] = useState(false);
  const [overlapTolerance, setOverlapTolerance] = useState(0);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  
  const frameCountRef = useRef(0);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = time;
    const deltaTime = Math.min((time - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = time;

    if (!isPaused && engine.world) {
      engine.update(deltaTime);
      
      // Update UI Stats periodically
      frameCountRef.current++;
      if (frameCountRef.current % 10 === 0) {
          // Clone stats to trigger re-render
          setStats({ ...engine.stats });
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [isPaused, engine]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  const handleSpawn = (team: string, type: UnitType, count: number) => {
    for (let i = 0; i < count; i++) {
        const xOffset = (Math.random() - 0.5) * 150;
        const yOffset = (Math.random() - 0.5) * 500;
        const baseX = team === TEAM_RED ? 150 : CANVAS_WIDTH - 150;
        engine.spawnUnit(baseX + xOffset, (CANVAS_HEIGHT / 2) + yOffset, team, type);
    }
  };

  const handleReset = () => {
    engine.reset();
    engine.spawnUnit(200, CANVAS_HEIGHT / 2, TEAM_RED, UnitType.SOLDIER);
    engine.spawnUnit(CANVAS_WIDTH - 200, CANVAS_HEIGHT / 2, TEAM_BLUE, UnitType.SOLDIER);
    setStats({ ...engine.stats });
    lastTimeRef.current = 0;
  };
  
  const handleOverlapToleranceChange = (val: number) => {
      setOverlapTolerance(val);
      engine.setAllyOverlapTolerance(val);
  };

  const handleCanvasClick = (x: number, y: number, isRightClick: boolean) => {
      engine.spawnUnit(x, y, isRightClick ? TEAM_BLUE : TEAM_RED, UnitType.SOLDIER);
  };

  if (!engine.world) {
      return (
          <div className="flex h-screen w-full bg-neutral-950 text-white items-center justify-center">
              <div className="text-center p-8 bg-neutral-900 rounded-xl border border-red-900">
                  <h1 className="text-2xl font-bold text-red-500 mb-4">Simulation Engine Failed to Load</h1>
                  <p className="text-neutral-400">The high-performance ECS module (bitecs) could not be initialized.</p>
                  <p className="text-neutral-500 text-sm mt-2">Check console for import errors.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-screen w-full bg-neutral-950 overflow-hidden relative">
      <ControlPanel 
        onSpawn={handleSpawn} 
        onReset={handleReset} 
        onPauseToggle={() => setIsPaused(!isPaused)}
        isPaused={isPaused}
        allyOverlapTolerance={overlapTolerance}
        onOverlapToleranceChange={handleOverlapToleranceChange}
        onToggleAdvisor={() => setIsAdvisorOpen(!isAdvisorOpen)}
        isAdvisorOpen={isAdvisorOpen}
      />

      <main className="flex-1 flex flex-col h-full p-4 gap-4">
        <header className="flex justify-between items-center mb-2 px-2">
            <div>
                 <h1 className="text-white text-xl font-bold">BattleSim.io</h1>
                 <p className="text-neutral-500 text-sm">Engine: bitECS (Data-Oriented) | Rendering: PixiJS</p>
            </div>
            <div className="flex gap-4 text-sm font-mono text-neutral-400">
                <div className="bg-neutral-900 px-3 py-1 rounded">Entities: <span className="text-white">{engine.world ? unitQuery(engine.world).length : 0}</span></div>
            </div>
        </header>

        <div className="flex-1 flex gap-4 min-h-0">
            <div className="flex-1 aspect-video min-h-0 bg-neutral-900 rounded-xl flex items-center justify-center p-2 border border-neutral-800 shadow-inner">
                <BattleCanvas 
                    engine={engine}
                    onCanvasClick={handleCanvasClick}
                />
            </div>

            <div className="w-64 flex-shrink-0">
                <StatsPanel stats={stats} />
            </div>
        </div>
      </main>
      
      {isAdvisorOpen && (
        <BattleAdvisor 
          isOpen={isAdvisorOpen}
          onClose={() => setIsAdvisorOpen(false)}
          stats={stats}
          engine={engine}
        />
      )}
    </div>
  );
}

export default App;
