'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy, Scale,
  Save, Loader2, BookOpen, Plus, Trash2, GripVertical,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════
   ADMIN — KONTEN DIVISI TAB
   CMS inputs for Peraturan / Rules page in Division Dashboard
   Uses CMS settings key-value pairs (prefix: peraturan_)
   ═══════════════════════════════════════════════════════════════ */

/* ─── Rule Item editor (one row: label + value + highlight toggle) ─── */
function RuleItemEditor({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: { label: string; value: string; highlight: boolean };
  index: number;
  onChange: (index: number, item: { label: string; value: string; highlight: boolean }) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 group">
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
      <Input
        value={item.label}
        onChange={(e) => onChange(index, { ...item, label: e.target.value })}
        className="text-xs h-8 flex-1"
        placeholder="Label (contoh: Menang Pertandingan)"
      />
      <Input
        value={item.value}
        onChange={(e) => onChange(index, { ...item, value: e.target.value })}
        className="text-xs h-8 flex-1"
        placeholder="Value (contoh: +3 Poin)"
      />
      <Button
        size="sm"
        variant={item.highlight ? 'default' : 'outline'}
        className={`text-[9px] h-8 px-2 shrink-0 ${item.highlight ? 'bg-idm-gold-warm/80 hover:bg-idm-gold-warm/60 text-black' : ''}`}
        onClick={() => onChange(index, { ...item, highlight: !item.highlight })}
      >
        {item.highlight ? '★' : '☆'}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10 shrink-0"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

/* ─── Rule Section editor (a card with title + list of items) ─── */
function RuleSectionEditor({
  title,
  sectionKey,
  icon: Icon,
  items,
  onItemsChange,
  onTitleChange,
}: {
  title: string;
  sectionKey: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { label: string; value: string; highlight: boolean }[];
  onItemsChange: (items: { label: string; value: string; highlight: boolean }[]) => void;
  onTitleChange: (title: string) => void;
}) {
  const handleItemChange = (index: number, item: { label: string; value: string; highlight: boolean }) => {
    const updated = [...items];
    updated[index] = item;
    onItemsChange(updated);
  };

  const handleRemove = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    onItemsChange([...items, { label: '', value: '', highlight: false }]);
  };

  return (
    <Card className="border border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-idm-gold-warm/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-idm-gold-warm" />
          </div>
          <div className="flex-1 min-w-0">
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="text-sm font-semibold h-8"
              placeholder="Judul Section"
            />
          </div>
          <Badge className="text-[8px] border-0 bg-idm-gold-warm/10 text-idm-gold-warm shrink-0">{items.length} item</Badge>
        </div>

        <div className="space-y-2">
          {items.map((item, i) => (
            <RuleItemEditor
              key={i}
              item={item}
              index={i}
              onChange={handleItemChange}
              onRemove={handleRemove}
            />
          ))}
        </div>

        <Button
          size="sm"
          variant="outline"
          className="text-[10px] h-7 w-full"
          onClick={handleAdd}
        >
          <Plus className="w-3 h-3 mr-1" /> Tambah Baris
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─── Parse JSON items from CMS setting string ─── */
function parseItems(value: string | undefined, fallback: { label: string; value: string; highlight: boolean }[]): { label: string; value: string; highlight: boolean }[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
    return fallback;
  } catch {
    return fallback;
  }
}

/* ═══ Main Component ═══ */
export function AdminDivisionContentTab() {
  const qc = useQueryClient();

  /* ── Fetch CMS settings ── */
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['cms-settings'],
    queryFn: async () => {
      const res = await fetch('/api/cms/settings', { credentials: 'include' });
      return res.json() as Promise<{ settings: { id: string; key: string; value: string; type: string }[]; map: Record<string, string> }>;
    },
  });

  const settingsMap = settingsData?.map || {};

  /* ── Local form state (initialized from CMS) ── */
  const [formState, setFormState] = useState<Record<string, string> | null>(null);
  const form = formState ?? settingsMap;
  const updateForm = (updates: Partial<Record<string, string>>) => {
    setFormState(prev => ({ ...settingsMap, ...prev, ...updates }) as Record<string, string>);
  };

  /* ── Default fallback data — sesuai logika backend score/route.ts ── */
  const defaults = {
    peraturan_subtitle: 'Panduan lengkap sistem poin dan peraturan pertandingan Tarkam IDM.',
    peraturan_poin_title: 'Sistem Poin Tarkam',
    peraturan_poin_items: JSON.stringify([
      { label: 'Menang Pertandingan', value: '+2 Poin', highlight: true },
      { label: 'Partisipasi Turnamen', value: '+1 Poin (sekali/tournament)', highlight: true },
      { label: 'Seri / Draw (Grup)', value: '+1 Poin', highlight: false },
      { label: 'Kalah Pertandingan', value: '0 Poin', highlight: false },
      { label: 'MVP Turnamen', value: 'Sesuai Hadiah', highlight: true },
      { label: 'Juara 1/2/3', value: 'Sesuai Hadiah', highlight: true },
    ]),
    peraturan_match_title: 'Peraturan Pertandingan',
    peraturan_match_items: JSON.stringify([
      { label: 'Peserta wajib hadir', value: 'Tepat Waktu', highlight: true },
      { label: 'Penilaian', value: 'Oleh Juri', highlight: false },
      { label: 'Keputusan Juri', value: 'Final & Binding', highlight: true },
      { label: 'MVP Dipilih', value: 'Oleh Organizer', highlight: false },
      { label: 'Hasil Diumumkan', value: 'Real-time', highlight: true },
    ]),
  };

  /* ── Parsed items from form/CMS ── */
  const poinItems = parseItems(form.peraturan_poin_items, parseItems(defaults.peraturan_poin_items, []));
  const matchItems = parseItems(form.peraturan_match_items, parseItems(defaults.peraturan_match_items, []));

  /* ── Batch save mutation ── */
  const saveMutation = useMutation({
    mutationFn: async (items: { key: string; value: string; type?: string }[]) => {
      const res = await fetch('/api/cms/settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      setFormState(null);
      qc.invalidateQueries({ queryKey: ['cms-settings'] });
      qc.invalidateQueries({ queryKey: ['cms-content'] });
      toast.success('Konten Divisi berhasil disimpan!');
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  /* ── Save handler ── */
  const handleSave = () => {
    saveMutation.mutate([
      { key: 'peraturan_subtitle', value: form.peraturan_subtitle || defaults.peraturan_subtitle, type: 'text' },
      { key: 'peraturan_poin_title', value: form.peraturan_poin_title || defaults.peraturan_poin_title, type: 'text' },
      { key: 'peraturan_poin_items', value: form.peraturan_poin_items || defaults.peraturan_poin_items, type: 'json' },
      { key: 'peraturan_match_title', value: form.peraturan_match_title || defaults.peraturan_match_title, type: 'text' },
      { key: 'peraturan_match_items', value: form.peraturan_match_items || defaults.peraturan_match_items, type: 'json' },
    ]);
  };

  /* ── Reset to defaults ── */
  const handleReset = () => {
    setFormState({ ...defaults });
    toast.info('Form direset ke default. Klik Simpan untuk menyimpan.');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-idm-gold-warm" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-idm-gold-warm" />
          <h2 className="text-lg font-bold text-gradient-fury">Konten Divisi</h2>
          <Badge className="bg-idm-gold-warm/10 text-idm-gold-warm text-[10px] border-0">PERATURAN</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-[10px] h-8"
            onClick={handleReset}
          >
            Reset Default
          </Button>
          <Button
            size="sm"
            className="text-[10px] bg-idm-gold-warm hover:bg-[#D69E2E] text-black"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
            Simpan Semua
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Kelola konten halaman Peraturan di Division Dashboard. Perubahan langsung terlihat setelah simpan. Klik &quot;Reset Default&quot; untuk mengembalikan ke nilai bawaan.
      </p>

      {/* ── Subtitle / Deskripsi ── */}
      <Card className="border border-border/50">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-idm-gold-warm" /> Deskripsi Halaman
          </h3>
          <div>
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Subtitle Peraturan</Label>
            <Textarea
              value={form.peraturan_subtitle || ''}
              onChange={(e) => updateForm({ peraturan_subtitle: e.target.value })}
              className="text-sm min-h-[50px]"
              placeholder={defaults.peraturan_subtitle}
            />
            <p className="text-[9px] text-muted-foreground/60 mt-0.5">Teks deskripsi di bawah judul &quot;Peraturan&quot;</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Sistem Poin ── */}
      <RuleSectionEditor
        title={form.peraturan_poin_title || defaults.peraturan_poin_title}
        sectionKey="poin"
        icon={Trophy}
        items={poinItems}
        onTitleChange={(title) => updateForm({ peraturan_poin_title: title })}
        onItemsChange={(items) => updateForm({ peraturan_poin_items: JSON.stringify(items) })}
      />

      {/* ── Peraturan Pertandingan ── */}
      <RuleSectionEditor
        title={form.peraturan_match_title || defaults.peraturan_match_title}
        sectionKey="match"
        icon={Scale}
        items={matchItems}
        onTitleChange={(title) => updateForm({ peraturan_match_title: title })}
        onItemsChange={(items) => updateForm({ peraturan_match_items: JSON.stringify(items) })}
      />

      {/* ── Bottom Save Bar ── */}
      <div className="sticky bottom-0 bg-background/95 border-t border-border/50 p-4 sm:p-5 -mx-4 -mb-4 rounded-b-xl flex items-center justify-between z-20">
        <p className="text-[10px] text-muted-foreground">
          {Object.keys(form).filter(k => k.startsWith('peraturan_')).length} pengaturan divisi
        </p>
        <Button
          size="sm"
          className="text-[10px] bg-idm-gold-warm hover:bg-[#D69E2E] text-black"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
          Simpan Semua
        </Button>
      </div>
    </div>
  );
}
