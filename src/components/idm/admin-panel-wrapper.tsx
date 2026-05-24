'use client';

import { useAppStore } from '@/lib/store';
import { AdminLogin } from './admin-login';
import { AdminPanel } from './admin-panel';

export function AdminPanelWrapper() {
  const { adminAuth } = useAppStore();

  if (!adminAuth.isAuthenticated) {
    return <AdminLogin />;
  }

  return <AdminPanel />;
}
