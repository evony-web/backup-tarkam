'use client';

export function TierBadge({ tier }: { tier: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    S: { cls: 'tier-s', label: 'S' },
    A: { cls: 'tier-a', label: 'A' },
    B: { cls: 'tier-b', label: 'B' },
  };
  const c = config[tier] || { cls: 'bg-muted text-muted-foreground', label: tier };
  return (
    <span className={`${c.cls} px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center`}>
      {c.label}
    </span>
  );
}
