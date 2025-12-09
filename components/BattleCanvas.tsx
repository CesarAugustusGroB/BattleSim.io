import React, { useRef, useEffect } from 'react';
import { Unit, Particle } from '../types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  COLOR_RED, 
  COLOR_BLUE, 
  COLOR_GROUND,
  TEAM_RED
} from '../constants';

interface BattleCanvasProps {
  units: Unit[];
  particles: Particle[];
  onCanvasClick: (x: number, y: number, isRightClick: boolean) => void;
}

const BattleCanvas: React.FC<BattleCanvasProps> = ({ units, particles, onCanvasClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background with a subtle gradient
    const gradient = ctx.createRadialGradient(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0,
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH
    );
    gradient.addColorStop(0, '#262626');
    gradient.addColorStop(1, '#171717');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Grid (Decoration)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=0; x<=CANVAS_WIDTH; x+=100) {
        ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT);
    }
    for(let y=0; y<=CANVAS_HEIGHT; y+=100) {
        ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y);
    }
    ctx.stroke();

    const now = Date.now();

    // Draw Units
    units.forEach(unit => {
      // Shadow
      ctx.beginPath();
      ctx.arc(unit.position.x + 2, unit.position.y + 2, unit.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();

      // Main Body
      ctx.beginPath();
      ctx.arc(unit.position.x, unit.position.y, unit.radius, 0, Math.PI * 2);
      
      // Hit Flash Effect
      if (now - unit.lastHitTime < 100) {
          ctx.fillStyle = '#ffffff';
      } else {
          ctx.fillStyle = unit.team === TEAM_RED ? COLOR_RED : COLOR_BLUE;
      }
      ctx.fill();
      
      // Outline
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Health Bar (Only if damaged)
      if (unit.health < unit.maxHealth) {
          const hpPct = Math.max(0, unit.health / unit.maxHealth);
          const barWidth = unit.radius * 2.5;
          const barHeight = 4;
          const barX = unit.position.x - barWidth / 2;
          const barY = unit.position.y - unit.radius - 8;

          // Background
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(barX, barY, barWidth, barHeight);

          // Fill
          ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : (hpPct > 0.25 ? '#eab308' : '#ef4444');
          ctx.fillRect(barX, barY, barWidth * hpPct, barHeight);
      }
    });

    // Draw Particles/Projectiles
    particles.forEach(p => {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        
        ctx.beginPath();
        ctx.arc(p.position.x, p.position.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = 1.0;
    });

  }, [units, particles]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Scale for canvas resolution vs display size
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    onCanvasClick(x * scaleX, y * scaleY, e.button === 2);
  };

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border border-neutral-800 bg-neutral-900">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full object-contain cursor-crosshair block"
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => e.preventDefault()}
      />
      
      {/* Overlay Helper */}
      <div className="absolute top-4 left-4 pointer-events-none bg-black/50 backdrop-blur px-3 py-1 rounded text-white text-xs font-mono border border-white/10">
         Units: {units.length}
      </div>
    </div>
  );
};

export default BattleCanvas;