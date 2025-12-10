
import * as BitecsNamespace from 'bitecs';
import { 
  Particle,
  GameStats,
  UnitView
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
  VISION_RANGE,
  TEAM_ID_RED,
  TEAM_ID_BLUE,
  STATE_IDLE,
  STATE_MOVING,
  STATE_ATTACKING,
  TYPE_ID_SOLDIER,
  TYPE_ID_TANK,
  TYPE_ID_ARCHER
} from '../constants';

// --- ECS Setup & Safety Layer ---
let createWorld: any, addEntity: any, removeEntity: any, defineComponent: any, defineQuery: any;
let Types: any = {};
let f32 = 'f32', ui8 = 'ui8', eid = 'eid';

try {
    // Robust unwrapping for ESM/CJS interop
    const bitecs: any = (BitecsNamespace as any).default || BitecsNamespace;
    
    if (bitecs) {
        createWorld = bitecs.createWorld;
        addEntity = bitecs.addEntity;
        removeEntity = bitecs.removeEntity;
        defineComponent = bitecs.defineComponent;
        defineQuery = bitecs.defineQuery;
        Types = bitecs.Types || bitecs; // fallback for older versions
        
        if (Types) {
            f32 = Types.f32 || 'f32';
            ui8 = Types.ui8 || 'ui8';
            eid = Types.eid || 'eid';
        }
    }
} catch (e) {
    console.error("Critical: Failed to initialize bitECS module", e);
}

// Dummy factory if load failed to prevent top-level crash
const safeDefine = (schema: any) => defineComponent ? defineComponent(schema) : {};
const safeQuery = (comps: any[]) => defineQuery ? defineQuery(comps) : () => [];

// --- Components ---
const Vector2 = { x: f32, y: f32 };

export const Position = safeDefine(Vector2);
export const Velocity = safeDefine(Vector2);
export const Force = safeDefine(Vector2);

export const UnitComponent = safeDefine({
   team: ui8,     // 0 or 1
   type: ui8,     // 0, 1, 2
   health: f32,
   maxHealth: f32,
   radius: f32,
   range: f32,
   damage: f32,
   attackSpeed: f32,
   speed: f32,
   state: ui8,
   targetId: eid,
   lastAttackTime: f32,
   lastHitTime: f32,
   nextTargetUpdate: f32
});

// Queries
export const unitQuery = safeQuery([Position, Velocity, UnitComponent]);

// Performance Tuning
const GRID_SIZE = 80;
const GRID_COLS = Math.ceil(CANVAS_WIDTH / GRID_SIZE);
const GRID_ROWS = Math.ceil(CANVAS_HEIGHT / GRID_SIZE);
const GRID_CELLS = GRID_COLS * GRID_ROWS;

export class SimulationEngine {
  world: any;
  
  particles: Particle[] = [];
  particlePool: Particle[] = [];
  
  stats: GameStats = {
    redCount: 0,
    blueCount: 0,
    totalTime: 0,
    redCasualties: 0,
    blueCasualties: 0,
  };
  
  // Spatial partitioning: 1D array of array of Entity IDs
  grid: number[][] = [];
  
  // Flow Fields
  redFlowField: Float32Array;
  blueFlowField: Float32Array;
  
  allyOverlapTolerance: number = 0.0;

  constructor() {
    if (!createWorld) {
        console.error("ECS Engine dependencies missing. Simulation will not run.");
        return;
    }

    this.world = createWorld();
    
    // Pre-allocate grid cells
    for(let i = 0; i < GRID_CELLS; i++) {
        this.grid[i] = [];
    }
    
    const flowCols = Math.ceil(CANVAS_WIDTH / 40);
    const flowRows = Math.ceil(CANVAS_HEIGHT / 40);
    const flowSize = flowCols * flowRows * 2;
    this.redFlowField = new Float32Array(flowSize);
    this.blueFlowField = new Float32Array(flowSize);
    
    this.generateFlowFields(flowCols, flowRows);
  }
  
  private generateFlowFields(cols: number, rows: number) {
      for(let y = 0; y < rows; y++) {
          for(let x = 0; x < cols; x++) {
              const idx = (x + y * cols) * 2;
              const px = x * 40 + 20;
              const py = y * 40 + 20;
              const centerY = CANVAS_HEIGHT / 2;
              const dy = centerY - py;

              // RED TEAM (Go Right)
              let rx = 1.0;
              let ry = dy * 0.002;
              if (py < 100) ry += 0.5;
              if (py > CANVAS_HEIGHT - 100) ry -= 0.5;
              const rLen = Math.sqrt(rx*rx + ry*ry);
              this.redFlowField[idx] = rx / rLen;
              this.redFlowField[idx+1] = ry / rLen;

              // BLUE TEAM (Go Left)
              let bx = -1.0;
              let by = dy * 0.002;
              if (py < 100) by += 0.5;
              if (py > CANVAS_HEIGHT - 100) by -= 0.5;
              const bLen = Math.sqrt(bx*bx + by*by);
              this.blueFlowField[idx] = bx / bLen;
              this.blueFlowField[idx+1] = by / bLen;
          }
      }
  }

  setAllyOverlapTolerance(value: number) {
      this.allyOverlapTolerance = Math.max(0, Math.min(0.9, value));
  }

  reset() {
    if (!this.world) return;
    const ents = unitQuery(this.world);
    for (let i = 0; i < ents.length; i++) {
        removeEntity(this.world, ents[i]);
    }
    
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

  spawnUnit(x: number, y: number, teamStr: string, type: UnitType = UnitType.SOLDIER) {
    if (!this.world) return;
    const eid = addEntity(this.world);
    const stats = UNIT_STATS[type];
    
    Position.x[eid] = x;
    Position.y[eid] = y;
    Velocity.x[eid] = 0;
    Velocity.y[eid] = 0;
    Force.x[eid] = 0;
    Force.y[eid] = 0;
    
    UnitComponent.team[eid] = teamStr === TEAM_RED ? TEAM_ID_RED : TEAM_ID_BLUE;
    UnitComponent.type[eid] = stats.typeId;
    UnitComponent.health[eid] = stats.maxHealth;
    UnitComponent.maxHealth[eid] = stats.maxHealth;
    UnitComponent.radius[eid] = stats.radius;
    UnitComponent.range[eid] = stats.range;
    UnitComponent.damage[eid] = stats.damage;
    UnitComponent.attackSpeed[eid] = stats.attackSpeed;
    UnitComponent.speed[eid] = stats.speed;
    
    UnitComponent.state[eid] = STATE_IDLE;
    UnitComponent.targetId[eid] = 0;
    UnitComponent.lastAttackTime[eid] = 0;
    UnitComponent.lastHitTime[eid] = 0;
    UnitComponent.nextTargetUpdate[eid] = Date.now() + Math.random() * 500;

    if (teamStr === TEAM_RED) this.stats.redCount++;
    else this.stats.blueCount++;
  }

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
              id: Math.random().toString(36).slice(2, 9),
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

  private updateGrid(ents: number[]) {
    for (let i = 0; i < GRID_CELLS; i++) {
      this.grid[i].length = 0;
    }

    const len = ents.length;
    for (let i = 0; i < len; i++) {
      const eid = ents[i];
      const cx = (Position.x[eid] / GRID_SIZE) | 0;
      const cy = (Position.y[eid] / GRID_SIZE) | 0;

      if (cx >= 0 && cx < GRID_COLS && cy >= 0 && cy < GRID_ROWS) {
        this.grid[cx + cy * GRID_COLS].push(eid);
      }
    }
  }

  private findTarget(eid: number): number {
    const myTeam = UnitComponent.team[eid];
    const px = Position.x[eid];
    const py = Position.y[eid];
    
    // Quick check current target
    const currentTgt = UnitComponent.targetId[eid];
    if (currentTgt > 0) {
        if (UnitComponent.health[currentTgt] > 0) {
            const dx = Position.x[currentTgt] - px;
            const dy = Position.y[currentTgt] - py;
            if (dx*dx + dy*dy <= (VISION_RANGE * 1.2) ** 2) {
                return currentTgt;
            }
        }
    }

    // Grid search
    const cx = (px / GRID_SIZE) | 0;
    const cy = (py / GRID_SIZE) | 0;
    const searchRad = Math.ceil(VISION_RANGE / GRID_SIZE);
    const visionSq = VISION_RANGE * VISION_RANGE;

    let closest = 0;
    let minDSq = Infinity;

    for (let y = -searchRad; y <= searchRad; y++) {
        for (let x = -searchRad; x <= searchRad; x++) {
            const nx = cx + x;
            const ny = cy + y;
            if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS) {
                const cell = this.grid[nx + ny * GRID_COLS];
                const cellLen = cell.length;
                for(let i=0; i<cellLen; i++) {
                    const other = cell[i];
                    if (UnitComponent.team[other] !== myTeam && UnitComponent.health[other] > 0) {
                         const dx = Position.x[other] - px;
                         const dy = Position.y[other] - py;
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

  private resolveCollisions(ents: number[]) {
      const len = ents.length;
      for (let i = 0; i < len; i++) {
          const eid = ents[i];
          const cx = (Position.x[eid] / GRID_SIZE) | 0;
          const cy = (Position.y[eid] / GRID_SIZE) | 0;

          for (let yOff = -1; yOff <= 1; yOff++) {
              for (let xOff = -1; xOff <= 1; xOff++) {
                  const nx = cx + xOff;
                  const ny = cy + yOff;
                  if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS) {
                      const cell = this.grid[nx + ny * GRID_COLS];
                      const cellLen = cell.length;
                      for (let j = 0; j < cellLen; j++) {
                          const other = cell[j];
                          if (other === eid) continue;

                          const dx = Position.x[eid] - Position.x[other];
                          const dy = Position.y[eid] - Position.y[other];
                          const distSq = dx*dx + dy*dy;
                          
                          let minDist = UnitComponent.radius[eid] + UnitComponent.radius[other];
                          
                          if (UnitComponent.team[eid] === UnitComponent.team[other]) {
                              minDist *= (1.0 - this.allyOverlapTolerance);
                          } else {
                              minDist += 1;
                          }
                          
                          if (distSq > 0 && distSq < minDist * minDist) {
                              const dist = Math.sqrt(distSq);
                              const penetration = minDist - dist;
                              const moveAmt = penetration * 0.5;
                              const nx = dx / dist;
                              const ny = dy / dist;
                              
                              Position.x[eid] += nx * moveAmt;
                              Position.y[eid] += ny * moveAmt;
                              Position.x[other] -= nx * moveAmt;
                              Position.y[other] -= ny * moveAmt;
                          }
                      }
                  }
              }
          }
      }
  }

  update(deltaTime: number) {
    if (!this.world) return;
    this.stats.totalTime += deltaTime;
    const dt = Math.min(deltaTime, 0.05);
    const now = Date.now();
    
    const ents = unitQuery(this.world);
    const len = ents.length;

    // 1. AI & Steering
    for(let i=0; i<len; i++) {
        const eid = ents[i];
        
        // --- TARGETING ---
        if (now > UnitComponent.nextTargetUpdate[eid]) {
            UnitComponent.targetId[eid] = this.findTarget(eid);
            UnitComponent.nextTargetUpdate[eid] = now + 200 + Math.random() * 200;
        }

        let seekX = 0, seekY = 0;
        const target = UnitComponent.targetId[eid];
        
        // --- COMBAT / SEEK ---
        let hasTarget = false;
        if (target > 0 && UnitComponent.health[target] > 0) {
            hasTarget = true;
            const dx = Position.x[target] - Position.x[eid];
            const dy = Position.y[target] - Position.y[eid];
            const dist = Math.sqrt(dx*dx + dy*dy);
            const range = UnitComponent.range[eid] + UnitComponent.radius[eid] + UnitComponent.radius[target];

            if (dist <= range) {
                UnitComponent.state[eid] = STATE_ATTACKING;
                Velocity.x[eid] *= 0.8;
                Velocity.y[eid] *= 0.8;
                
                if (now - UnitComponent.lastAttackTime[eid] > UnitComponent.attackSpeed[eid]) {
                    UnitComponent.health[target] -= UnitComponent.damage[eid];
                    UnitComponent.lastHitTime[target] = now;
                    UnitComponent.lastAttackTime[eid] = now;
                    // Visual
                    this.spawnParticle(
                        Position.x[eid] + (dx/dist)*UnitComponent.radius[eid],
                        Position.y[eid] + (dy/dist)*UnitComponent.radius[eid],
                        '#ffffff', 100, 2, 0.2
                    );
                }
            } else {
                UnitComponent.state[eid] = STATE_MOVING;
                const speed = UnitComponent.speed[eid] * 60;
                seekX = (dx / dist) * speed;
                seekY = (dy / dist) * speed;
            }
        } else {
            UnitComponent.targetId[eid] = 0; // Clear dead target
        }

        // --- MARCHING (Flow Field) ---
        if (!hasTarget) {
            UnitComponent.state[eid] = STATE_MOVING;
            const fx = (Position.x[eid] / 40) | 0;
            const fy = (Position.y[eid] / 40) | 0;
            
            if (fx >= 0 && fx < Math.ceil(CANVAS_WIDTH/40) && fy >= 0 && fy < Math.ceil(CANVAS_HEIGHT/40)) {
                const idx = (fx + fy * Math.ceil(CANVAS_WIDTH/40)) * 2;
                const field = UnitComponent.team[eid] === TEAM_ID_RED ? this.redFlowField : this.blueFlowField;
                const speed = UnitComponent.speed[eid] * 50;
                seekX = field[idx] * speed;
                seekY = field[idx+1] * speed;
            } else {
                // Center bias
                seekX = (CANVAS_WIDTH/2 - Position.x[eid]) * 0.1;
                seekY = (CANVAS_HEIGHT/2 - Position.y[eid]) * 0.1;
            }
        }

        // --- FLOCKING ---
        if (UnitComponent.state[eid] === STATE_MOVING) {
            let n = 0, ax = 0, ay = 0, cx = 0, cy = 0;
            const px = Position.x[eid];
            const py = Position.y[eid];
            const cxIdx = (px / GRID_SIZE) | 0;
            const cyIdx = (py / GRID_SIZE) | 0;
            const rangeSq = (UnitComponent.radius[eid] * 6) ** 2;

            for (let yOff = -1; yOff <= 1; yOff++) {
                for (let xOff = -1; xOff <= 1; xOff++) {
                    const nx = cxIdx + xOff;
                    const ny = cyIdx + yOff;
                    if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS) {
                        const cell = this.grid[nx + ny * GRID_COLS];
                        const cellLen = cell.length;
                        for(let j=0; j<cellLen; j++) {
                            const other = cell[j];
                            if (other === eid) continue;
                            if (UnitComponent.team[other] === UnitComponent.team[eid]) {
                                const dx = Position.x[other] - px;
                                const dy = Position.y[other] - py;
                                if (dx*dx + dy*dy < rangeSq) {
                                    ax += Velocity.x[other];
                                    ay += Velocity.y[other];
                                    cx += Position.x[other];
                                    cy += Position.y[other];
                                    n++;
                                }
                            }
                        }
                    }
                }
            }

            if (n > 0) {
                const speed = UnitComponent.speed[eid];
                ax /= n; ay /= n;
                const aMag = Math.sqrt(ax*ax + ay*ay);
                if (aMag > 0) {
                    seekX += (ax / aMag) * (speed * 20.0);
                    seekY += (ay / aMag) * (speed * 20.0);
                }
                cx /= n; cy /= n;
                const dx = cx - px;
                const dy = cy - py;
                const cMag = Math.sqrt(dx*dx + dy*dy);
                if (cMag > 0) {
                    seekX += (dx / cMag) * (speed * 10.0);
                    seekY += (dy / cMag) * (speed * 10.0);
                }
            }
        }

        // --- BOUNDS ---
        let bx = 0, by = 0;
        const m = 40;
        if (Position.x[eid] < m) bx = 150;
        else if (Position.x[eid] > CANVAS_WIDTH - m) bx = -150;
        if (Position.y[eid] < m) by = 150;
        else if (Position.y[eid] > CANVAS_HEIGHT - m) by = -150;

        // --- INTEGRATION ---
        if (UnitComponent.state[eid] === STATE_MOVING) {
            Force.x[eid] = seekX + bx;
            Force.y[eid] = seekY + by;
            
            Velocity.x[eid] += Force.x[eid] * dt;
            Velocity.y[eid] += Force.y[eid] * dt;
            
            const maxSpeed = UnitComponent.speed[eid] * 60;
            const vSq = Velocity.x[eid]*Velocity.x[eid] + Velocity.y[eid]*Velocity.y[eid];
            if (vSq > maxSpeed*maxSpeed) {
                const vm = Math.sqrt(vSq);
                Velocity.x[eid] = (Velocity.x[eid] / vm) * maxSpeed;
                Velocity.y[eid] = (Velocity.y[eid] / vm) * maxSpeed;
            }
        }

        Position.x[eid] += Velocity.x[eid] * dt;
        Position.y[eid] += Velocity.y[eid] * dt;
        
        // Hard Clamp
        if (Position.x[eid] < 5) Position.x[eid] = 5;
        if (Position.x[eid] > CANVAS_WIDTH - 5) Position.x[eid] = CANVAS_WIDTH - 5;
        if (Position.y[eid] < 5) Position.y[eid] = 5;
        if (Position.y[eid] > CANVAS_HEIGHT - 5) Position.y[eid] = CANVAS_HEIGHT - 5;
    }

    // 2. Spatial Update
    this.updateGrid(ents);

    // 3. Collisions
    const SOLVER_ITERATIONS = 2;
    for(let k=0; k<SOLVER_ITERATIONS; k++) {
        this.resolveCollisions(ents);
    }

    // 4. Lifecycle (Cleanup Dead)
    let rCount = 0;
    let bCount = 0;
    
    for(let i=0; i<len; i++) {
        const eid = ents[i];
        if (UnitComponent.health[eid] <= 0) {
            if (UnitComponent.team[eid] === TEAM_ID_RED) this.stats.redCasualties++;
            else this.stats.blueCasualties++;
            
            // Explosion
            for(let j=0; j<5; j++) {
                this.spawnParticle(
                    Position.x[eid], Position.y[eid],
                    UnitComponent.team[eid] === TEAM_ID_RED ? COLOR_RED : COLOR_BLUE,
                    Math.random() * 100 + 50,
                    Math.random() * 3 + 2,
                    0.6
                );
            }
            removeEntity(this.world, eid);
        } else {
            if (UnitComponent.team[eid] === TEAM_ID_RED) rCount++;
            else bCount++;
        }
    }
    
    this.stats.redCount = rCount;
    this.stats.blueCount = bCount;

    // 5. Particles
    let pWrite = 0;
    for(let i=0; i<this.particles.length; i++) {
        const p = this.particles[i];
        p.life -= dt;
        if(p.life > 0) {
            p.position.x += p.velocity.x * dt;
            p.position.y += p.velocity.y * dt;
            if(i !== pWrite) this.particles[pWrite] = p;
            pWrite++;
        } else {
            this.particlePool.push(p);
        }
    }
    this.particles.length = pWrite;
  }

  // Snapshot for UI/AI
  getSnapshot(): UnitView[] {
      if (!this.world) return [];
      const ents = unitQuery(this.world);
      const views: UnitView[] = [];
      const len = ents.length;
      
      const typeMap: Record<number, UnitType> = {
          [TYPE_ID_SOLDIER]: UnitType.SOLDIER,
          [TYPE_ID_TANK]: UnitType.TANK,
          [TYPE_ID_ARCHER]: UnitType.ARCHER
      };
      
      const stateMap: Record<number, string> = {
          [STATE_IDLE]: 'IDLE',
          [STATE_MOVING]: 'MOVING',
          [STATE_ATTACKING]: 'ATTACKING'
      };

      for(let i=0; i<len; i++) {
          const eid = ents[i];
          views.push({
              id: eid,
              team: UnitComponent.team[eid] === TEAM_ID_RED ? TEAM_RED : TEAM_BLUE,
              type: typeMap[UnitComponent.type[eid]] || UnitType.SOLDIER,
              x: Position.x[eid],
              y: Position.y[eid],
              health: UnitComponent.health[eid],
              maxHealth: UnitComponent.maxHealth[eid],
              radius: UnitComponent.radius[eid],
              state: stateMap[UnitComponent.state[eid]] || 'IDLE'
          });
      }
      return views;
  }
}
