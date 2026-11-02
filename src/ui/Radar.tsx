import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { BOMBSITE_ZONES, DUST_ALLEY_BOXES, MAP_HALF_SIZE } from '../world/DustAlleyMap';

export const Radar: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const radar = useGameStore((s) => s.radar);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const half = size * 0.5;
    const scale = 2.15; // pixels per meter for 62.4m x 62.4m tactical arena

    ctx.clearRect(0, 0, size, size);

    // Circular radar background
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(12, 15, 20, 0.9)';
    ctx.fillRect(0, 0, size, size);

    // Rotate map relative to local player's yaw so UP is always player's forward view
    ctx.translate(half, half);
    ctx.rotate(radar.localYaw);
    ctx.translate(-radar.localX * scale, -radar.localZ * scale);

    // Draw floor concrete area
    ctx.fillStyle = 'rgba(180, 168, 150, 0.14)';
    ctx.fillRect(
      -MAP_HALF_SIZE * scale,
      -MAP_HALF_SIZE * scale,
      MAP_HALF_SIZE * 2 * scale,
      MAP_HALF_SIZE * 2 * scale
    );

    // Draw Bombsite A and B red tactical zones matching the blueprint
    (['A', 'B'] as const).forEach((site) => {
      const z = BOMBSITE_ZONES[site];
      ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 1.25;
      ctx.fillRect(
        z.minX * scale,
        z.minZ * scale,
        (z.maxX - z.minX) * scale,
        (z.maxZ - z.minZ) * scale
      );
      ctx.strokeRect(
        z.minX * scale,
        z.minZ * scale,
        (z.maxX - z.minX) * scale,
        (z.maxZ - z.minZ) * scale
      );
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        site,
        ((z.minX + z.maxX) * 0.5) * scale,
        ((z.minZ + z.maxZ) * 0.5) * scale
      );
    });

    // Draw Dust Alley walls & crates
    for (let i = 0; i < DUST_ALLEY_BOXES.length; i++) {
      const b = DUST_ALLEY_BOXES[i];
      if (b.noCollide || b.isRamp) continue;
      ctx.fillStyle =
        b.material === 'wood_crate'
          ? 'rgba(180, 130, 75, 0.55)'
          : 'rgba(30, 36, 44, 0.92)';
      ctx.fillRect(
        (b.x - b.w * 0.5) * scale,
        (b.z - b.d * 0.5) * scale,
        b.w * scale,
        b.d * scale
      );
    }

    // Draw C4 Bomb position if visible
    if (radar.bombPosition) {
      const bx = radar.bombPosition[0] * scale;
      const bz = radar.bombPosition[2] * scale;
      ctx.fillStyle = radar.bombState === 'planted' ? '#ef4444' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(bx, bz, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Ally and Spotted Enemy Dots
    for (const dot of radar.dots) {
      if (dot.isLocal) continue;
      const dx = dot.x * scale;
      const dz = dot.z * scale;
      ctx.fillStyle = dot.team === 'CT' ? '#38bdf8' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(dx, dz, 3.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Draw Local Player FOV Cone & Center Dot (fixed pointing UP at center)
    ctx.save();
    ctx.translate(half, half);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 38, -Math.PI * 0.72, -Math.PI * 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Outer thin ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(half, half, half - 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }, [radar]);

  return (
    <div className="relative w-36 h-36 pointer-events-none">
      <canvas
        ref={canvasRef}
        width={144}
        height={144}
        className="w-36 h-36 rounded-full"
      />
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-widest text-zinc-400">
        N
      </div>
    </div>
  );
};
