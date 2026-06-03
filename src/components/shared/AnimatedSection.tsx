"use client";

/**
 * AnimatedSection & FadeIn — ElektrK
 *
 * AnimatedSection: scroll-triggered fade-up. Use for content sections that
 * enter the viewport as the user scrolls down.
 *
 * FadeIn: mount-triggered fade. Use for hero content that should animate
 * immediately on page load.
 *
 * Both respect `prefers-reduced-motion`: when the user has enabled
 * reduced-motion in their OS, animations are skipped entirely.
 */

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Override the default y-offset (pixels). Default 20. */
  y?: number;
  /** Render as a <section> element (AnimatedSection) or <div> (FadeIn). */
  as?: "section" | "div" | "article";
}

/** Scroll-triggered fade + slide-up. Safe to use in Server Component trees — it's
 *  a leaf client component that wraps whatever children are passed in. */
export function AnimatedSection({
  children,
  className,
  delay = 0,
  y = 20,
  as = "section",
}: AnimatedProps) {
  const shouldReduce = useReducedMotion();
  const MotionEl = as === "section"
    ? motion.section
    : as === "article"
      ? motion.article
      : motion.div;

  return (
    <MotionEl
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: shouldReduce ? 0 : 0.45, delay: shouldReduce ? 0 : delay, ease: "easeOut" }}
      className={cn(className)}
    >
      {children}
    </MotionEl>
  );
}

/** Mount-triggered fade + tiny slide-up. Ideal for hero/page-entry content. */
export function FadeIn({
  children,
  className,
  delay = 0,
  y = 8,
  as = "div",
}: AnimatedProps) {
  const shouldReduce = useReducedMotion();
  const MotionEl = as === "section"
    ? motion.section
    : as === "article"
      ? motion.article
      : motion.div;

  return (
    <MotionEl
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduce ? 0 : 0.35, delay: shouldReduce ? 0 : delay, ease: "easeOut" }}
      className={cn(className)}
    >
      {children}
    </MotionEl>
  );
}
