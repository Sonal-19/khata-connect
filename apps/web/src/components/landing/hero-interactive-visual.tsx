import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface HeroInteractiveVisualProps {
  className?: string;
}

export function HeroInteractiveVisual({
  className,
}: HeroInteractiveVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 3D physics tilt on cursor movement
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth spring dampening for fluid 60fps tilt
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [3, -3]), {
    stiffness: 100,
    damping: 24,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-4, 4]), {
    stiffness: 100,
    damping: 24,
  });
  const translateImageX = useSpring(
    useTransform(mouseX, [-0.5, 0.5], [-16, 16]),
    { stiffness: 100, damping: 24 },
  );
  const translateImageY = useSpring(
    useTransform(mouseY, [-0.5, 0.5], [-10, 10]),
    { stiffness: 100, damping: 24 },
  );

  // Glare position following the cursor
  const glareX = useTransform(mouseX, [-0.5, 0.5], ["20%", "80%"]);
  const glareY = useTransform(mouseY, [-0.5, 0.5], ["20%", "80%"]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const { innerWidth, innerHeight } = window;
      mouseX.set(e.clientX / innerWidth - 0.5);
      mouseY.set(e.clientY / innerHeight - 0.5);
    };

    const handlePointerLeave = () => {
      mouseX.set(0);
      mouseY.set(0);
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [mouseX, mouseY]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none",
        className,
      )}
      aria-hidden="true"
    >
      {/* Ambient glowing radial orbs behind the 3D illustration */}
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 size-[36rem] rounded-full bg-primary/10 blur-[130px] dark:bg-primary/20" />
      <div className="absolute top-1/4 right-10 size-[26rem] rounded-full bg-gold/10 blur-[110px] dark:bg-gold/15" />

      {/* 3D Interactive Parallax Container */}
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformPerspective: 1200,
        }}
        className="relative size-full"
      >
        {/* Full-bleed 3D Background Canvas with edge dissolution */}
        <motion.div
          style={{
            x: translateImageX,
            y: translateImageY,
          }}
          className="relative size-full opacity-90 transition-opacity duration-700"
        >
          {/* Light Mode 3D Render - Flows on right, clean on left */}
          <img
            src="/hero-bg-light.jpg"
            alt=""
            loading="eager"
            className="size-full object-cover object-right sm:object-right md:object-center transition-opacity duration-500 dark:opacity-0"
          />

          {/* Dark Mode 3D Render - Flows on right, deep obsidian on left */}
          <img
            src="/hero-bg-dark.jpg"
            alt=""
            loading="eager"
            className="absolute inset-0 size-full object-cover object-right sm:object-right md:object-center opacity-0 transition-opacity duration-500 dark:opacity-100"
          />

          {/* Subtle cursor-following light sheen */}
          <motion.div
            style={{
              background: `radial-gradient(circle 360px at ${glareX} ${glareY}, rgba(255, 255, 255, 0.12), transparent 70%)`,
            }}
            className="absolute inset-0 mix-blend-overlay dark:hidden"
          />
        </motion.div>
      </motion.div>

      {/* Directional scrim overlays ensuring 100% crisp typography on all devices */}
      {/* Left-side reading gradient scrim on desktop */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-3/5 bg-linear-to-r from-background via-background/85 to-transparent sm:block" />
      {/* Mobile top/bottom reading gradient scrim */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-background/70 via-background/35 to-background/95 sm:hidden" />
      {/* Subtle top header blend */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-background to-transparent" />
      {/* Subtle bottom edge blend */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-background to-transparent" />
    </div>
  );
}
