import { create } from "zustand";

export type AppView = "landing" | "community" | "admin" | "bracket" | "hasil" | "players" | "highlights" | "peringkat";
export type Division = "semua" | "male" | "female";
export type NotifType = "donation" | "match" | "mvp" | "streak" | "victory";

interface Notification {
  id: string;
  type: NotifType;
  message: string;
}

interface AdminUser {
  id: string;
  username: string;
  role: string;
}

interface AdminAuthState {
  isAuthenticated: boolean;
  admin: AdminUser | null;
}

interface PlayerSkinData {
  type: string;
  icon: string;
  displayName: string;
  colorClass: string;
  priority: number;
  duration: string;
  reason?: string | null;
  expiresAt?: string | null;
  /** Permanent donor heart badge count (independent of skin expiry) */
  donorBadgeCount?: number;
}

interface PlayerAccount {
  id: string;
  username: string;
  donorBadgeCount?: number;
  skins: PlayerSkinData[];
  player: {
    id: string;
    gamertag: string;
    name: string;
    division: string;
    tier: string;
    avatar?: string | null;
    points: number;
    totalWins: number;
    totalMvp: number;
    matches: number;
    streak: number;
    city?: string;
  };
}

interface PlayerAuthState {
  isAuthenticated: boolean;
  account: PlayerAccount | null;
}

interface AppState {
  // Navigation
  currentView: AppView;
  setCurrentView: (view: AppView) => void;

  // Division filter
  division: Division;
  setDivision: (d: Division) => void;

  // Initial dashboard tab — set before navigating to dashboard to auto-switch tab
  initialDashboardTab: string | null;
  setInitialDashboardTab: (tab: string | null) => void;

  // Initial bracket tab — set before navigating to bracket to auto-switch sub-tab ("bracket" or "results")
  initialBracketTab: string | null;
  setInitialBracketTab: (tab: string | null) => void;

  // Mobile sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Desktop sidebar collapsed state
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;

  // Loading
  loading: boolean;
  setLoading: (l: boolean) => void;

  // Donation popup (legacy - kept for backward compat)
  donationPopup: { show: boolean; message: string };
  showDonationPopup: (msg: string) => void;
  hideDonationPopup: () => void;

  // Notification queue
  notifications: Notification[];
  addNotification: (type: NotifType, message: string) => void;
  removeNotification: (id: string) => void;

  // Admin auth
  adminAuth: AdminAuthState;
  setAdminAuth: (auth: AdminAuthState) => void;
  clearAdminAuth: () => void;

  // Player auth
  playerAuth: PlayerAuthState;
  setPlayerAuth: (auth: PlayerAuthState) => void;
  clearPlayerAuth: () => void;
  refreshPlayerSession: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "landing",
  setCurrentView: (view) => set({ currentView: view }),

  division: "semua",
  setDivision: (d) => set({ division: d }),

  initialDashboardTab: null,
  setInitialDashboardTab: (tab) => set({ initialDashboardTab: tab }),

  initialBracketTab: null,
  setInitialBracketTab: (tab) => set({ initialBracketTab: tab }),

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  sidebarCollapsed: typeof window !== 'undefined' ? (localStorage.getItem('idm-sidebar-collapsed') === 'true') : false,
  setSidebarCollapsed: (collapsed) => {
    try { localStorage.setItem('idm-sidebar-collapsed', String(collapsed)); } catch { /* ignore */ }
    set({ sidebarCollapsed: collapsed });
  },
  toggleSidebarCollapsed: () => set((s) => {
    const next = !s.sidebarCollapsed;
    try { localStorage.setItem('idm-sidebar-collapsed', String(next)); } catch { /* ignore */ }
    return { sidebarCollapsed: next };
  }),

  loading: false,
  setLoading: (l) => set({ loading: l }),

  donationPopup: { show: false, message: "" },
  showDonationPopup: (msg) => set({ donationPopup: { show: true, message: msg } }),
  hideDonationPopup: () => set({ donationPopup: { show: false, message: "" } }),

  notifications: [],
  addNotification: (type, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ notifications: [...s.notifications, { id, type, message }] }));
    // Auto-remove after 5 seconds
    setTimeout(() => {
      set((s) => ({ notifications: s.notifications.filter(n => n.id !== id) }));
    }, 5000);
  },
  removeNotification: (id) => set((s) => ({ notifications: s.notifications.filter(n => n.id !== id) })),

  adminAuth: { isAuthenticated: false, admin: null },
  setAdminAuth: (auth) => set({ adminAuth: auth }),
  clearAdminAuth: () => set({ adminAuth: { isAuthenticated: false, admin: null } }),

  playerAuth: { isAuthenticated: false, account: null },
  setPlayerAuth: (auth) => set({ playerAuth: auth }),
  clearPlayerAuth: () => set({ playerAuth: { isAuthenticated: false, account: null } }),
  refreshPlayerSession: async () => {
    try {
      const res = await fetch('/api/account/session');
      const data = await res.json();
      if (data.authenticated && data.account) {
        set({ playerAuth: { isAuthenticated: true, account: data.account } });
      } else {
        set({ playerAuth: { isAuthenticated: false, account: null } });
      }
    } catch {
      // Keep existing auth state on network error — don't log out user
    }
  },
}));
