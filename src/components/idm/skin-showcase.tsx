'use client';

import React, { useState } from 'react';
import { X, Sparkles, ChevronDown, ChevronUp, Info } from 'lucide-react';
import {
  SkinBadge,
  SkinBadgesRow,
  SkinAvatarFrame,
  SkinName,
  SkinCardBorder,
} from './skin-renderer';
import { SKIN_TYPES, DEFAULT_SKIN_COLORS, getDonorBadgeConfig } from '@/lib/skin-utils';
import { cn } from '@/lib/utils';

// ============================================
// SkinShowcase — Visual preview of all skin types
// Shows avatar frame, name gradient, card border, and badge effects
// ============================================

interface SkinShowcaseProps {
  open: boolean;
  onClose: () => void;
}

// Mock skin data for each type
const MOCK_SKINS = Object.entries(SKIN_TYPES).map(([key, def]) => ({
  type: def.type,
  icon: def.icon,
  displayName: def.displayName,
  colorClass: JSON.stringify(DEFAULT_SKIN_COLORS[key]),
  priority: def.priority,
  duration: def.duration,
  donorBadgeCount: key === 'donor' ? 0 : undefined,
}));

// Mock donor badge skins (for the heart badge variants)
const MOCK_DONOR_SKINS = [
  {
    ...MOCK_SKINS.find(s => s.type === 'donor')!,
    donorBadgeCount: 1,
    displayName: '1x Donasi',
  },
  {
    ...MOCK_SKINS.find(s => s.type === 'donor')!,
    donorBadgeCount: 5,
    displayName: '5x Donasi',
  },
];

export function SkinShowcase({ open, onClose }: SkinShowcaseProps) {
  const [expandedSkin, setExpandedSkin] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Content */}
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#0f0e0a] border border-border/50 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0f0e0a] border-b border-border/30 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-idm-gold" />
            <h2 className="text-sm font-bold">Skin Showcase</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center hover:bg-muted/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Intro text */}
          <p className="text-[11px] text-muted-foreground text-center">
            Lihat preview semua skin yang tersedia. Setiap skin berdurasi <strong className="text-idm-gold">1 minggu</strong> dan menampilkan efek visual unik.
          </p>

          {/* Skin Cards */}
          {MOCK_SKINS.map((skin) => {
            const isExpanded = expandedSkin === skin.type;
            const skinColor = DEFAULT_SKIN_COLORS[skin.type];

            return (
              <div key={skin.type} className="rounded-2xl overflow-hidden border border-border/30">
                {/* Skin Preview Card (with card border effect) */}
                <SkinCardBorder skin={skin}>
                  <div className="bg-[#1a1812] p-3 sm:p-4">
                    {/* Clickable header row */}
                    <button
                      className="w-full flex items-center gap-3 text-left"
                      onClick={() => setExpandedSkin(isExpanded ? null : skin.type)}
                    >
                      {/* Avatar with skin frame */}
                      <SkinAvatarFrame skin={skin}>
                        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center text-lg">
                          {skin.icon}
                        </div>
                      </SkinAvatarFrame>

                      {/* Name with skin gradient */}
                      <div className="flex-1 min-w-0">
                        <SkinName skin={skin}>
                          <span className="text-sm font-bold">PlayerName</span>
                        </SkinName>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <SkinBadge skin={skin} size="md" />
                          <span className="text-[9px] text-muted-foreground">
                            {skin.duration === 'weekly' ? '7 hari' : 'Permanen'}
                          </span>
                        </div>
                      </div>

                      {/* Expand icon */}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  </div>
                </SkinCardBorder>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="bg-[#14120e] border-t border-border/20 p-3 sm:p-4 space-y-3">
                    {/* Skin details */}
                    <div className="grid grid-cols-2 gap-2">
                      <DetailItem label="Tipe" value={skin.displayName} />
                      <DetailItem label="Durasi" value="1 Minggu" />
                      <DetailItem
                        label="Frame"
                        value={
                          <span
                            className="inline-block w-4 h-4 rounded-full border-2"
                            style={{ borderColor: skinColor.frame, boxShadow: `0 0 6px ${skinColor.glow}` }}
                          />
                        }
                      />
                      <DetailItem
                        label="Glow"
                        value={
                          <span
                            className="inline-block w-4 h-4 rounded-full"
                            style={{ backgroundColor: skinColor.glow }}
                          />
                        }
                      />
                    </div>

                    {/* Badge preview sizes */}
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Badge Size</p>
                      <div className="flex items-center gap-2">
                        <SkinBadge skin={skin} size="sm" />
                        <span className="text-[9px] text-muted-foreground">Small</span>
                        <SkinBadge skin={skin} size="md" />
                        <span className="text-[9px] text-muted-foreground">Medium</span>
                        <SkinBadge skin={skin} size="lg" />
                        <span className="text-[9px] text-muted-foreground">Large</span>
                      </div>
                    </div>

                    {/* Name gradient preview */}
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Name Gradient</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">Normal:</span>
                        <span className="text-sm font-bold text-white">PlayerName</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">Skin:</span>
                        <SkinName skin={skin}>
                          <span className="text-sm font-bold">PlayerName</span>
                        </SkinName>
                      </div>
                    </div>

                    {/* How to get */}
                    <HowToGet type={skin.type} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Donor Heart Badge Section */}
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">❤️</span>
              <h3 className="text-xs font-bold text-rose-400">Donatur Heart Badge</h3>
            </div>
            <p className="text-[10px] text-muted-foreground mb-3">
              Badge hati ❤️ bersifat <strong className="text-rose-300">permanen</strong> — tetap muncul meskipun skin Donatur sudah expired!
            </p>

            <div className="space-y-2">
              {/* 1-4 donations: small heart */}
              <div className="flex items-center gap-3 bg-[#1a1812] rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-1.5">
                  {/* Small heart badge preview */}
                  <span
                    className="inline-flex items-center justify-center rounded-full w-5 h-5 text-[11px]"
                    style={{
                      backgroundColor: 'rgba(244,63,94,0.2)',
                    }}
                    title="1x donasi"
                  >
                    ❤️
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-rose-300">1–4x Donasi</p>
                  <p className="text-[9px] text-muted-foreground">Badge hati kecil (permanen)</p>
                </div>
                <SkinBadgesRow skins={[
                  { ...MOCK_DONOR_SKINS[0], priority: 1 },
                ]} />
              </div>

              {/* 5+ donations: big heart with pulse */}
              <div className="flex items-center gap-3 bg-[#1a1812] rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-1.5">
                  {/* Big heart badge with pulse glow preview */}
                  <span
                    className="inline-flex items-center justify-center rounded-full w-7 h-7 text-sm donor-heart-pulse"
                    style={{
                      backgroundColor: 'rgba(244,63,94,0.2)',
                      boxShadow: '0 0 8px rgba(244,63,94,0.4), 0 0 16px rgba(244,63,94,0.2)',
                    }}
                    title="5x donasi ★"
                  >
                    ❤️
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-rose-300">5+ Donasi ★</p>
                  <p className="text-[9px] text-muted-foreground">Badge hati besar + pulse glow (permanen)</p>
                </div>
                <SkinBadgesRow skins={[
                  { ...MOCK_DONOR_SKINS[1], priority: 1 },
                ]} />
              </div>
            </div>

            {/* Stacking example */}
            <div className="mt-3 pt-2 border-t border-rose-500/10">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Contoh Stacking (semua badge)</p>
              <SkinBadgesRow skins={[
                MOCK_SKINS.find(s => s.type === 'champion')!,
                MOCK_SKINS.find(s => s.type === 'mvp')!,
                MOCK_SKINS.find(s => s.type === 'sawer_diamond')!,
                { ...MOCK_SKINS.find(s => s.type === 'donor')!, donorBadgeCount: 5 },
              ]} />
            </div>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 p-3 sm:p-4 rounded-lg bg-muted/20 border border-border/20">
            <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground">
              Skin otomatis diberikan setelah Juara 1 / MVP dipilih oleh admin. Penyawer & Donatur diberikan manual oleh admin. Semua skin berdurasi 1 minggu kecuali badge hati donatur yang permanen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Helper sub-components
// ============================================

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-muted/10 rounded-lg px-2 py-1.5">
      <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-[11px] font-medium flex items-center gap-1.5">
        {value}
      </div>
    </div>
  );
}

function HowToGet({ type }: { type: string }) {
  const info: Record<string, { label: string; desc: string; auto: boolean }> = {
    champion: {
      label: '🥇 Juara 1',
      desc: 'Otomatis diberikan saat admin memilih pemenang juara 1 turnamen',
      auto: true,
    },
    mvp: {
      label: '⭐ MVP',
      desc: 'Otomatis diberikan saat admin memilih MVP turnamen',
      auto: true,
    },
    sawer_bronze: {
      label: '🥉 Bronze Sawer',
      desc: 'Sawer ≥ 10K dalam seminggu',
      auto: false,
    },
    sawer_silver: {
      label: '🥈 Silver Sawer',
      desc: 'Sawer ≥ 50K dalam seminggu',
      auto: false,
    },
    sawer_gold: {
      label: '🥇 Gold Sawer',
      desc: 'Sawer ≥ 100K dalam seminggu',
      auto: false,
    },
    sawer_diamond: {
      label: '💎 Diamond Sawer',
      desc: 'Sawer ≥ 200K dalam seminggu — tier tertinggi!',
      auto: false,
    },
    donor: {
      label: '❤️ Donatur',
      desc: 'Diberikan manual oleh admin setelah donasi. Badge hati ❤️ permanen tersisa setelah skin expired!',
      auto: false,
    },
  };

  const item = info[type];
  if (!item) return null;

  return (
    <div className="bg-muted/10 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[10px] font-semibold">{item.label}</span>
        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
          item.auto
            ? 'bg-green-500/15 text-green-400'
            : 'bg-amber-500/15 text-amber-400'
        }`}>
          {item.auto ? 'OTOMATIS' : 'MANUAL'}
        </span>
      </div>
      <p className="text-[9px] text-muted-foreground">{item.desc}</p>
    </div>
  );
}
