
import React, { useRef, useEffect } from 'react';
import { Application, Container, Sprite, Texture } from 'pixi.js';
import { SimulationEngine, unitQuery, Position, UnitComponent } from '../services/simulation';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  COLOR_RED, 
  COLOR_BLUE,
  TEAM_ID_RED
} from '../constants';

interface BattleCanvasProps {
  engine: SimulationEngine;
  onCanvasClick: (x: number, y: number, isRightClick: boolean) => void;
}

const BattleCanvas: React.FC<BattleCanvasProps> = ({ engine, onCanvasClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const rafRef = useRef<number>(0);
  
  // Cache using Integer EID
  const spritesRef = useRef<Map<number, Container>>(new Map());
  const particleSpritesRef = useRef<Map<string, Sprite>>(new Map());

  const createTexture = (drawFn: (ctx: CanvasRenderingContext2D) => void, width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) drawFn(ctx);
      return Texture.from(canvas);
  };

  useEffect(() => {
    let isMounted = true;
    spritesRef.current.clear();
    particleSpritesRef.current.clear();

    const initPixi = async () => {
        const app = new Application();
        // Pixi 8
        await app.init({ 
            width: CANVAS_WIDTH, 
            height: CANVAS_HEIGHT, 
            background: '#171717',
            antialias: true,
            autoStart: false
        });

        if (!isMounted) {
            app.destroy({ removeView: true });
            return;
        }
        
        if (containerRef.current) {
            containerRef.current.appendChild(app.canvas);
        }
        appRef.current = app;

        // Textures
        const unitTexture = createTexture((ctx) => {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(50, 50, 50, 0, Math.PI * 2);
            ctx.fill();
        }, 100, 100);
        
        const shadowTexture = createTexture((ctx) => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.arc(50, 50, 50, 0, Math.PI * 2);
            ctx.fill();
        }, 100, 100);

        const squareTexture = createTexture((ctx) => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 10, 10);
        }, 10, 10);

        const shadowLayer = new Container();
        const unitLayer = new Container();
        const effectLayer = new Container();
        
        if (app.stage) {
            app.stage.addChild(shadowLayer, unitLayer, effectLayer);
        }

        const renderLoop = () => {
            if (!isMounted || !appRef.current || !appRef.current.renderer) return;
            if (!engine.world) return;

            const now = Date.now();
            const ents = unitQuery(engine.world);
            const particles = engine.particles;

            const activeEids = new Set<number>();

            // --- RENDER UNITS ---
            for(let i=0; i<ents.length; i++) {
                const eid = ents[i];
                activeEids.add(eid);

                let container = spritesRef.current.get(eid);
                const radius = UnitComponent.radius[eid];
                const team = UnitComponent.team[eid];
                const health = UnitComponent.health[eid];
                const maxHealth = UnitComponent.maxHealth[eid];
                const lastHit = UnitComponent.lastHitTime[eid];
                const px = Position.x[eid];
                const py = Position.y[eid];

                if (!container) {
                    container = new Container();
                    
                    const shadow = new Sprite(shadowTexture);
                    shadow.anchor.set(0.5);
                    shadow.width = radius * 2.4;
                    shadow.height = radius * 2.4;
                    shadow.x = 2; 
                    shadow.y = 2;
                    shadowLayer.addChild(shadow);
                    
                    const body = new Sprite(unitTexture);
                    body.anchor.set(0.5);
                    body.width = radius * 2;
                    body.height = radius * 2;
                    body.tint = team === TEAM_ID_RED ? COLOR_RED : COLOR_BLUE;
                    
                    const hpBg = new Sprite(squareTexture);
                    hpBg.anchor.set(0.5, 1);
                    hpBg.tint = 0x000000;
                    hpBg.width = radius * 2.5;
                    hpBg.height = 4;
                    hpBg.y = -radius - 8;
                    hpBg.visible = false;

                    const hpFill = new Sprite(squareTexture);
                    hpFill.anchor.set(0, 1);
                    hpFill.height = 4;
                    hpFill.y = -radius - 8;
                    hpFill.x = -radius * 1.25;
                    hpFill.visible = false;
                    
                    container.addChild(body, hpBg, hpFill);
                    unitLayer.addChild(container);
                    
                    // @ts-ignore
                    container.bodySprite = body;
                    // @ts-ignore
                    container.hpBg = hpBg;
                    // @ts-ignore
                    container.hpFill = hpFill;
                    // @ts-ignore
                    container.shadowSprite = shadow;

                    spritesRef.current.set(eid, container);
                }

                container.x = px;
                container.y = py;
                // @ts-ignore
                if (container.shadowSprite) {
                    // @ts-ignore
                    container.shadowSprite.x = px + 2;
                    // @ts-ignore
                    container.shadowSprite.y = py + 2;
                }
                
                // Flash Effect
                // @ts-ignore
                const body = container.bodySprite as Sprite;
                if (now - lastHit < 100) {
                    body.tint = 0xffffff;
                } else {
                    body.tint = team === TEAM_ID_RED ? COLOR_RED : COLOR_BLUE;
                }

                // Health Bar
                // @ts-ignore
                const hpBg = container.hpBg as Sprite;
                // @ts-ignore
                const hpFill = container.hpFill as Sprite;

                if (health < maxHealth) {
                    hpBg.visible = true;
                    hpFill.visible = true;
                    const pct = Math.max(0, health / maxHealth);
                    hpFill.width = (radius * 2.5) * pct;
                    if (pct > 0.5) hpFill.tint = 0x22c55e;
                    else if (pct > 0.25) hpFill.tint = 0xeab308;
                    else hpFill.tint = 0xef4444;
                } else {
                    hpBg.visible = false;
                    hpFill.visible = false;
                }
            }

            // Cleanup
            for (const [eid, container] of spritesRef.current) {
                if (!activeEids.has(eid)) {
                    // @ts-ignore
                    if (container.shadowSprite) container.shadowSprite.destroy();
                    container.destroy({ children: true });
                    spritesRef.current.delete(eid);
                }
            }

            // --- PARTICLES ---
            const activePIds = new Set<string>();
            for(let i=0; i<particles.length; i++) {
                const p = particles[i];
                activePIds.add(p.id);
                
                let sprite = particleSpritesRef.current.get(p.id);
                if (!sprite) {
                    sprite = new Sprite(unitTexture);
                    sprite.anchor.set(0.5);
                    effectLayer.addChild(sprite);
                    particleSpritesRef.current.set(p.id, sprite);
                }
                sprite.x = p.position.x;
                sprite.y = p.position.y;
                sprite.width = p.size * 2;
                sprite.height = p.size * 2;
                sprite.tint = p.color;
                sprite.alpha = p.life / p.maxLife;
            }

            for (const [id, sprite] of particleSpritesRef.current) {
                if (!activePIds.has(id)) {
                    sprite.destroy();
                    particleSpritesRef.current.delete(id);
                }
            }

            app.render();
            rafRef.current = requestAnimationFrame(renderLoop);
        };

        renderLoop();
    };

    initPixi().catch(console.error);

    return () => {
      isMounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (appRef.current) {
        try {
            appRef.current.destroy({ removeView: true });
        } catch (e) {
            console.warn("Pixi destroy failed", e);
        }
        appRef.current = null;
      }
      spritesRef.current.clear();
      particleSpritesRef.current.clear();
    };
  }, [engine]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    onCanvasClick(x * scaleX, y * scaleY, e.button === 2);
  };

  return (
    <div 
        ref={containerRef} 
        className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-neutral-800 bg-neutral-900 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => e.preventDefault()}
    />
  );
};

export default React.memo(BattleCanvas);
