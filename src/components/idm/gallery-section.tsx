'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useInView, type Variants } from 'framer-motion';
import Image from 'next/image';
import {
  Camera, Trophy, Users, Sparkles, Film, Award,
  ChevronLeft, ChevronRight, X, ZoomIn, Calendar,
  ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cdnImage } from '@/lib/utils';

/* ========== Gallery Data ========== */
interface GalleryItem {
  id: string;
  src: string;
  alt: string;
  title: string;
  description: string;
  category: 'tournament' | 'community' | 'behind' | 'achievement';
  date: string;
  tag: string;
  tagColor: string;
  featured?: boolean;
}

const GALLERY_ITEMS: GalleryItem[] = [
  // ─── Turnamen ───
  {
    id: 'g1', src: cdnImage('/gallery/tournament-stage.png'), alt: 'Tournament Stage',
    title: 'IDM Tarkam Arena', description: 'Panggung utama IDM Tarkam dengan efek holografik dan pencahayaan neon yang memukau',
    category: 'tournament', date: '2025-01-15', tag: 'LIVE EVENT', tagColor: 'bg-red-500/90 text-white',
    featured: true,
  },
  {
    id: 'g2', src: cdnImage('/gallery/dance-battle.png'), alt: 'Dance Battle',
    title: 'Dance Battle Face-Off', description: 'Momen duel dance paling intens di atas panggung',
    category: 'tournament', date: '2025-01-22', tag: 'WEEK 3', tagColor: 'bg-cyan-500/90 text-white',
  },
  {
    id: 'g3', src: cdnImage('/gallery/bracket-display.png'), alt: 'Bracket Display',
    title: 'Bracket Elimination', description: 'Papan bracket turnamen — setiap match menentukan nasib',
    category: 'tournament', date: '2025-02-05', tag: 'BRACKET', tagColor: 'bg-amber-500/90 text-white',
  },
  {
    id: 'g4', src: cdnImage('/gallery/dance-performance.png'), alt: 'Dance Performance',
    title: 'Penampilan Lorent', description: 'Penampilan dance dengan laser show dan efek panggung yang memukau',
    category: 'tournament', date: '2025-02-12', tag: 'PERFORMANCE', tagColor: 'bg-purple-500/90 text-white',
  },
  // ─── Komunitas ───
  {
    id: 'g5', src: cdnImage('/gallery/community-meetup.png'), alt: 'Community Meetup',
    title: 'Community Game Night', description: 'Members komunitas berkumpul untuk game night bersama',
    category: 'community', date: '2025-01-10', tag: 'KOMUNITAS', tagColor: 'bg-green-500/90 text-white',
    featured: true,
  },
  {
    id: 'g6', src: cdnImage('/gallery/streamer-setup.png'), alt: 'Streamer Setup',
    title: 'Streamer Corner', description: 'Setup streaming para member — dari bedroom studio hingga professional booth',
    category: 'community', date: '2025-01-18', tag: 'CREATOR', tagColor: 'bg-pink-500/90 text-white',
  },
  {
    id: 'g7', src: cdnImage('/gallery/team-huddle.png'), alt: 'Team Huddle',
    title: 'Strategy Huddle', description: 'Team diskusi strategi sebelum match dimulai',
    category: 'community', date: '2025-02-01', tag: 'TEAM', tagColor: 'bg-cyan-500/90 text-white',
  },
  // ─── Behind The Scene ───
  {
    id: 'g8', src: cdnImage('/gallery/behind-scene.png'), alt: 'Behind The Scene',
    title: 'Production Control Room', description: 'Tim produksi bekerja di belakang layar — OBS hingga overlay graphics',
    category: 'behind', date: '2025-01-20', tag: 'BTS', tagColor: 'bg-orange-500/90 text-white',
  },
  {
    id: 'g9', src: cdnImage('/gallery/mvp-portrait.png'), alt: 'MVP Portrait Session',
    title: 'MVP Photo Session', description: 'Sesi foto eksklusif untuk MVP of the Week — dramatic portrait with neon rim light',
    category: 'behind', date: '2025-02-08', tag: 'EXCLUSIVE', tagColor: 'bg-amber-500/90 text-white',
  },
  // ─── Prestasi ───
  {
    id: 'g10', src: cdnImage('/gallery/champion-celebration.png'), alt: 'Champion Celebration',
    title: 'Juara Tarkam!', description: 'Momen kemenangan tim juara — confetti, trophy, dan air mata bahagia',
    category: 'achievement', date: '2025-02-15', tag: 'CHAMPION', tagColor: 'bg-yellow-500/90 text-white',
    featured: true,
  },
  {
    id: 'g11', src: cdnImage('/gallery/award-ceremony.png'), alt: 'Award Ceremony',
    title: 'Upacara Penghargaan', description: 'Penghargaan untuk pemain & tim terbaik sepanjang season',
    category: 'achievement', date: '2025-02-20', tag: 'AWARD', tagColor: 'bg-amber-500/90 text-white',
  },
  {
    id: 'g12', src: cdnImage('/gallery/prize-donation.png'), alt: 'Prize & Donation',
    title: 'Prize Pool Handover', description: 'Penyerahan prize pool dari donasi komunitas — bersama kita bisa!',
    category: 'achievement', date: '2025-02-22', tag: 'PRIZE', tagColor: 'bg-green-500/90 text-white',
  },
];

/* ========== Collection Data — Inspired by MonoGlass ========== */
interface Collection {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  coverSrc: string;
  category: 'tournament' | 'community' | 'behind' | 'achievement';
  count: number;
  accentColor: 'cyan' | 'purple' | 'gold'; // Division colors
}

const COLLECTIONS: Collection[] = [
  {
    id: 'col-tournament',
    title: 'Tournament Arena',
    subtitle: 'Panggung Kejayaan',
    description: 'A visual journey through intense dance battles, championship moments, and the electric atmosphere of IDM Tarkam tournaments.',
    coverSrc: cdnImage('/gallery/tournament-stage.png'),
    category: 'tournament',
    count: GALLERY_ITEMS.filter(g => g.category === 'tournament').length,
    accentColor: 'cyan', // Male division color
  },
  {
    id: 'col-community',
    title: 'Community Spirit',
    subtitle: 'Semangat Bersama',
    description: 'Capturing the warmth of our community — from casual meetups to intense practice sessions and bonding moments.',
    coverSrc: cdnImage('/gallery/community-meetup.png'),
    category: 'community',
    count: GALLERY_ITEMS.filter(g => g.category === 'community').length,
    accentColor: 'purple', // Female division color
  },
  {
    id: 'col-achievement',
    title: 'Hall of Fame',
    subtitle: 'Jejak Kejayaan',
    description: 'Celebrating victories, awards, and milestones. Every trophy tells a story of dedication and triumph.',
    coverSrc: cdnImage('/gallery/champion-celebration.png'),
    category: 'achievement',
    count: GALLERY_ITEMS.filter(g => g.category === 'achievement').length,
    accentColor: 'gold', // Tarkam color
  },
];

/* ========== Animation Variants ========== */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemReveal: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

const scaleReveal: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

/* ========== Accent Color Classes ========== */
const getAccentClasses = (accent: 'cyan' | 'purple' | 'gold') => {
  const classes = {
    cyan: {
      badge: 'bg-cyan-500 text-white',
      text: 'text-cyan-600 dark:text-cyan-400',
      textLight: 'text-cyan-600 dark:text-cyan-400',
      hoverText: 'group-hover:text-cyan-700 dark:group-hover:text-cyan-300',
      border: 'hover:border-cyan-400 dark:hover:border-cyan-500/50',
    },
    purple: {
      badge: 'bg-purple-500 text-white',
      text: 'text-purple-600 dark:text-purple-400',
      textLight: 'text-purple-600 dark:text-purple-400',
      hoverText: 'group-hover:text-purple-700 dark:group-hover:text-purple-300',
      border: 'hover:border-purple-400 dark:hover:border-purple-500/50',
    },
    gold: {
      badge: 'bg-amber-500 text-white',
      text: 'text-amber-600 dark:text-amber-400',
      textLight: 'text-amber-600 dark:text-amber-400',
      hoverText: 'group-hover:text-amber-700 dark:group-hover:text-amber-300',
      border: 'hover:border-amber-400 dark:hover:border-amber-500/50',
    },
  };
  return classes[accent];
};

/* ========== Elegant Collection Card — MonoGlass Inspired ========== */
const CollectionCard = React.memo(function CollectionCard({
  collection, index, onClick, isActive
}: {
  collection: Collection;
  index: number;
  onClick: () => void;
  isActive: boolean;
}) {
  const accentClasses = getAccentClasses(collection.accentColor);
  
  return (
    <motion.div
      variants={itemReveal}
      className="group relative rounded-2xl overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      {/* Card container - Clean light theme */}
      <div className={`relative rounded-2xl overflow-hidden transition-all duration-500 
        bg-white dark:bg-white/[0.03] 
        border border-stone-200 dark:border-white/[0.06] 
        shadow-sm
        hover:shadow-xl dark:hover:shadow-[0_0_30px_rgba(239,249,35,0.1)]
        ${accentClasses.border}
      `}>
        {/* Image Container */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={collection.coverSrc}
            alt={collection.title}
            fill
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
            loading="lazy"
          />
          
          {/* Gradient overlay - Subtle and clean */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-stone-900/20 to-transparent" />
          
          {/* Number Badge — MonoGlass style */}
          <div className="absolute top-3 left-3 z-10">
            <div className={`${accentClasses.badge} rounded-full px-2.5 py-1`}>
              <span className="text-[10px] font-mono tabular-nums font-semibold">
                0{index + 1}
              </span>
            </div>
          </div>
        </div>
        
        {/* Content Section - Clean background */}
        <div className="p-5 sm:p-6 bg-white dark:bg-transparent">
          {/* Title with subtitle */}
          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="font-serif text-lg font-semibold text-stone-800 dark:text-white group-hover:text-stone-900 dark:group-hover:text-white transition-colors">
              {collection.title}
            </h3>
            <span className="text-xs text-stone-400 dark:text-stone-500 font-sans">
              {collection.subtitle}
            </span>
          </div>
          
          {/* Description */}
          <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed line-clamp-2 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors">
            {collection.description}
          </p>
          
          {/* Bottom bar */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs font-mono text-stone-400 dark:text-stone-500 tabular-nums">
              {collection.count} works
            </span>
            <span className={`text-xs font-medium flex items-center gap-1 ${accentClasses.textLight} ${accentClasses.hoverText} transition-colors`}>
              Explore
              <ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

/* ========== Gallery Card — Refined Style ========== */
const GalleryCard = React.memo(function GalleryCard({
  item, onClick, index
}: {
  item: GalleryItem;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.div
      variants={itemReveal}
      layout
      className="group relative rounded-2xl overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      {/* Card container */}
      <div className="relative rounded-2xl overflow-hidden transition-all duration-500 
        bg-white dark:bg-white/[0.02] 
        border border-stone-200 dark:border-white/[0.04] 
        shadow-sm
        hover:shadow-xl dark:hover:shadow-[0_0_30px_rgba(239,249,35,0.08)]
        hover:border-amber-300 dark:hover:border-[#EFF923]/20
      ">
        {/* Image Container */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={item.src}
            alt={item.alt}
            fill
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 25vw"
            loading="lazy"
          />
          
          {/* Gradient overlay - Dark for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/30 to-transparent" />
          
          {/* Tag Badge — top left */}
          <div className="absolute top-3 left-3 z-10">
            <Badge className={`${item.tagColor} text-[9px] font-semibold`}>
              {item.tag}
            </Badge>
          </div>
          
          {/* Zoom Icon — top right */}
          <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <div className="w-8 h-8 rounded-lg bg-white/90 dark:bg-black/60 backdrop-blur-sm border border-stone-200 dark:border-white/10 flex items-center justify-center shadow-lg">
              <ZoomIn className="w-3.5 h-3.5 text-stone-700 dark:text-white" />
            </div>
          </div>
          
          {/* Bottom Content - White text on dark overlay */}
          <div className="absolute bottom-0 inset-x-0 p-4 z-10">
            <h3 className="text-sm font-serif font-semibold text-white truncate">
              {item.title}
            </h3>
            <p className="text-[11px] text-white/70 mt-1 line-clamp-1 group-hover:text-white/90 transition-colors duration-300">
              {item.description}
            </p>
            <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
              <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                <Calendar className="w-3 h-3" />
                {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

/* ========== Featured Hero Card ========== */
const FeaturedCard = React.memo(function FeaturedCard({
  item, onClick
}: {
  item: GalleryItem;
  onClick: () => void;
}) {
  return (
    <motion.div
      variants={scaleReveal}
      layout
      className="group relative rounded-2xl overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      {/* Card container */}
      <div className="relative rounded-2xl overflow-hidden transition-all duration-500 
        bg-white dark:bg-white/[0.03] 
        border border-stone-200 dark:border-white/[0.06] 
        shadow-sm
        hover:shadow-xl dark:hover:shadow-[0_0_50px_rgba(239,249,35,0.15)]
        hover:border-amber-300 dark:hover:border-[#EFF923]/20
      ">
        {/* Featured Image */}
        <div className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden">
          <Image
            src={item.src}
            alt={item.alt}
            fill
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, 50vw"
            loading="lazy"
          />
          
          {/* Multi-layer overlay - Dark for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/95 via-stone-900/40 to-stone-900/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-stone-900/30 via-transparent to-transparent" />
          
          {/* Gold accent line */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-amber-500 dark:via-[#EFF923] to-transparent" />
          
          {/* Tag + Featured Badge */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <Badge className={`${item.tagColor} text-[10px] font-semibold`}>
              {item.tag}
            </Badge>
            <Badge className="bg-amber-500 text-white text-[10px] font-semibold px-3 py-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />Featured
            </Badge>
          </div>
          
          {/* Zoom Icon */}
          <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <div className="w-9 h-9 rounded-2xl bg-white/90 dark:bg-black/60 backdrop-blur-sm border border-stone-200 dark:border-white/10 flex items-center justify-center shadow-lg">
              <ZoomIn className="w-4 h-4 text-stone-700 dark:text-white" />
            </div>
          </div>
          
          {/* Bottom Content - White text on dark overlay */}
          <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6 z-10">
            <h3 className="text-lg sm:text-xl font-serif font-semibold text-white">
              {item.title}
            </h3>
            <p className="text-sm text-white/70 mt-2 line-clamp-2 group-hover:text-white/90 transition-colors duration-300 max-w-lg">
              {item.description}
            </p>
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-[11px] text-amber-400 font-mono">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

/* ========== Lightbox Component ========== */
function Lightbox({ item, onClose, onPrev, onNext }: {
  item: GalleryItem;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/95 dark:bg-black/95 backdrop-blur-md p-4"
        onClick={onClose}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white dark:bg-white/10 backdrop-blur-sm border border-stone-200 dark:border-white/10 flex items-center justify-center text-stone-700 dark:text-white hover:bg-stone-100 dark:hover:bg-white/20 transition-colors shadow-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Prev Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 z-10 w-10 h-10 rounded-full bg-white dark:bg-white/10 backdrop-blur-sm border border-stone-200 dark:border-white/10 flex items-center justify-center text-stone-700 dark:text-white hover:bg-stone-100 dark:hover:bg-white/20 transition-colors shadow-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Next Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 z-10 w-10 h-10 rounded-full bg-white dark:bg-white/10 backdrop-blur-sm border border-stone-200 dark:border-white/10 flex items-center justify-center text-stone-700 dark:text-white hover:bg-stone-100 dark:hover:bg-white/20 transition-colors shadow-lg"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Image + Info */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative max-w-5xl w-full max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden bg-stone-800 dark:bg-stone-900 border border-stone-700 dark:border-white/[0.06]">
            <Image
              src={item.src}
              alt={item.alt}
              fill
              className="w-full h-full object-contain"
              sizes="(max-width: 1024px) 100vw, 1024px"
              loading="lazy"
            />
          </div>
          {/* Info Bar */}
          <div className="mt-3 flex items-center gap-3 px-2">
            <Badge className={`${item.tagColor} text-[10px] font-semibold`}>
              {item.tag}
            </Badge>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-serif font-semibold text-white truncate">{item.title}</h3>
              <p className="text-[11px] text-white/60">{item.description}</p>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-amber-400 shrink-0 font-mono">
              <Calendar className="w-3 h-3" />
              {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ========== Main Gallery Section Component ========== */
export function GallerySection() {
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  /* ========== Parallax ========== */
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '-10%']);

  /* ========== Current collection items ========== */
  const currentItems = useMemo(() => {
    if (!activeCollection) return [];
    const collection = COLLECTIONS.find(c => c.id === activeCollection);
    if (!collection) return [];
    return GALLERY_ITEMS.filter(item => item.category === collection.category);
  }, [activeCollection]);

  const featuredItems = useMemo(() => currentItems.filter(item => item.featured), [currentItems]);
  const regularItems = useMemo(() => currentItems.filter(item => !item.featured), [currentItems]);
  const allItems = useMemo(() => [...featuredItems, ...regularItems], [featuredItems, regularItems]);

  /* ========== Lightbox Navigation ========== */
  const openLightbox = useCallback((index: number) => setLightboxIndex(index), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prevImage = useCallback(() => {
    setLightboxIndex(prev => prev !== null ? (prev - 1 + allItems.length) % allItems.length : null);
  }, [allItems.length]);
  const nextImage = useCallback(() => {
    setLightboxIndex(prev => prev !== null ? (prev + 1) % allItems.length : null);
  }, [allItems.length]);

  /* ========== Keyboard Navigation ========== */
  React.useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, closeLightbox, prevImage, nextImage]);

  return (
    <>
      <section id="gallery" ref={sectionRef} className="relative py-24 px-4 overflow-hidden">
        {/* Parallax Background - Clean warm tones */}
        <motion.div className="absolute inset-0" style={{ y: bgY }}>
          <div className="absolute inset-0 bg-gradient-to-b from-stone-50 via-white to-stone-50 dark:from-background dark:via-background dark:to-background" />

        </motion.div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto">
          {/* ── Section Header ── */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-transparent to-amber-400 dark:to-[#EFF923]" />
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-200 dark:border-[#EFF923]/20 bg-amber-50 dark:bg-[#EFF923]/10">
                <Camera className="w-4 h-4 text-amber-500 dark:text-[#EFF923]" />
                <span className="text-[11px] font-semibold text-amber-600 dark:text-[#EFF923] uppercase tracking-[0.2em]">Galeri</span>
              </div>
              <div className="h-px w-12 sm:w-20 bg-gradient-to-l from-transparent to-amber-400 dark:to-[#EFF923]" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold text-stone-800 dark:text-white">
              Momen Komunitas
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-4 max-w-lg mx-auto leading-relaxed font-sans">
              Kumpulan momen terbaik dari kegiatan komunitas IDM Tarkam — dari panggung turnamen hingga cerita di balik layar
            </p>
          </motion.div>

          {/* ── Collections Grid — MonoGlass Inspired ── */}
          {!activeCollection ? (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="mb-16"
            >
              {/* Section subtitle */}
              <motion.div variants={fadeUp} className="flex items-end justify-between mb-8">
                <div>
                  <h3 className="font-serif text-xl sm:text-2xl font-semibold text-stone-800 dark:text-white">Collections</h3>
                  <p className="text-sm text-stone-400 dark:text-stone-500 mt-2 font-sans">Three collections, one vision.</p>
                </div>
                <div className="w-24 h-px bg-stone-200 dark:bg-stone-700 hidden sm:block" />
              </motion.div>
              
              {/* Divider line */}
              <motion.div variants={fadeUp} className="w-full h-px bg-stone-100 dark:bg-stone-800 mb-8" />
              
              {/* Collections Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                {COLLECTIONS.map((collection, index) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    index={index}
                    onClick={() => setActiveCollection(collection.id)}
                    isActive={activeCollection === collection.id}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            /* ── Gallery View ── */
            <motion.div
              key={activeCollection}
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={staggerContainer}
            >
              {/* Back button + Collection title */}
              <motion.div variants={fadeUp} className="flex items-center gap-4 mb-8">
                <button
                  onClick={() => setActiveCollection(null)}
                  className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 hover:text-amber-500 dark:hover:text-[#EFF923] transition-colors group"
                >
                  <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  Back to Collections
                </button>
                <div className="h-4 w-px bg-stone-200 dark:bg-stone-700" />
                <span className="text-sm font-mono text-amber-500 dark:text-[#EFF923]">
                  {COLLECTIONS.find(c => c.id === activeCollection)?.title}
                </span>
              </motion.div>

              {/* Featured Items — Hero Row */}
              {featuredItems.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {featuredItems.map((item) => {
                    const globalIndex = allItems.indexOf(item);
                    return (
                      <FeaturedCard
                        key={item.id}
                        item={item}
                        onClick={() => openLightbox(globalIndex)}
                      />
                    );
                  })}
                </div>
              )}

              {/* Regular Items — Grid */}
              {regularItems.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {regularItems.map((item) => {
                    const globalIndex = allItems.indexOf(item);
                    return (
                      <GalleryCard
                        key={item.id}
                        item={item}
                        index={globalIndex}
                        onClick={() => openLightbox(globalIndex)}
                      />
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Stats Bar — Clean design ── */}
          {!activeCollection && (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="mt-16"
            >
              <div className="flex items-center justify-center gap-0 py-4 px-6 rounded-2xl bg-white dark:bg-white/[0.02] border border-stone-200 dark:border-white/[0.04] shadow-sm max-w-lg mx-auto">
                {[
                  { icon: Camera, value: GALLERY_ITEMS.length, label: 'Foto' },
                  { icon: Trophy, value: COLLECTIONS.length, label: 'Koleksi' },
                  { icon: Award, value: GALLERY_ITEMS.filter(g => g.category === 'achievement').length, label: 'Prestasi' },
                ].map((stat, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <div className="w-px h-8 bg-stone-200 dark:bg-stone-700 mx-4 sm:mx-6" />}
                    <div className="flex items-center gap-2">
                      <stat.icon className="w-4 h-4 text-amber-500 dark:text-[#EFF923]" />
                      <span className="text-lg font-mono font-semibold text-stone-800 dark:text-white">{stat.value}</span>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 uppercase tracking-wider hidden sm:inline">{stat.label}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── Lightbox ── */}
      {lightboxIndex !== null && allItems[lightboxIndex] && (
        <Lightbox
          item={allItems[lightboxIndex]}
          onClose={closeLightbox}
          onPrev={prevImage}
          onNext={nextImage}
        />
      )}
    </>
  );
}
