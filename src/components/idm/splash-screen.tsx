'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('exit'), 3200);
    const t3 = setTimeout(() => onFinish(), 3900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onFinish]);

  return (
    <AnimatePresence>
      {phase !== 'exit' || true ? (
        <motion.div
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'exit' ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: phase === 'exit' ? 0.7 : 0.6, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
        >
          {/* Gradient Background — warm obsidian matching app background #0c0a06 */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0c0a06] via-[#120e08] to-[#0c0a06]" />

          {/* Vignette */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)'
          }} />

          {/* Ambient glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              background: [
                'radial-gradient(ellipse at 30% 50%, rgba(249,203,37,0.08) 0%, transparent 60%)',
                'radial-gradient(ellipse at 70% 50%, rgba(239,249,35,0.08) 0%, transparent 60%)',
                'radial-gradient(ellipse at 30% 50%, rgba(249,203,37,0.08) 0%, transparent 60%)',
              ],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Main Content */}
          <div className="relative z-10 flex flex-col items-center">

            {/* Main Logo */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
              className="mb-8"
            >
              <div className="relative">
                {/* Outer glow ring */}
                <motion.div
                  className="absolute -inset-4 rounded-3xl"
                  animate={{
                    boxShadow: [
                      '0 0 25px rgba(184,134,11,0.25), 0 0 60px rgba(184,134,11,0.08)',
                      '0 0 40px rgba(184,134,11,0.4), 0 0 80px rgba(245,158,11,0.15)',
                      '0 0 25px rgba(184,134,11,0.25), 0 0 60px rgba(184,134,11,0.08)',
                    ],
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/30 backdrop-blur-sm">
                  <img src="/logo.webp" alt="IDM League" className="w-full h-full object-cover" />
                </div>
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="text-center"
            >
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
                <span className="text-gradient-fury">IDM</span>{' '}
                <span className="text-white">League</span>
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ duration: 0.5, delay: 1.2 }}
                className="text-xs sm:text-sm text-white/50 mt-2 tracking-widest uppercase font-light"
              >
                Idol Meta · Fan Made Edition
              </motion.p>
            </motion.div>

            {/* Loading bar */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.4, delay: 1.4 }}
              className="mt-8 w-48 sm:w-64"
            >
              <div className="h-0.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2.2, delay: 1.4, ease: 'easeInOut' }}
                />
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                transition={{ delay: 1.6 }}
                className="text-[10px] text-white/40 text-center mt-2 tracking-wider"
              >
                MEMASUKI ARENA
              </motion.p>
            </motion.div>
          </div>

          {/* BORNEO Pride Footer */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2, duration: 0.6, ease: 'easeOut' }}
            className="absolute bottom-0 inset-x-0"
          >
            {/* Gold top border line */}
            <div className="h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
            <div className="py-4 flex flex-col items-center gap-1.5">
              <span className="text-[10px] sm:text-xs tracking-widest uppercase font-semibold bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
                BORNEO Pride
              </span>
              <div className="flex items-center gap-2">
                <div className="w-4 h-px bg-gradient-to-r from-transparent to-amber-500/50" />
                <div className="w-1.5 h-1.5 rotate-45 bg-amber-500/70" />
                <div className="w-4 h-px bg-gradient-to-l from-transparent to-amber-500/50" />
              </div>
              <span className="text-[8px] text-amber-500/30 tracking-widest uppercase">Idol Meta · Fan Made Edition</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
