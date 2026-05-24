'use client';

import { useAppStore, type AppView } from '@/lib/store';
import Image from 'next/image';
import {
  Crown, Trophy, Swords, Music, Shield, LogIn, UserCircle, LogOut, Sun, Moon, Home, Award, Target, GitBranch,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore, useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCrossTabInvalidation } from '@/lib/cross-tab-sync';
import dynamic from 'next/dynamic';

// Lazy-loaded helpers
const LandingFooter = dynamic(() => import('./landing/landing-footer').then(m => ({ default: m.LandingFooter })), { ssr: false, loading: () => null });
const BackToTop = dynamic(() => import('./ui/back-to-top').then(m => ({ default: m.BackToTop })), { ssr: false, loading: () => null });
const ScrollProgress = dynamic(() => import('./ui/scroll-progress').then(m => ({ default: m.ScrollProgress })), { ssr: false, loading: () => null });
const UnifiedLoginModal = dynamic(() => import('./unified-login-modal').then(m => ({ default: m.UnifiedLoginModal })), { ssr: false, loading: () => null });

/* ═══ Theme Toggle — Public Page ═══ */
const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

function PublicThemeToggle({ scrolled }: { scrolled: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useIsMounted();

  if (!mounted) {
    return (
      <button className="compact-dot inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full transition-opacity opacity-50" aria-label="Toggle theme">
        <div className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`btn-press compact-dot inline-flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 cursor-pointer border active:scale-95 ${
        scrolled
          ? 'border-idm-gold-warm/20 bg-idm-gold-warm/5 hover:bg-idm-gold-warm/15 text-idm-gold-warm'
          : 'border-foreground/10 bg-foreground/5 hover:bg-foreground/10 text-foreground/70 hover:text-foreground dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/15 dark:text-white/70 dark:hover:text-white'
      }`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="relative h-3.5 w-3.5 sm:h-4 sm:w-4 overflow-hidden">
        <Sun className={`absolute inset-0 h-3.5 w-3.5 sm:h-4 sm:w-4 transition-all duration-300 ${isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`} />
        <Moon className={`absolute inset-0 h-3.5 w-3.5 sm:h-4 sm:w-4 transition-all duration-300 ${isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`} />
      </div>
    </button>
  );
}

/* ═══ Public Auth Button ═══ */
function PublicAuthButton({
  onOpenLogin,
  onLogout,
  scrolled,
}: {
  onOpenLogin: (tab: 'peserta' | 'admin') => void;
  onLogout: () => void;
  scrolled: boolean;
}) {
  const { adminAuth, playerAuth } = useAppStore();
  const [showMenu, setShowMenu] = useState(false);

  const isLoggedIn = adminAuth.isAuthenticated || playerAuth.isAuthenticated;
  const displayName = adminAuth.isAuthenticated
    ? adminAuth.admin?.username
    : playerAuth.isAuthenticated
      ? playerAuth.account?.player?.gamertag
      : null;
  const isPlayer = playerAuth.isAuthenticated;
  const isAdmin = adminAuth.isAuthenticated;

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => setShowMenu(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showMenu]);

  if (!isLoggedIn) {
    return (
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <button
          onClick={() => onOpenLogin('peserta')}
          aria-label="Login akun"
          className={`btn-press compact-dot relative inline-flex items-center gap-1 px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-sm font-semibold transition-all duration-200 cursor-pointer border active:scale-95 ${
            scrolled
              ? 'border-idm-gold-warm/25 text-idm-gold-warm hover:bg-idm-gold-warm/10 hover:border-idm-gold-warm/40'
              : 'border-foreground/15 text-foreground/80 hover:bg-foreground/5 hover:border-foreground/25 dark:border-white/20 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/30'
          }`}
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Login</span>
        </button>
        {/* Admin login shortcut — subtle */}
        <button
          onClick={() => onOpenLogin('admin')}
          aria-label="Admin login"
          className={`btn-press compact-dot p-0.5 sm:p-1 rounded-md transition-all duration-200 cursor-pointer opacity-50 hover:opacity-100 ${
            scrolled ? 'text-idm-gold-warm/70 hover:text-idm-gold-warm' : 'text-foreground/50 hover:text-foreground/90 dark:text-white/50 dark:hover:text-white/90'
          }`}
          title="Login Admin"
        >
          <Shield className="w-3.5 h-3.5 text-idm-gold-warm drop-shadow-[0_0_4px_rgba(239,249,35,0.4)]" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
        aria-label="User menu"
        className={`btn-press flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full transition-all duration-200 cursor-pointer border active:scale-95 shrink-0 ${
          scrolled
            ? 'border-idm-gold-warm/20 bg-idm-gold-warm/5 hover:bg-idm-gold-warm/10'
            : 'border-foreground/10 bg-foreground/5 hover:bg-foreground/10 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10'
        }`}
      >
        {isPlayer && playerAuth.account?.player?.avatar ? (
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden ring-1 ring-idm-gold-warm/30">
            <Image src={playerAuth.account.player.avatar} alt={displayName || ''} width={24} height={24} className="w-full h-full object-cover" loading="lazy" />
          </div>
        ) : isAdmin ? (
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-idm-gold-warm/20 flex items-center justify-center ring-1 ring-idm-gold-warm/40 shadow-[0_0_6px_rgba(239,249,35,0.15)]">
            <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-idm-gold-warm drop-shadow-[0_0_3px_rgba(239,249,35,0.4)]" />
          </div>
        ) : (
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted/30 flex items-center justify-center ring-1 ring-idm-gold-warm/30">
            <UserCircle className="w-3 h-3 text-idm-gold-warm" />
          </div>
        )}
        <span className={`text-[10px] sm:text-xs font-semibold max-w-[60px] sm:max-w-[80px] truncate ${scrolled ? 'text-idm-gold-warm' : 'text-foreground/80 dark:text-white/80'}`}>
          {displayName}
        </span>
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-2xl border border-idm-gold-warm/15 bg-background/98 backdrop-blur-xl shadow-xl shadow-black/30 overflow-hidden z-[60]">
          <div className="px-3 py-2.5 border-b border-idm-gold-warm/10 bg-idm-gold-warm/[0.03]">
            <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isAdmin ? `Admin · ${adminAuth.admin?.role}` : isPlayer ? `Peserta · ${playerAuth.account?.player?.division === 'male' ? '♂ Cowo' : '♀ Cewe'}` : ''}
            </p>
          </div>
          <div className="p-1.5">
            {isAdmin && (
              <button
                onClick={() => { setShowMenu(false); useAppStore.getState().setCurrentView('admin'); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground hover:text-idm-gold-warm hover:bg-idm-gold-warm/5 rounded-lg transition-colors cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-idm-gold-warm" /> Admin Panel
              </button>
            )}
            {isPlayer && (
              <button
                onClick={() => { setShowMenu(false); useAppStore.getState().setCurrentView('landing'); setTimeout(() => document.getElementById('cari-turnamen')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground hover:text-idm-gold-warm hover:bg-idm-gold-warm/5 rounded-lg transition-colors cursor-pointer"
              >
                <Target className="w-3.5 h-3.5" /> Status Turnamen
              </button>
            )}
            <button
              onClick={() => { setShowMenu(false); onLogout(); }}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-red-400/80 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Public Page Layout ═══
   A landing-page-style layout for public views.
   Has: Fixed top nav, mobile bottom nav, footer, scroll progress, back to top.
   NO sidebar, NO dashboard feel.
*/
export function PublicPageLayout({ children, currentView }: { children: React.ReactNode; currentView: AppView }) {
  const { setCurrentView } = useAppStore();

  /* Cross-tab sync */
  useCrossTabInvalidation();

  /* CMS data for logo/title/footer */
  const { data: cmsData } = useQuery({
    queryKey: ['cms-content'],
    queryFn: async () => {
      const res = await fetch('/api/cms/content');
      if (!res.ok) return { settings: {}, sections: {} };
      return res.json();
    },
    staleTime: 300000,
    refetchInterval: 600000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    gcTime: 300000,
  });

  const cms = cmsData?.settings || {};
  const cmsLogo = cms.logo_url || '/logo1.webp';
  const cmsSiteTitle = cms.site_title || 'Tarkam IDM';

  /* Login modal state */
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginDefaultTab, setLoginDefaultTab] = useState<'peserta' | 'admin'>('peserta');

  /* Scroll state */
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);
  const scrollTickingRef = useRef(false);

  /* Scroll to top when view changes — prevents showing bottom of page */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [currentView]);

  useEffect(() => {
    const onScroll = () => {
      if (scrollTickingRef.current) return;
      scrollTickingRef.current = true;
      requestAnimationFrame(() => {
        const isScrolled = window.scrollY > 20;
        if (scrolledRef.current !== isScrolled) {
          scrolledRef.current = isScrolled;
          setScrolled(isScrolled);
        }
        scrollTickingRef.current = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col bg-background landing-scroll pb-24 md:pb-0">

      {/* ══════ FIXED NAVIGATION HEADER ══════ */}
      <nav aria-label="Main navigation" className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-background/95 border-b border-idm-gold-warm/10 shadow-[0_4px_30px_rgba(0,0,0,0.3)] nav-scrolled-glow'
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo — clickable to go home */}
          <button
            onClick={() => setCurrentView('landing')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className={`w-7 h-7 rounded-lg overflow-hidden shrink-0 transition-all duration-500 ${scrolled ? 'nav-logo-glow glow-pulse' : 'glow-pulse'}`}>
              <Image src={cmsLogo} alt="IDM" width={28} height={28} className="w-full h-full object-cover" loading="lazy" />
            </div>
            <span className={`text-gradient-fury text-sm font-bold tracking-tight transition-all duration-500 ${scrolled ? 'nav-logo-text-glow' : ''}`}>{cmsSiteTitle}</span>
          </button>

          {/* Desktop Nav Links — same items & style as landing page */}
          <div className="hidden sm:flex items-center gap-0.5 md:gap-1">
            {[
              { view: 'landing' as AppView, label: 'Beranda', special: false },
              { view: 'hasil' as AppView, label: 'Hasil', special: false },
              { view: 'bracket' as AppView, label: 'Bracket', special: false },
              { view: 'highlights' as AppView, label: 'Juara', special: true },
              { view: 'peringkat' as AppView, label: 'Peringkat', special: false },
              { view: 'players' as AppView, label: 'Pemain', special: false },
            ].map(item => (
              <button
                key={item.view}
                onClick={() => setCurrentView(item.view)}
                className={`relative px-2 md:px-3 py-1.5 text-xs md:text-sm transition-all duration-300 cursor-pointer rounded-md ${
                  currentView === item.view
                    ? 'text-idm-gold-warm font-semibold'
                    : item.special
                    ? 'text-idm-gold-warm/80 hover:text-idm-gold-warm'
                    : 'text-muted-foreground hover:text-idm-gold-warm/70'
                }`}
              >
                {item.special && <span className="absolute inset-0 rounded-md animate-pulse bg-idm-gold-warm/[0.06] border border-idm-gold-warm/15" />}
                <span className="relative flex items-center gap-1">
                  {item.special && <Crown className="w-3.5 h-3.5 drop-shadow-[0_0_4px_rgba(239,249,35,0.4)]" />}
                  {item.label}
                </span>
                {currentView === item.view && (
                  <div className="nav-indicator absolute bottom-0 left-1 right-1 h-[2px] bg-idm-gold-warm rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1 sm:gap-1.5 ml-1.5 sm:ml-0">
            <PublicThemeToggle scrolled={scrolled} />
            <PublicAuthButton
              onOpenLogin={(tab) => { setLoginDefaultTab(tab); setLoginModalOpen(true); }}
              onLogout={() => {
                const { clearAdminAuth, clearPlayerAuth } = useAppStore.getState();
                clearAdminAuth();
                clearPlayerAuth();
                fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
                fetch('/api/account/logout', { method: 'POST' }).catch(() => {});
              }}
              scrolled={scrolled}
            />
          </div>
        </div>
      </nav>

      {/* ══════ MOBILE BOTTOM NAVIGATION — same as landing page ══════ */}
      <nav aria-label="Section navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
        <div className="h-px bg-gradient-to-r from-transparent via-idm-gold-warm/30 to-transparent" aria-hidden="true" />
        <div className="bg-background/95 backdrop-blur-lg">
          <div className="flex items-center justify-around h-16 px-1 relative">
            {[
              { view: 'landing' as AppView, label: 'Beranda', icon: Home, special: false },
              { view: 'hasil' as AppView, label: 'Hasil', icon: Swords, special: false },
              { view: 'highlights' as AppView, label: 'Juara', icon: Crown, special: true },
              { view: 'peringkat' as AppView, label: 'Peringkat', icon: Award, special: false },
              { view: 'players' as AppView, label: 'Pemain', icon: Music, special: false },
            ].map(item => {
              const isActive = currentView === item.view;

              // FAB-style for Juara button — same as landing page
              if (item.special) {
                return (
                  <button
                    key={item.view}
                    onClick={() => setCurrentView(item.view)}
                    className="relative -mt-5 z-20 cursor-pointer"
                  >
                    <span className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 active:scale-90 ${
                      isActive
                        ? 'bg-idm-gold-warm'
                        : 'bg-gradient-to-br from-idm-gold-warm/90 to-yellow-500'
                    }`}>
                      <Crown className={`w-6 h-6 ${isActive ? 'text-black' : 'text-black/90'} fill-current`} />
                    </span>
                    <span className="block text-center text-[9px] font-bold mt-1 text-idm-gold-warm">{item.label}</span>
                  </button>
                );
              }

              return (
                <button
                  key={item.view}
                  onClick={() => setCurrentView(item.view)}
                  className={`relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1.5 px-2 rounded-xl transition-all duration-200 active:scale-90 ${
                    isActive
                    ? 'text-idm-gold-warm'
                    : 'text-muted-foreground hover:text-idm-gold-warm/70'
                  }`}
                >
                  <item.icon className="relative z-10 w-5 h-5" />
                  <span className="relative z-10 text-[10px] font-medium mt-0.5">{item.label}</span>
                  {isActive && (
                    <div className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-idm-gold-warm shadow-[0_0_6px_rgba(239,249,35,0.6)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ══════ BRACKET FAB (Mobile) ══════ — hidden when already on Bracket view */}
      {currentView !== 'bracket' && (
        <button
          onClick={() => setCurrentView('bracket')}
          className={`md:hidden fixed right-4 bottom-24 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer bg-idm-gold-warm/90 shadow-idm-gold-warm/30`}
          title="Bracket"
        >
          <GitBranch className="w-5 h-5 text-black" />
        </button>
      )}

      {/* ══════ PAGE CONTENT ══════ */}
      <main className="flex-1 pt-14">
        {children}
      </main>

      {/* ══════ FOOTER ══════ */}
      <LandingFooter cmsSettings={cms} className="mt-auto" />

      {/* ══════ MODALS ══════ */}
      <UnifiedLoginModal
        open={loginModalOpen}
        onOpenChange={setLoginModalOpen}
        defaultTab={loginDefaultTab}
        onOpenRegistration={() => {
          setLoginModalOpen(false);
        }}
      />

      {/* ══════ SCROLL HELPERS ══════ */}
      <ScrollProgress />
      <BackToTop />
    </div>
  );
}
