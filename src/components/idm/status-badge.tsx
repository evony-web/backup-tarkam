'use client';

import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config: Record<string, { label: string; cls: string; pulse?: boolean }> = {
    setup: { label: 'Persiapan', cls: 'bg-muted text-muted-foreground' },
    registration: { label: '🟢 Pendaftaran Dibuka', cls: 'bg-green-500/10 text-green-500' },
    approval: { label: '⏳ Persetujuan', cls: 'bg-yellow-500/10 text-yellow-500' },
    team_generation: { label: '✅ Tim Siap', cls: 'bg-blue-500/10 text-blue-500' },
    bracket_generation: { label: '✅ Bracket Siap', cls: 'bg-blue-500/10 text-blue-500' },
    main_event: { label: '🔴 LIVE SEKARANG', cls: 'bg-red-500/10 text-red-500', pulse: true },
    scoring: { label: '📊 Penilaian', cls: 'bg-yellow-500/10 text-yellow-500' },
    completed: { label: '🏆 Selesai', cls: 'bg-muted text-muted-foreground' },
    upcoming: { label: '📅 Akan Datang', cls: 'bg-blue-500/10 text-blue-500' },
    live: { label: '🔴 LIVE', cls: 'bg-red-500/10 text-red-500', pulse: true },
    active: { label: '🟢 Aktif', cls: 'bg-green-500/10 text-green-500' },
    registered: { label: 'Terdaftar', cls: 'bg-blue-500/10 text-blue-500' },
    approved: { label: 'Disetujui', cls: 'bg-green-500/10 text-green-500' },
    assigned: { label: 'Ditugaskan', cls: 'bg-green-500/10 text-green-500' },
    rejected: { label: 'Ditolak', cls: 'bg-red-500/10 text-red-500' },
  };

  const c = config[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <Badge className={`${c.cls} ${textSize} font-semibold border-0 ${c.pulse ? 'live-dot' : ''}`}>
      {c.label}
    </Badge>
  );
}
