
import { UnitType } from './constants';

export interface Vector2 {
  x: number;
  y: number;
}

export interface Unit {
  id: string;
  type: UnitType;
  team: string;
  position: Vector2;
  velocity: Vector2;
  acceleration: Vector2;
  health: number;
  maxHealth: number;
  radius: number;
  targetId: string | null;
  lastAttackTime: number;
  lastHitTime: number;
  state: 'IDLE' | 'MOVING' | 'ATTACKING';
  nextTargetUpdate: number;
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
  units: Unit[];
  particles: Particle[];
  stats: GameStats;
  isRunning: boolean;
}
