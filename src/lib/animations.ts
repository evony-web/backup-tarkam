import type { Variants } from 'framer-motion';

/**
 * Shared animation variants used across IDM League components.
 * Optimized for mobile performance — shorter durations, smaller distances.
 */

/** Stagger container — children animate in sequence */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

/** Stagger container with slightly faster stagger for dense lists */
export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

/** Stagger container with slower stagger for match views */
export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

/** Fade-up item — slides up and fades in */
export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

/** Fade-up item with longer duration for match views */
export const fadeUpItemSlow: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

/** Fade-up item with subtle y offset (dashboard style) */
export const fadeUpItemSubtle: Variants = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

/**
 * Reduced-motion variants — for mobile/mid-range phones and users who prefer reduced motion.
 * No stagger, no y-offset, just simple opacity fade.
 */
export const staggerContainerReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0 } },
};

export const fadeUpItemReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

/**
 * Convenience aliases matching the naming convention used across the project.
 * These keep backward compatibility when refactoring.
 */
export const container = staggerContainer;
export const item = fadeUpItem;
