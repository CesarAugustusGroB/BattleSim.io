export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

export const TEAM_RED = 'RED';
export const TEAM_BLUE = 'BLUE';

export const UNIT_RADIUS = 8;
export const ATTACK_RANGE = 25; // Melee range
export const VISION_RANGE = 300;

// Colors
export const COLOR_RED = '#ef4444';
export const COLOR_RED_DARK = '#991b1b';
export const COLOR_BLUE = '#3b82f6';
export const COLOR_BLUE_DARK = '#1e3a8a';
export const COLOR_GROUND = '#262626';
export const COLOR_OBSTACLE = '#525252';

export enum UnitType {
  SOLDIER = 'SOLDIER',
  TANK = 'TANK',
  ARCHER = 'ARCHER'
}

export const UNIT_STATS = {
  [UnitType.SOLDIER]: {
    maxHealth: 100,
    damage: 10,
    attackSpeed: 1000, // ms per attack
    speed: 1.5,
    radius: 8,
    range: 25,
    color: '#ffffff'
  },
  [UnitType.TANK]: {
    maxHealth: 300,
    damage: 25,
    attackSpeed: 2000,
    speed: 0.8,
    radius: 14,
    range: 35,
    color: '#d4d4d8'
  },
  [UnitType.ARCHER]: {
    maxHealth: 60,
    damage: 15,
    attackSpeed: 800,
    speed: 1.2,
    radius: 7,
    range: 150,
    color: '#a1a1aa'
  }
};