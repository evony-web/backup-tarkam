'use client'

import { useRef, useState, useCallback } from 'react'

/**
 * Hook for iOS-style 3D tilt effect on cards
 * Tracks mouse position relative to element and applies 3D rotation
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(options?: {
  maxTilt?: number
  scale?: number
  speed?: number
  glare?: boolean
}) {
  const {
    maxTilt = 8,
    scale = 1.02,
    speed = 400,
  } = options || {}

  const ref = useRef<T>(null)
  const [style, setStyle] = useState<React.CSSProperties>({
    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
    transition: `transform ${speed}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
  })

  const handleMouseMove = useCallback((e: React.MouseEvent<T>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = ((y - centerY) / centerY) * -maxTilt
    const rotateY = ((x - centerX) / centerX) * maxTilt

    setStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`,
      transition: `transform ${speed}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
    })
  }, [maxTilt, scale, speed])

  const handleMouseLeave = useCallback(() => {
    setStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: `transform ${speed}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
    })
  }, [speed])

  return {
    ref,
    style,
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
  }
}

/**
 * Framer-motion variants for iOS-style page transitions
 */
export const iosPageVariants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.99,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

/**
 * Framer-motion variants for staggered card animations
 */
export const iosCardVariants = {
  container: {
    animate: {
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.1,
      },
    },
  },
  item: {
    initial: { opacity: 0, y: 24, scale: 0.96 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      },
    },
  },
}

/**
 * Framer-motion variants for 3D card flip
 */
export const flipCardVariants = {
  front: {
    rotateY: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  back: {
    rotateY: 180,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

/**
 * Hover animation config for framer-motion
 */
export const iosHoverConfig = {
  whileHover: {
    y: -6,
    scale: 1.02,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  whileTap: {
    scale: 0.98,
    transition: {
      duration: 0.15,
    },
  },
}

/**
 * 3D hover animation for cards
 */
export const card3DHover = {
  whileHover: {
    y: -8,
    rotateX: 2,
    rotateY: -1,
    scale: 1.02,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

/**
 * Get division-themed gradient for cards
 */
export function getDivisionGradient(division: string): string {
  switch (division) {
    case 'MALE':
      return 'from-cyan-500/20 via-cyan-600/5 to-transparent'
    case 'FEMALE':
      return 'from-pink-300/20 via-pink-400/5 to-transparent'
    default:
      return 'from-emerald-500/20 via-emerald-600/5 to-transparent'
  }
}

/**
 * Get division-themed glow color
 */
export function getDivisionGlow(division: string): string {
  switch (division) {
    case 'MALE':
      return '0 0 20px rgba(46, 159, 255, 0.15)'
    case 'FEMALE':
      return '0 0 20px rgba(249, 168, 212, 0.15)'
    default:
      return '0 0 20px rgba(16, 185, 129, 0.15)'
  }
}

/**
 * Get division text color
 */
export function getDivisionTextColor(division: string): string {
  switch (division) {
    case 'MALE': return 'text-idm-male'
    case 'FEMALE': return 'text-idm-female'
    default: return 'text-emerald-400'
  }
}

/**
 * Get division badge classes
 */
export function getDivisionBadgeClasses(division: string): string {
  switch (division) {
    case 'MALE': return 'bg-idm-male/15 text-idm-male border-idm-male/25'
    case 'FEMALE': return 'bg-idm-female/15 text-idm-female border-idm-female/25'
    default: return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
  }
}

/**
 * Get division gradient for buttons
 */
export function getDivisionBtnGradient(division: string): string {
  switch (division) {
    case 'MALE': return 'from-cyan-500 to-cyan-600'
    case 'FEMALE': return 'from-pink-400 to-pink-500'
    default: return 'from-emerald-500 to-emerald-600'
  }
}

/**
 * Get division shadow for buttons
 */
export function getDivisionBtnShadow(division: string): string {
  switch (division) {
    case 'MALE': return '0 4px 14px rgba(46, 159, 255, 0.35)'
    case 'FEMALE': return '0 4px 14px rgba(249, 168, 212, 0.35)'
    default: return '0 4px 14px rgba(16, 185, 129, 0.35)'
  }
}
