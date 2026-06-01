import { useEffect, useRef } from "react";

type Variant = "light" | "dark";

const LINK_DIST = 130;
const MAX_PARTICLES = 52;

type Particle = { x: number; y: number; vx: number; vy: number; r: number };

export function ParticleNetwork({ variant = "light" }: { variant?: Variant }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let frame = 0;
    const particles: Particle[] = [];

    const init = () => {
      const parent = canvas.parentElement;
      w = parent?.clientWidth ?? window.innerWidth;
      h = parent?.clientHeight ?? window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = reduced ? 0 : Math.min(MAX_PARTICLES, Math.max(18, Math.floor((w * h) / 20000)));
      particles.length = 0;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 1.8 + 1.4,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      if (!particles.length) return;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x <= 0 || p.x >= w) p.vx *= -1;
        if (p.y <= 0 || p.y >= h) p.vy *= -1;
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]!;
          const b = particles[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist >= LINK_DIST) continue;
          const t = 1 - dist / LINK_DIST;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle =
            variant === "dark"
              ? `rgba(255,255,255,${0.06 + t * 0.24})`
              : `rgba(91,33,182,${0.05 + t * 0.16})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      ctx.fillStyle = variant === "dark" ? "rgba(255,255,255,0.5)" : "rgba(91,33,182,0.32)";
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      draw();
      frame = requestAnimationFrame(loop);
    };

    init();
    if (!reduced) frame = requestAnimationFrame(loop);

    const ro = new ResizeObserver(init);
    const parent = canvas.parentElement;
    if (parent) ro.observe(parent);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      className={`particle-network particle-network--${variant}`}
      aria-hidden
    />
  );
}
