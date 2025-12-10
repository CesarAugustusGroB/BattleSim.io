
import { UnitType } from './constants';

export interface Vector2 {
  x: number;
  y: number;
}

// Data-Oriented View of a Unit (for React/UI consumption only)
export interface UnitView {
  id: number;
  type: UnitType;
  team: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  radius: number;
  state: string;
}

export interface Particle {
  id: string;
  position: Vector2;
  velocity: Vector2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameStats {
  redCount: number;
  blueCount: number;
  totalTime: number;
  redCasualties: number;
  blueCasualties: number;
}

export interface SimulationState {
  // We no longer expose raw Unit objects here for rendering.
  // Rendering reads directly from ECS arrays.
  particles: Particle[];
  stats: GameStats;
  isRunning: boolean;
}