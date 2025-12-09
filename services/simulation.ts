import { v4 as uuidv4 } from 'uuid';
import { 
  Unit, 
  Vector2, 
  SimulationState, 
  Particle,
  GameStats
} from '../types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  UNIT_STATS, 
  UnitType, 
  TEAM_RED, 
  TEAM_BLUE,
  COLOR_RED,
  COLOR_BLUE
} from '../constants';

// Utility for Vector math
const Vec2 = {
  add: (v1: Vector2, v2: Vector2): Vector2 => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
  sub: (v1: Vector2, v2: Vector2): Vector2 => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
  mult: (v: Vector2, n: number): Vector2 => ({ x: v.x * n, y: v.y * n }),
  div: (v: Vector2, n: number): Vector2 => ({ x: v.x / n, y: v.y / n }),
  mag: (v: Vector2): number => Math.sqrt(v.x * v.x + v.y * v.y),
  normalize: (v: Vector2): Vector2 => {
    const m = Math.sqrt(v.x * v.x + v.y * v.y);
    return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
  },
  dist: (v1: Vector2, v2: Vector2): number => Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2)),
  limit: (v: Vector2, max: number): Vector2 => {
    const mSq = v.x * v.x + v.y * v.y;
    if (mSq > max * max) {
      const m = Math.sqrt(mSq);
      return { x: (v.x / m) * max, y: (v.y / m) * max };
    }
    return v;
  }
};

export class SimulationEngine {
  units: Unit[] = [];
  particles: Particle[] = [];
  stats: GameStats = {
    redCount: 0,
    blueCount: 0,
    totalTime: 0,
    redCasualties: 0,
    blueCasualties: 0,
  };
  
  // Spatial partitioning grid for performance
  gridSize = 40;
  grid: Map<string, string[]> = new Map();

  constructor() {
    this.reset();
  }

  reset() {
    this.units = [];
    this.particles = [];
    this.stats = {
      redCount: 0,
      blueCount: 0,
      totalTime: 0,
      redCasualties: 0,
      blueCasualties: 0,
    };
  }

  spawnUnit(x: number, y: number, team: string, type: UnitType = UnitType.SOLDIER) {
    const stats = UNIT_STATS[type];
    const unit: Unit = {
      id: uuidv4(),
      type,
      team,
      position: { x, y },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      radius: stats.radius,
      targetId: null,
      lastAttackTime: 0,
      state: 'IDLE'
    };
    this.units.push(unit);
  }

  private updateGrid() {
    this.grid.clear();
    for (const unit of this.units) {
      const key = `${Math.floor(unit.position.x / this.gridSize)},${Math.floor(unit.position.y / this.gridSize)}`;
      if (!this.grid.has(key)) {
        this.grid.set(key, []);
      }
      this.grid.get(key)?.push(unit.id);
    }
  }

  private getNeighbors(unit: Unit): Unit[] {
    const neighbors: Unit[] = [];
    const cellX = Math.floor(unit.position.x / this.gridSize);
    const cellY = Math.floor(unit.position.y / this.gridSize);

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        const key = `${cellX + x},${cellY + y}`;
        const ids = this.grid.get(key);
        if (ids) {
          for (const id of ids) {
            if (id !== unit.id) {
              const other = this.units.find(u => u.id === id);
              if (other) neighbors.push(other);
            }
          }
        }
      }
    }
    return neighbors;
  }

  update(deltaTime: number) {
    this.stats.totalTime += deltaTime;
    this.updateGrid();

    // Remove dead units
    const aliveUnits = this.units.filter(u => u.health > 0);
    const deadUnits = this.units.filter(u => u.health <= 0);
    
    deadUnits.forEach(u => {
      if (u.team === TEAM_RED) this.stats.redCasualties++;
      else this.stats.blueCasualties++;
      
      // Spawn death particles
      for(let i=0; i<5; i++) {
        this.particles.push({
          id: uuidv4(),
          position: { ...u.position },
          velocity: { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
          life: 1.0,
          maxLife: 1.0,
          color: u.team === TEAM_RED ? COLOR_RED : COLOR_BLUE,
          size: Math.random() * 3 + 1
        });
      }
    });

    this.units = aliveUnits;
    this.stats.redCount = this.units.filter(u => u.team === TEAM_RED).length;
    this.stats.blueCount = this.units.filter(u => u.team === TEAM_BLUE).length;

    // Update Units
    for (const unit of this.units) {
      const stats = UNIT_STATS[unit.type];
      const neighbors = this.getNeighbors(unit);
      
      // AI Logic: Find Target
      let target: Unit | undefined;
      let minDist = Infinity;
      
      // Simple scan for nearest enemy (optimization: only scan neighbors + extended radius or check all if count is low)
      // For performance with many units, this should be optimized. 
      // Current: Check all enemies.
      const enemies = this.units.filter(u => u.team !== unit.team);
      for (const enemy of enemies) {
        const d = Vec2.dist(unit.position, enemy.position);
        if (d < minDist) {
          minDist = d;
          target = enemy;
        }
      }

      // Forces
      let separation = { x: 0, y: 0 };
      let seek = { x: 0, y: 0 };
      let boundary = { x: 0, y: 0 };

      // 1. Separation (Avoid crowding)
      let separationCount = 0;
      for (const other of neighbors) {
        const d = Vec2.dist(unit.position, other.position);
        if (d > 0 && d < unit.radius + other.radius + 5) {
          const diff = Vec2.sub(unit.position, other.position);
          const weight = Vec2.normalize(diff);
          const invDist = Vec2.div(weight, d); // Weight by inverse distance
          separation = Vec2.add(separation, invDist);
          separationCount++;
        }
      }
      if (separationCount > 0) {
        separation = Vec2.div(separation, separationCount);
        separation = Vec2.normalize(separation);
        separation = Vec2.mult(separation, stats.speed * 2); // High priority
      }

      // 2. Seek (Move to target)
      if (target) {
        const d = Vec2.dist(unit.position, target.position);
        const attackRange = stats.range;
        
        if (d <= attackRange + target.radius + unit.radius) {
          // In range, stop moving and attack
          unit.velocity = Vec2.mult(unit.velocity, 0.5); // Friction
          
          if (Date.now() - unit.lastAttackTime > stats.attackSpeed) {
            target.health -= stats.damage;
            unit.lastAttackTime = Date.now();
            unit.state = 'ATTACKING';
            
            // Visual feedback
            this.particles.push({
              id: uuidv4(),
              position: Vec2.add(unit.position, Vec2.mult(Vec2.normalize(Vec2.sub(target.position, unit.position)), unit.radius)),
              velocity: Vec2.mult(Vec2.normalize(Vec2.sub(target.position, unit.position)), 2),
              life: 0.3,
              maxLife: 0.3,
              color: '#ffffff',
              size: 2
            });
          }
        } else {
          // Move towards target
          unit.state = 'MOVING';
          const desired = Vec2.sub(target.position, unit.position);
          seek = Vec2.normalize(desired);
          seek = Vec2.mult(seek, stats.speed);
        }
      } else {
        unit.state = 'IDLE';
        unit.velocity = Vec2.mult(unit.velocity, 0.9); // Stop if no target
      }

      // 3. Boundary Avoidance
      const margin = 50;
      if (unit.position.x < margin) boundary.x = 1;
      if (unit.position.x > CANVAS_WIDTH - margin) boundary.x = -1;
      if (unit.position.y < margin) boundary.y = 1;
      if (unit.position.y > CANVAS_HEIGHT - margin) boundary.y = -1;
      boundary = Vec2.mult(boundary, stats.speed * 3);

      // Apply Forces
      if (unit.state === 'MOVING') {
        let steer = { x: 0, y: 0 };
        steer = Vec2.add(steer, Vec2.mult(seek, 1.0));
        steer = Vec2.add(steer, Vec2.mult(separation, 1.5));
        steer = Vec2.add(steer, boundary);

        // Apply steering to velocity
        unit.acceleration = steer; // Simplified: force directly affects velocity for snappier movement
        unit.velocity = Vec2.add(unit.velocity, unit.acceleration);
        unit.velocity = Vec2.limit(unit.velocity, stats.speed);
        
        // Update Position
        unit.position = Vec2.add(unit.position, unit.velocity);
      } else if (unit.state === 'ATTACKING' || unit.state === 'IDLE') {
        // Still apply separation even when attacking to avoid stacking
         if (separationCount > 0) {
            unit.position = Vec2.add(unit.position, Vec2.mult(separation, 0.5));
         }
      }

      // Hard clamp to bounds
      unit.position.x = Math.max(unit.radius, Math.min(CANVAS_WIDTH - unit.radius, unit.position.x));
      unit.position.y = Math.max(unit.radius, Math.min(CANVAS_HEIGHT - unit.radius, unit.position.y));
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= deltaTime;
      p.position = Vec2.add(p.position, p.velocity);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  getState(): SimulationState {
    return {
      units: [...this.units],
      particles: [...this.particles],
      stats: { ...this.stats },
      isRunning: true
    };
  }
}