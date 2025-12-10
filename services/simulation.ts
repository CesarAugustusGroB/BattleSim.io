
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

// --- ECS Setup ---
import {
    createWorld,
    addEntity,
    removeEntity,
    registerComponent,
    registerQuery,
    Types
} from './ecs';

const f32 = Types.f32;
const ui8 = Types.ui8;
const eid = Types.eid;

// Dummy factory no longer needed as we guarantee local ECS
const safeDefine = (schema: any) => { };
const safeQuery = (comps: any[]) => { };

// Performance Tuning
const GRID_SIZE = 80;
const GRID_COLS = Math.ceil(CANVAS_WIDTH / GRID_SIZE);
const GRID_ROWS = Math.ceil(CANVAS_HEIGHT / GRID_SIZE);
const GRID_CELLS = GRID_COLS * GRID_ROWS;

export class SimulationEngine {
    world: any;

    // Instance-bound Components
    Position: any;
    Velocity: any;
    Force: any;
    UnitComponent: any;

    // Instance-bound Queries
    unitQuery: any;

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

        // Define Components per instance
        const Vector2 = { x: f32, y: f32 };
        this.Position = registerComponent(this.world, Vector2);
        this.Velocity = registerComponent(this.world, Vector2);
        this.Force = registerComponent(this.world, Vector2);

        this.UnitComponent = registerComponent(this.world, {
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

        // Define Queries
        // In 0.4.0, registerQuery(world, components) returns the query handle/array
        this.unitQuery = registerQuery(this.world, [this.Position, this.Velocity, this.UnitComponent]);

        // Pre-allocate grid cells
        for (let i = 0; i < GRID_CELLS; i++) {
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
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
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
                const rLen = Math.sqrt(rx * rx + ry * ry);
                this.redFlowField[idx] = rx / rLen;
                this.redFlowField[idx + 1] = ry / rLen;

                // BLUE TEAM (Go Left)
                let bx = -1.0;
                let by = dy * 0.002;
                if (py < 100) by += 0.5;
                if (py > CANVAS_HEIGHT - 100) by -= 0.5;
                const bLen = Math.sqrt(bx * bx + by * by);
                this.blueFlowField[idx] = bx / bLen;
                this.blueFlowField[idx + 1] = by / bLen;
            }
        }
    }

    setAllyOverlapTolerance(value: number) {
        this.allyOverlapTolerance = Math.max(0, Math.min(0.9, value));
    }

    reset() {
        if (!this.world) return;
        // Query usage check
        // In 0.4.0, queries might be arrays directly updated by system, or need specific access
        // Assuming registerQuery returns the query array/structure
        const ents = this.unitQuery; // Direct access if it returns array?
        // Safety check: is it an array?
        const length = ents.length || 0; // If it's not array, this might fail unless we check API more

        // For now, iterate backwards if it's dynamic
        for (let i = length - 1; i >= 0; i--) {
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

        for (let i = 0; i < GRID_CELLS; i++) {
            this.grid[i].length = 0;
        }
    }

    public spawnUnit(x: number, y: number, team: number, type: UnitType) {
        if (!this.world) return;

        console.log(`[Sim] Spawning unit at ${x},${y} Team: ${team}`);

        const eid = addEntity(this.world);
        if (eid === undefined) {
            console.error("[Sim] Failed to add entity (World full?)");
            return;
        }

        const stats = UNIT_STATS[type];

        this.Position.x[eid] = x;
        this.Position.y[eid] = y;
        this.Velocity.x[eid] = 0;
        this.Velocity.y[eid] = 0;
        this.Force.x[eid] = 0;
        this.Force.y[eid] = 0;

        this.UnitComponent.team[eid] = team;
        this.UnitComponent.type[eid] = type;
        this.UnitComponent.health[eid] = stats.maxHealth;
        this.UnitComponent.maxHealth[eid] = stats.maxHealth;
        this.UnitComponent.radius[eid] = stats.radius;
        this.UnitComponent.range[eid] = stats.range;
        this.UnitComponent.damage[eid] = stats.damage;
        this.UnitComponent.attackSpeed[eid] = stats.attackSpeed;
        this.UnitComponent.speed[eid] = stats.speed;

        this.UnitComponent.state[eid] = STATE_IDLE;
        this.UnitComponent.targetId[eid] = 0;
        this.UnitComponent.lastAttackTime[eid] = 0;
        this.UnitComponent.lastHitTime[eid] = 0;
        this.UnitComponent.nextTargetUpdate[eid] = Date.now() + Math.random() * 500;

        if (team === TEAM_ID_RED) this.stats.redCount++;
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
            const cx = (this.Position.x[eid] / GRID_SIZE) | 0;
            const cy = (this.Position.y[eid] / GRID_SIZE) | 0;

            if (cx >= 0 && cx < GRID_COLS && cy >= 0 && cy < GRID_ROWS) {
                this.grid[cx + cy * GRID_COLS].push(eid);
            }
        }
    }

    private findTarget(eid: number): number {
        const myTeam = this.UnitComponent.team[eid];
        const px = this.Position.x[eid];
        const py = this.Position.y[eid];

        // Quick check current target
        const currentTgt = this.UnitComponent.targetId[eid];
        if (currentTgt > 0) {
            if (this.UnitComponent.health[currentTgt] > 0) {
                const dx = this.Position.x[currentTgt] - px;
                const dy = this.Position.y[currentTgt] - py;
                if (dx * dx + dy * dy <= (VISION_RANGE * 1.2) ** 2) {
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
                    for (let i = 0; i < cellLen; i++) {
                        const other = cell[i];
                        if (this.UnitComponent.team[other] !== myTeam && this.UnitComponent.health[other] > 0) {
                            const dx = this.Position.x[other] - px;
                            const dy = this.Position.y[other] - py;
                            const dSq = dx * dx + dy * dy;
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
            const cx = (this.Position.x[eid] / GRID_SIZE) | 0;
            const cy = (this.Position.y[eid] / GRID_SIZE) | 0;

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

                            const dx = this.Position.x[eid] - this.Position.x[other];
                            const dy = this.Position.y[eid] - this.Position.y[other];
                            const distSq = dx * dx + dy * dy;

                            let minDist = this.UnitComponent.radius[eid] + this.UnitComponent.radius[other];

                            if (this.UnitComponent.team[eid] === this.UnitComponent.team[other]) {
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

                                this.Position.x[eid] += nx * moveAmt;
                                this.Position.y[eid] += ny * moveAmt;
                                this.Position.x[other] -= nx * moveAmt;
                                this.Position.y[other] -= ny * moveAmt;
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

        // In 0.4.0, direct access assuming array
        const ents = this.unitQuery;
        const len = ents.length;

        // 1. AI & Steering
        for (let i = 0; i < len; i++) {
            const eid = ents[i];

            // --- TARGETING ---
            if (now > this.UnitComponent.nextTargetUpdate[eid]) {
                this.UnitComponent.targetId[eid] = this.findTarget(eid);
                this.UnitComponent.nextTargetUpdate[eid] = now + 200 + Math.random() * 200;
            }

            let seekX = 0, seekY = 0;
            const target = this.UnitComponent.targetId[eid];

            // --- COMBAT / SEEK ---
            let hasTarget = false;
            if (target > 0 && this.UnitComponent.health[target] > 0) {
                hasTarget = true;
                const dx = this.Position.x[target] - this.Position.x[eid];
                const dy = this.Position.y[target] - this.Position.y[eid];
                const dist = Math.sqrt(dx * dx + dy * dy);
                const range = this.UnitComponent.range[eid] + this.UnitComponent.radius[eid] + this.UnitComponent.radius[target];

                if (dist <= range) {
                    this.UnitComponent.state[eid] = STATE_ATTACKING;
                    this.Velocity.x[eid] *= 0.8;
                    this.Velocity.y[eid] *= 0.8;

                    if (now - this.UnitComponent.lastAttackTime[eid] > this.UnitComponent.attackSpeed[eid]) {
                        this.UnitComponent.health[target] -= this.UnitComponent.damage[eid];
                        this.UnitComponent.lastHitTime[target] = now;
                        this.UnitComponent.lastAttackTime[eid] = now;
                        // Visual
                        this.spawnParticle(
                            this.Position.x[eid] + (dx / dist) * this.UnitComponent.radius[eid],
                            this.Position.y[eid] + (dy / dist) * this.UnitComponent.radius[eid],
                            '#ffffff', 100, 2, 0.2
                        );
                    }
                } else {
                    this.UnitComponent.state[eid] = STATE_MOVING;
                    const speed = this.UnitComponent.speed[eid] * 60;
                    seekX = (dx / dist) * speed;
                    seekY = (dy / dist) * speed;
                }
            } else {
                this.UnitComponent.targetId[eid] = 0; // Clear dead target
            }

            // --- MARCHING (Flow Field) ---
            if (!hasTarget) {
                this.UnitComponent.state[eid] = STATE_MOVING;
                const fx = (this.Position.x[eid] / 40) | 0;
                const fy = (this.Position.y[eid] / 40) | 0;

                if (fx >= 0 && fx < Math.ceil(CANVAS_WIDTH / 40) && fy >= 0 && fy < Math.ceil(CANVAS_HEIGHT / 40)) {
                    const idx = (fx + fy * Math.ceil(CANVAS_WIDTH / 40)) * 2;
                    const field = this.UnitComponent.team[eid] === TEAM_ID_RED ? this.redFlowField : this.blueFlowField;
                    const speed = this.UnitComponent.speed[eid] * 50;
                    seekX = field[idx] * speed;
                    seekY = field[idx + 1] * speed;
                } else {
                    // Center bias
                    seekX = (CANVAS_WIDTH / 2 - this.Position.x[eid]) * 0.1;
                    seekY = (CANVAS_HEIGHT / 2 - this.Position.y[eid]) * 0.1;
                }
            }

            // --- FLOCKING ---
            if (this.UnitComponent.state[eid] === STATE_MOVING) {
                let n = 0, ax = 0, ay = 0, cx = 0, cy = 0;
                const px = this.Position.x[eid];
                const py = this.Position.y[eid];
                const cxIdx = (px / GRID_SIZE) | 0;
                const cyIdx = (py / GRID_SIZE) | 0;
                const rangeSq = (this.UnitComponent.radius[eid] * 6) ** 2;

                for (let yOff = -1; yOff <= 1; yOff++) {
                    for (let xOff = -1; xOff <= 1; xOff++) {
                        const nx = cxIdx + xOff;
                        const ny = cyIdx + yOff;
                        if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS) {
                            const cell = this.grid[nx + ny * GRID_COLS];
                            const cellLen = cell.length;
                            for (let j = 0; j < cellLen; j++) {
                                const other = cell[j];
                                if (other === eid) continue;
                                if (this.UnitComponent.team[other] === this.UnitComponent.team[eid]) {
                                    const dx = this.Position.x[other] - px;
                                    const dy = this.Position.y[other] - py;
                                    if (dx * dx + dy * dy < rangeSq) {
                                        ax += this.Velocity.x[other];
                                        ay += this.Velocity.y[other];
                                        cx += this.Position.x[other];
                                        cy += this.Position.y[other];
                                        n++;
                                    }
                                }
                            }
                        }
                    }
                }

                if (n > 0) {
                    const speed = this.UnitComponent.speed[eid];
                    ax /= n; ay /= n;
                    const aMag = Math.sqrt(ax * ax + ay * ay);
                    if (aMag > 0) {
                        seekX += (ax / aMag) * (speed * 20.0);
                        seekY += (ay / aMag) * (speed * 20.0);
                    }
                    cx /= n; cy /= n;
                    const dx = cx - px;
                    const dy = cy - py;
                    const cMag = Math.sqrt(dx * dx + dy * dy);
                    if (cMag > 0) {
                        seekX += (dx / cMag) * (speed * 10.0);
                        seekY += (dy / cMag) * (speed * 10.0);
                    }
                }
            }

            // --- BOUNDS ---
            let bx = 0, by = 0;
            const m = 40;
            if (this.Position.x[eid] < m) bx = 150;
            else if (this.Position.x[eid] > CANVAS_WIDTH - m) bx = -150;
            if (this.Position.y[eid] < m) by = 150;
            else if (this.Position.y[eid] > CANVAS_HEIGHT - m) by = -150;

            // --- INTEGRATION ---
            if (this.UnitComponent.state[eid] === STATE_MOVING) {
                this.Force.x[eid] = seekX + bx;
                this.Force.y[eid] = seekY + by;

                this.Velocity.x[eid] += this.Force.x[eid] * dt;
                this.Velocity.y[eid] += this.Force.y[eid] * dt;

                const maxSpeed = this.UnitComponent.speed[eid] * 60;
                const vSq = this.Velocity.x[eid] * this.Velocity.x[eid] + this.Velocity.y[eid] * this.Velocity.y[eid];
                if (vSq > maxSpeed * maxSpeed) {
                    const vm = Math.sqrt(vSq);
                    this.Velocity.x[eid] = (this.Velocity.x[eid] / vm) * maxSpeed;
                    this.Velocity.y[eid] = (this.Velocity.y[eid] / vm) * maxSpeed;
                }
            }

            this.Position.x[eid] += this.Velocity.x[eid] * dt;
            this.Position.y[eid] += this.Velocity.y[eid] * dt;

            // Hard Clamp
            if (this.Position.x[eid] < 5) this.Position.x[eid] = 5;
            if (this.Position.x[eid] > CANVAS_WIDTH - 5) this.Position.x[eid] = CANVAS_WIDTH - 5;
            if (this.Position.y[eid] < 5) this.Position.y[eid] = 5;
            if (this.Position.y[eid] > CANVAS_HEIGHT - 5) this.Position.y[eid] = CANVAS_HEIGHT - 5;
        }

        // 2. Spatial Update
        this.updateGrid(ents);

        // 3. Collisions
        const SOLVER_ITERATIONS = 2;
        for (let k = 0; k < SOLVER_ITERATIONS; k++) {
            this.resolveCollisions(ents);
        }

        // 4. Lifecycle (Cleanup Dead)
        let rCount = 0;
        let bCount = 0;

        for (let i = 0; i < len; i++) {
            const eid = ents[i];
            if (this.UnitComponent.health[eid] <= 0) {
                if (this.UnitComponent.team[eid] === TEAM_ID_RED) this.stats.redCasualties++;
                else this.stats.blueCasualties++;

                // Explosion
                for (let j = 0; j < 5; j++) {
                    this.spawnParticle(
                        this.Position.x[eid], this.Position.y[eid],
                        this.UnitComponent.team[eid] === TEAM_ID_RED ? COLOR_RED : COLOR_BLUE,
                        Math.random() * 100 + 50,
                        Math.random() * 3 + 2,
                        0.6
                    );
                }
                removeEntity(this.world, eid);
            } else {
                if (this.UnitComponent.team[eid] === TEAM_ID_RED) rCount++;
                else bCount++;
            }
        }

        this.stats.redCount = rCount;
        this.stats.blueCount = bCount;

        // 5. Particles
        let pWrite = 0;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life > 0) {
                p.position.x += p.velocity.x * dt;
                p.position.y += p.velocity.y * dt;
                if (i !== pWrite) this.particles[pWrite] = p;
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
        const ents = this.unitQuery;
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

        for (let i = 0; i < len; i++) {
            const eid = ents[i];
            views.push({
                id: eid,
                team: this.UnitComponent.team[eid] === TEAM_ID_RED ? TEAM_RED : TEAM_BLUE,
                type: typeMap[this.UnitComponent.type[eid]] || UnitType.SOLDIER,
                x: this.Position.x[eid],
                y: this.Position.y[eid],
                health: this.UnitComponent.health[eid],
                maxHealth: this.UnitComponent.maxHealth[eid],
                radius: this.UnitComponent.radius[eid],
                state: stateMap[this.UnitComponent.state[eid]] || 'IDLE'
            });
        }
        return views;
    }
}
