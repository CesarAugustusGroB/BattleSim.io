
import React, { useEffect, useState, useRef, useCallback } from 'react';
import BattleCanvas from './components/BattleCanvas';
import ControlPanel from './components/ControlPanel';
import StatsPanel from './components/StatsPanel';
import BattleAdvisor from './components/BattleAdvisor';
import ErrorBoundary from './components/ErrorBoundary';
import { SimulationEngine } from './services/simulation';
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
      console.log("[App] Initializing SimulationEngine...");
      const eng = new SimulationEngine();
      // Initial Setup
      if (eng.world) {
        console.log("[App] Spawning initial units...");
        eng.spawnUnit(200, CANVAS_HEIGHT / 2, 0, UnitType.SOLDIER); // 0 = RED
        eng.spawnUnit(CANVAS_WIDTH - 200, CANVAS_HEIGHT / 2, 1, UnitType.SOLDIER); // 1 = BLUE
        console.log(`[App] Initial spawn complete. Entities: ${eng.unitQuery.length}`);
      } else {
        console.error("[App] Engine world is missing!");
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
    <div className="grid grid-cols-[320px_minmax(0,1fr)_280px] h-screen w-full bg-neutral-950 overflow-hidden relative text-white">
      {/* LEFT COLUMN: CONTROLS */}
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

      {/* CENTER COLUMN: HEADER + CANVAS */}
      <main className="flex flex-col h-full min-w-0 bg-black/20 relative">
        <header className="absolute top-0 left-0 w-full z-10 p-4 pointer-events-none flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent h-24">
          <div className="pointer-events-auto">
            <h1 className="text-white text-xl font-bold drop-shadow-md">BattleSim.io</h1>
            <p className="text-neutral-400 text-xs font-mono">Engine: Local ECS | Renderer: PixiJS</p>
          </div>
          <div className="bg-black/60 backdrop-blur px-3 py-1 rounded border border-white/10 text-xs font-mono text-neutral-300">
            Entities: <span className="text-green-400 font-bold">{engine.world && engine.unitQuery ? engine.unitQuery.length : 0}</span>
          </div>
        </header>

        <div className="flex-1 w-full h-full relative min-h-0 min-w-0">
          <BattleCanvas
            engine={engine}
            onCanvasClick={handleCanvasClick}
          />
        </div>
      </main>

      {/* RIGHT COLUMN: STATS */}
      <aside className="border-l border-neutral-800 bg-neutral-900/50 backdrop-blur-sm p-4 flex flex-col gap-4 overflow-y-auto min-w-0">
        <div className="font-bold text-neutral-500 text-xs uppercase tracking-wider mb-2">Battle Analytics</div>
        <ErrorBoundary>
          <StatsPanel stats={stats} />
        </ErrorBoundary>
      </aside>

      {/* OVERLAYS */}
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
