
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
  COLOR_BLUE,
  VISION_RANGE
} from '../constants';

// Performance Tuning
const GRID_SIZE = 80;
const GRID_COLS = Math.ceil(CANVAS_WIDTH / GRID_SIZE);
const GRID_ROWS = Math.ceil(CANVAS_HEIGHT / GRID_SIZE);
const GRID_CELLS = GRID_COLS * GRID_ROWS;

export class SimulationEngine {
  units: Unit[] = [];
  unitMap: Map<string, Unit> = new Map(); 
  particles: Particle[] = [];
  // Particle Pool to reduce GC
  particlePool: Particle[] = [];
  
  stats: GameStats = {
    redCount: 0,
    blueCount: 0,
    totalTime: 0,
    redCasualties: 0,
    blueCasualties: 0,
  };
  
  // Optimized Spatial partitioning grid: 1D array of Unit arrays
  grid: Unit[][] = [];
  
  // Simulation Settings
  allyOverlapTolerance: number = 0.0;

  constructor() {
    // Pre-allocate grid cells
    for(let i = 0; i < GRID_CELLS; i++) {
        this.grid[i] = [];
    }
    this.reset();
  }
  
  setAllyOverlapTolerance(value: number) {
      this.allyOverlapTolerance = Math.max(0, Math.min(0.9, value));
  }

  reset() {
    this.units = [];
    this.unitMap.clear();
    this.particles = [];
    this.particlePool = [];
    this.stats = {
      redCount: 0,
      blueCount: 0,
      totalTime: 0,
      redCasualties: 0,
      blueCasualties: 0,
    };
    
    for(let i = 0; i < GRID_CELLS; i++) {
        this.grid[i].length = 0;
    }
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
      lastHitTime: 0,
      state: 'IDLE',
      // Stagger AI updates to prevent spikes
      nextTargetUpdate: Date.now() + Math.random() * 500
    };
    this.units.push(unit);
    this.unitMap.set(unit.id, unit);
  }

  // Get a particle from pool or create new
  private spawnParticle(x: number, y: number, color: string, speed: number, size: number, life: number) {
      let p: Particle;
      if (this.particlePool.length > 0) {
          p = this.particlePool.pop()!;
          p.position.x = x;
          p.position.y = y;
          p.color = color;
          p.life = life;
          p.maxLife = life;
          p.size = size;
      } else {
          p = {
              id: uuidv4(), // ID isn't strictly needed for rendering but kept for type compliance
              position: { x, y },
              velocity: { x: 0, y: 0 },
              life,
              maxLife: life,
              color,
              size
          };
      }
      
      const angle = Math.random() * Math.PI * 2;
      p.velocity.x = Math.cos(angle) * speed;
      p.velocity.y = Math.sin(angle) * speed;
      
      this.particles.push(p);
  }

  private updateGrid() {
    // Fast clear
    for (let i = 0; i < GRID_CELLS; i++) {
      this.grid[i].length = 0;
    }

    // Populate
    const len = this.units.length;
    for (let i = 0; i < len; i++) {
      const u = this.units[i];
      // Fast floor
      const cx = (u.position.x / GRID_SIZE) | 0;
      const cy = (u.position.y / GRID_SIZE) | 0;

      // Bounds check for safety
      if (cx >= 0 && cx < GRID_COLS && cy >= 0 && cy < GRID_ROWS) {
        this.grid[cx + cy * GRID_COLS].push(u);
      }
    }
  }

  private findTarget(unit: Unit): Unit | null {
    // 1. Check if current target is valid (Quick check)
    if (unit.targetId) {
      const currentTarget = this.unitMap.get(unit.targetId);
      if (currentTarget && currentTarget.health > 0) {
        const dx = currentTarget.position.x - unit.position.x;
        const dy = currentTarget.position.y - unit.position.y;
        const dSq = dx*dx + dy*dy;
        
        // Hysteresis: Keep target slightly longer than vision range
        if (dSq <= (VISION_RANGE * 1.2) ** 2) {
           return currentTarget;
        }
      }
    }

    // 2. Search for new target (Spatial Grid)
    const cx = (unit.position.x / GRID_SIZE) | 0;
    const cy = (unit.position.y / GRID_SIZE) | 0;
    const searchRad = Math.ceil(VISION_RANGE / GRID_SIZE);
    
    let closest: Unit | null = null;
    let minDSq = Infinity;
    const visionSq = VISION_RANGE * VISION_RANGE;

    for (let y = -searchRad; y <= searchRad; y++) {
        for (let x = -searchRad; x <= searchRad; x++) {
            const nx = cx + x;
            const ny = cy + y;
            
            if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS) {
                const cell = this.grid[nx + ny * GRID_COLS];
                const cellLen = cell.length;
                // Reverse loop sometimes helps with cache locality if we just added them, but standard is fine
                for(let i = 0; i < cellLen; i++) {
                    const other = cell[i];
                    if (other.team !== unit.team && other.health > 0) {
                        const dx = other.position.x - unit.position.x;
                        const dy = other.position.y - unit.position.y;
                        const dSq = dx*dx + dy*dy;
                        
                        if (dSq < minDSq && dSq <= visionSq) {
                            minDSq = dSq;
                            closest = other;
                        }
                    }
                }
            }
        }
    }
    
    return closest;
  }

  // Iterative Position Correction (Stable Hard Collisions)
  private resolveCollisions() {
      const len = this.units.length;
      
      for (let i = 0; i < len; i++) {
          const unit = this.units[i];
          const cx = (unit.position.x / GRID_SIZE) | 0;
          const cy = (unit.position.y / GRID_SIZE) | 0;

          // Check neighbors 3x3
          for (let yOff = -1; yOff <= 1; yOff++) {
              for (let xOff = -1; xOff <= 1; xOff++) {
                  const nx = cx + xOff;
                  const ny = cy + yOff;
                  if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS) {
                      const cell = this.grid[nx + ny * GRID_COLS];
                      const cellLen = cell.length;
                      for (let j = 0; j < cellLen; j++) {
                          const other = cell[j];
                          if (other === unit) continue;

                          const dx = unit.position.x - other.position.x;
                          const dy = unit.position.y - other.position.y;
                          const distSq = dx*dx + dy*dy;
                          
                          let minDist = unit.radius + other.radius;
                          
                          // Apply Overlap Tolerance for Allies
                          if (unit.team === other.team) {
                              minDist *= (1.0 - this.allyOverlapTolerance);
                          } else {
                              // Enemies: Keep a tiny gap to prevent sticking
                              minDist += 1;
                          }
                          
                          // If overlapping
                          if (distSq > 0 && distSq < minDist * minDist) {
                              const dist = Math.sqrt(distSq);
                              const penetration = minDist - dist;
                              const moveAmt = penetration * 0.5; // Split move
                              
                              const nx = dx / dist;
                              const ny = dy / dist;
                              
                              // Displace Unit
                              unit.position.x += nx * moveAmt;
                              unit.position.y += ny * moveAmt;
                              
                              // Displace Other
                              other.position.x -= nx * moveAmt;
                              other.position.y -= ny * moveAmt;
                          }
                      }
                  }
              }
          }
      }
  }

  update(deltaTime: number) {
    this.stats.totalTime += deltaTime;
    const dt = Math.min(deltaTime, 0.05);
    const now = Date.now();

    // 1. Logic & Steering Integration (Move Logic)
    // We update velocity and tentative position here, ignoring collisions for now.
    const activeLen = this.units.length;
    for (let i = 0; i < activeLen; i++) {
        const unit = this.units[i];
        const stats = UNIT_STATS[unit.type];
        
        // --- TARGETING AI (Throttled) ---
        if (now > unit.nextTargetUpdate) {
            const t = this.findTarget(unit);
            unit.targetId = t ? t.id : null;
            // Update next time between 200ms and 400ms (staggered)
            unit.nextTargetUpdate = now + 200 + Math.random() * 200;
        }

        // --- STEERING FORCES ---
        let seekX = 0;
        let seekY = 0;
        let target: Unit | undefined;

        if (unit.targetId) {
             target = this.unitMap.get(unit.targetId);
             if (!target) unit.targetId = null;
        }

        if (target) {
            const dx = target.position.x - unit.position.x;
            const dy = target.position.y - unit.position.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const attackRange = stats.range + unit.radius + target.radius;

            if (dist <= attackRange) {
                // ATTACKING
                unit.state = 'ATTACKING';
                // Stop moving
                unit.velocity.x *= 0.8;
                unit.velocity.y *= 0.8;
                
                if (now - unit.lastAttackTime > stats.attackSpeed) {
                    target.health -= stats.damage;
                    target.lastHitTime = now;
                    unit.lastAttackTime = now;
                    // Spark effect
                    this.spawnParticle(
                        unit.position.x + (dx/dist)*unit.radius, 
                        unit.position.y + (dy/dist)*unit.radius,
                        '#ffffff', 100, 2, 0.2
                    );
                }
            } else {
                // CHASING
                unit.state = 'MOVING';
                seekX = (dx / dist) * (stats.speed * 60);
                seekY = (dy / dist) * (stats.speed * 60);
            }
        } else {
            // MARCHING
            unit.state = 'MOVING';
            const targetX = unit.team === TEAM_RED ? CANVAS_WIDTH - 50 : 50;
            const targetY = unit.position.y * 0.95 + (CANVAS_HEIGHT/2) * 0.05; // Gently steer to center Y
            const dx = targetX - unit.position.x;
            const dy = targetY - unit.position.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > 50) {
                seekX = (dx / dist) * (stats.speed * 40);
                seekY = (dy / dist) * (stats.speed * 40);
            } else {
                unit.state = 'IDLE';
                unit.velocity.x *= 0.9;
                unit.velocity.y *= 0.9;
            }
        }
        
        // --- FLOCKING (Alignment & Cohesion) ---
        // Only apply when moving to simulate formation
        if (unit.state === 'MOVING') {
            let neighborCount = 0;
            let alignX = 0, alignY = 0;
            let cohereX = 0, cohereY = 0;
            
            const cx = (unit.position.x / GRID_SIZE) | 0;
            const cy = (unit.position.y / GRID_SIZE) | 0;
            const flockRangeSq = (unit.radius * 6) ** 2; // Perception radius

            // Check grid neighbors (using grid from previous frame, which is fine)
            for (let yOff = -1; yOff <= 1; yOff++) {
                for (let xOff = -1; xOff <= 1; xOff++) {
                    const nx = cx + xOff;
                    const ny = cy + yOff;
                    if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS) {
                        const cell = this.grid[nx + ny * GRID_COLS];
                        const cellLen = cell.length;
                        for(let j=0; j<cellLen; j++) {
                            const other = cell[j];
                            if (other === unit) continue;
                            
                            // Only flock with teammates
                            if (other.team === unit.team) {
                                const dx = other.position.x - unit.position.x;
                                const dy = other.position.y - unit.position.y;
                                const dSq = dx*dx + dy*dy;

                                if (dSq < flockRangeSq) {
                                    // Alignment: match velocity
                                    alignX += other.velocity.x;
                                    alignY += other.velocity.y;
                                    
                                    // Cohesion: steer to center
                                    cohereX += other.position.x;
                                    cohereY += other.position.y;
                                    
                                    neighborCount++;
                                }
                            }
                        }
                    }
                }
            }
            
            if (neighborCount > 0) {
                // Alignment Force
                alignX /= neighborCount;
                alignY /= neighborCount;
                const alignMag = Math.sqrt(alignX*alignX + alignY*alignY);
                if (alignMag > 0) {
                    // Weight: 20.0 (Keep moving in same direction)
                    seekX += (alignX / alignMag) * (stats.speed * 20.0);
                    seekY += (alignY / alignMag) * (stats.speed * 20.0);
                }
                
                // Cohesion Force
                cohereX /= neighborCount;
                cohereY /= neighborCount;
                // Vector to center of mass
                let cohereDirX = cohereX - unit.position.x;
                let cohereDirY = cohereY - unit.position.y;
                const cohereMag = Math.sqrt(cohereDirX*cohereDirX + cohereDirY*cohereDirY);
                if (cohereMag > 0) {
                    // Weight: 10.0 (Gentle grouping)
                    seekX += (cohereDirX / cohereMag) * (stats.speed * 10.0);
                    seekY += (cohereDirY / cohereMag) * (stats.speed * 10.0);
                }
            }
        }

        // Boundary Avoidance (Soft push)
        let boundX = 0;
        let boundY = 0;
        const margin = 40;
        if (unit.position.x < margin) boundX = 150;
        else if (unit.position.x > CANVAS_WIDTH - margin) boundX = -150;
        if (unit.position.y < margin) boundY = 150;
        else if (unit.position.y > CANVAS_HEIGHT - margin) boundY = -150;

        // Apply Forces
        if (unit.state === 'MOVING' || unit.state === 'IDLE') {
             // acceleration = forces
             unit.acceleration.x = seekX + boundX;
             unit.acceleration.y = seekY + boundY;

             // velocity += acceleration * dt
             unit.velocity.x += unit.acceleration.x * dt;
             unit.velocity.y += unit.acceleration.y * dt;

             // Speed Limit
             const maxSpeed = stats.speed * 60;
             const vSq = unit.velocity.x * unit.velocity.x + unit.velocity.y * unit.velocity.y;
             if (vSq > maxSpeed * maxSpeed) {
                 const vMag = Math.sqrt(vSq);
                 unit.velocity.x = (unit.velocity.x / vMag) * maxSpeed;
                 unit.velocity.y = (unit.velocity.y / vMag) * maxSpeed;
             }
        }

        // Apply Velocity to Position (Integration)
        unit.position.x += unit.velocity.x * dt;
        unit.position.y += unit.velocity.y * dt;

        // Hard Screen Clamp
        if(unit.position.x < unit.radius) unit.position.x = unit.radius;
        if(unit.position.x > CANVAS_WIDTH - unit.radius) unit.position.x = CANVAS_WIDTH - unit.radius;
        if(unit.position.y < unit.radius) unit.position.y = unit.radius;
        if(unit.position.y > CANVAS_HEIGHT - unit.radius) unit.position.y = CANVAS_HEIGHT - unit.radius;
    }

    // 2. Spatial Partitioning Update
    // We update the grid with the new tentative positions
    this.updateGrid();

    // 3. Collision Resolution (Iterative Solver)
    // Run multiple passes to stabilize the stack of units
    const SOLVER_ITERATIONS = 2; 
    for(let k=0; k<SOLVER_ITERATIONS; k++) {
        this.resolveCollisions();
    }

    // 4. Lifecycle & Clean up
    let writeIdx = 0;
    let rCount = 0;
    let bCount = 0;
    const initialLen = this.units.length;
    
    for(let i = 0; i < initialLen; i++) {
        const unit = this.units[i];
        if(unit.health > 0) {
            // Keep unit
            if (i !== writeIdx) {
                this.units[writeIdx] = unit;
            }
            if(unit.team === TEAM_RED) rCount++; else bCount++;
            writeIdx++;
        } else {
            // Death Logic
            if (unit.team === TEAM_RED) this.stats.redCasualties++;
            else this.stats.blueCasualties++;
            this.unitMap.delete(unit.id);
            
            // Death Particles
            for(let j=0; j<5; j++) {
                this.spawnParticle(
                    unit.position.x, unit.position.y,
                    unit.team === TEAM_RED ? COLOR_RED : COLOR_BLUE,
                    Math.random() * 100 + 50,
                    Math.random() * 3 + 2,
                    0.6
                );
            }
        }
    }
    this.units.length = writeIdx;
    this.stats.redCount = rCount;
    this.stats.blueCount = bCount;

    // 5. Update Particles
    let pWriteIdx = 0;
    const pLen = this.particles.length;
    for(let i=0; i<pLen; i++) {
        const p = this.particles[i];
        p.life -= dt;
        if(p.life > 0) {
            p.position.x += p.velocity.x * dt;
            p.position.y += p.velocity.y * dt;
            
            if (i !== pWriteIdx) {
                this.particles[pWriteIdx] = p;
            }
            pWriteIdx++;
        } else {
            // Recycle
            this.particlePool.push(p);
        }
    }
    this.particles.length = pWriteIdx;
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
