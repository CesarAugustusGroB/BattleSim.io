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

    // Clear
    ctx.fillStyle = COLOR_GROUND;
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

    // Draw Units
    units.forEach(unit => {
      // Draw Body
      ctx.beginPath();
      ctx.arc(unit.position.x, unit.position.y, unit.radius, 0, Math.PI * 2);
      ctx.fillStyle = unit.team === TEAM_RED ? COLOR_RED : COLOR_BLUE;
      ctx.fill();
      
      // Draw Glow/Selection if needed (optional)
      ctx.strokeStyle = '#00000044';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw Health Bar
      const hpPct = unit.health / unit.maxHealth;
      if (hpPct < 1) {
          ctx.fillStyle = '#450a0a';
          ctx.fillRect(unit.position.x - unit.radius, unit.position.y - unit.radius - 8, unit.radius * 2, 4);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(unit.position.x - unit.radius, unit.position.y - unit.radius - 8, unit.radius * 2 * hpPct, 4);
      }
    });

    // Draw Particles/Projectiles
    particles.forEach(p => {
        ctx.globalAlpha = p.life / p.maxLife;
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
    <div className="relative rounded-xl overflow-hidden shadow-2xl border border-neutral-800">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full object-contain cursor-crosshair"
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => e.preventDefault()}
      />
      
      {/* Overlay Helper */}
      <div className="absolute top-4 left-4 pointer-events-none bg-black/50 backdrop-blur px-3 py-1 rounded text-white text-xs">
         Units: {units.length}
      </div>
    </div>
  );
};

export default BattleCanvas;