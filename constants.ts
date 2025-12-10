
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

export const TEAM_RED = 'RED';
export const TEAM_BLUE = 'BLUE';

// ECS Numeric Mappings
export const TEAM_ID_RED = 0;
export const TEAM_ID_BLUE = 1;

export const STATE_IDLE = 0;
export const STATE_MOVING = 1;
export const STATE_ATTACKING = 2;

export const TYPE_ID_SOLDIER = 0;
export const TYPE_ID_TANK = 1;
export const TYPE_ID_ARCHER = 2;

export const UNIT_RADIUS = 8;
export const ATTACK_RANGE = 25; // Melee range
export const VISION_RANGE = 500; // Increased vision range

// Colors
export const COLOR_RED = '#ef4444';
export const COLOR_RED_DARK = '#991b1b';
export const COLOR_BLUE = '#3b82f6';
export const COLOR_BLUE_DARK = '#1e3a8a';
export const COLOR_GROUND = '#171717';
export const COLOR_OBSTACLE = '#525252';

export enum UnitType {
  SOLDIER = 'SOLDIER',
  TANK = 'TANK',
  ARCHER = 'ARCHER'
}

export const UNIT_STATS = {
  [UnitType.SOLDIER]: {
    typeId: TYPE_ID_SOLDIER,
    maxHealth: 100,
    damage: 12,
    attackSpeed: 800, // ms per attack
    speed: 2.0,
    radius: 10,
    range: 30,
    color: '#ffffff'
  },
  [UnitType.TANK]: {
    typeId: TYPE_ID_TANK,
    maxHealth: 400,
    damage: 30,
    attackSpeed: 1800,
    speed: 0.8,
    radius: 18,
    range: 40,
    color: '#d4d4d8'
  },
  [UnitType.ARCHER]: {
    typeId: TYPE_ID_ARCHER,
    maxHealth: 60,
    damage: 15,
    attackSpeed: 1000,
    speed: 1.5,
    radius: 9,
    range: 180,
    color: '#a1a1aa'
  }
};