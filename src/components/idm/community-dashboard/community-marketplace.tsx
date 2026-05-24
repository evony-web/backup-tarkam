'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag, Search, MessageCircle, Crown, Sparkles,
  Shirt, Gamepad2, UserCheck, Wand2, Package, ChevronRight,
  Flame, Tag, Plus, ShieldCheck, User, Box, Briefcase, Ellipsis
} from 'lucide-react';
import Image from 'next/image';
import { SubmitMarketplaceModal } from './submit-marketplace-modal';
import { MarketplaceDetailModal } from './marketplace-detail-modal';

/* ═══════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════ */
interface MarketplaceItem {
  id: string;
  playerId?: string;
  sellerName: string;
  sellerAvatar?: string;
  sellerWhatsapp?: string;
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  images?: string; // JSON array string
  isPremium: boolean;
  createdAt: string;
}

type CategoryFilter = 'all' | 'ava' | 'item' | 'char' | 'jasa' | 'dll';

/* ═══════════════════════════════════════════════════════
   CATEGORY CONFIG — Simplified
   ═══════════════════════════════════════════════════════ */
const CATEGORIES: { id: CategoryFilter; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'all', label: 'Semua', icon: <ShoppingBag className="w-3.5 h-3.5" />, color: 'text-orange-400' },
  { id: 'ava', label: 'Ava', icon: <UserCheck className="w-3.5 h-3.5" />, color: 'text-cyan-400' },
  { id: 'item', label: 'Item', icon: <Package className="w-3.5 h-3.5" />, color: 'text-orange-400' },
  { id: 'char', label: 'Char', icon: <Sparkles className="w-3.5 h-3.5" />, color: 'text-purple-400' },
  { id: 'jasa', label: 'Jasa', icon: <Gamepad2 className="w-3.5 h-3.5" />, color: 'text-emerald-400' },
  { id: 'dll', label: 'Dll', icon: <Tag className="w-3.5 h-3.5" />, color: 'text-muted-foreground' },
];

const CATEGORY_COLORS: Record<string, string> = {
  ava: 'from-cyan-500/20 to-cyan-900/10 border-cyan-500/20',
  item: 'from-orange-500/20 to-orange-900/10 border-orange-500/20',
  char: 'from-purple-500/20 to-purple-900/10 border-purple-500/20',
  jasa: 'from-emerald-500/20 to-emerald-900/10 border-emerald-500/20',
  dll: 'from-muted-foreground/20 to-muted/10 border-border/20',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  ava: <UserCheck className="w-4 h-4" />,
  item: <Package className="w-4 h-4" />,
  char: <Sparkles className="w-4 h-4" />,
  jasa: <Gamepad2 className="w-4 h-4" />,
  dll: <Tag className="w-4 h-4" />,
};

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */
function formatPrice(price: number): string {
  if (price === 0) return 'GRATIS';
  return `Rp ${price.toLocaleString('id-ID')}`;
}

function getCategoryLabel(cat: string): string {
  return CATEGORIES.find(c => c.id === cat)?.label ?? cat;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}j lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}h lalu`;
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function parseImages(item: MarketplaceItem): string[] {
  if (item.images) {
    try {
      const parsed = JSON.parse(item.images);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* fall through */ }
  }
  if (item.imageUrl) return [item.imageUrl];
  return [];
}

/* ═══════════════════════════════════════════════════════
   MARKETPLACE SECTION — Orange theme
   ═══════════════════════════════════════════════════════ */
export function CommunityMarketplace({ onLoginRequired }: { onLoginRequired?: () => void }) {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<MarketplaceItem | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await fetch(`/api/marketplace?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const premiumItems = items.filter(i => i.isPremium);
  const regularItems = items.filter(i => !i.isPremium);

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">Marketplace</h3>
            <p className="text-[10px] text-muted-foreground">Jual-beli item & jasa game</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-muted-foreground/50">
            {items.length} iklan
          </div>
          {/* Pasang Iklan Button — Orange */}
          <button
            onClick={() => setSubmitOpen(true)}
            className="compact-pill flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/25 text-[10px] sm:text-xs font-bold text-orange-400 hover:bg-orange-500/25 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Pasang Iklan</span>
            <span className="sm:hidden">Jual</span>
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
        <input
          type="text"
          placeholder="Cari item atau jasa..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-muted/30 border border-orange-500/10 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-orange-500/30 focus:ring-1 focus:ring-orange-500/20 transition-colors"
        />
      </div>

      {/* ── Category Pills ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`compact-pill flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap border transition-all duration-200 cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                : 'bg-idm-gold-warm/5 border border-idm-gold-warm/10 text-muted-foreground hover:bg-idm-gold-warm/10 hover:text-foreground'
            }`}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Premium Featured ── */}
      {premiumItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Featured</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {premiumItems.map((item) => (
              <MarketplaceCard key={item.id} item={item} isPremium onClick={() => setDetailItem(item)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Regular Items — Full width grid ── */}
      <div className="space-y-2">
        {regularItems.length > 0 && premiumItems.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-muted-foreground/50" />
            <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Semua Iklan</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {regularItems.map((item) => (
            <MarketplaceCard key={item.id} item={item} onClick={() => setDetailItem(item)} />
          ))}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-400 rounded-full animate-spin" />
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && items.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-10 text-center animate-fade-enter-sm"
        >
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-3">
            <ShoppingBag className="w-7 h-7 text-orange-400/40" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground/60 mb-1">Belum Ada Iklan</p>
          <p className="text-[10px] text-muted-foreground/40 max-w-[200px] mb-4">
            {activeCategory !== 'all'
              ? `Belum ada iklan di kategori ${getCategoryLabel(activeCategory)}`
              : 'Marketplace segera hadir!'}
          </p>
          <button
            onClick={() => setSubmitOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-[10px] font-bold text-orange-400 hover:bg-orange-500/20 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Jadilah yang pertama menjual!
          </button>
        </div>
      )}

      {/* ── Submit Modal ── */}
      <SubmitMarketplaceModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSuccess={fetchItems}
        onLoginRequired={onLoginRequired}
      />

      {/* ── Detail Modal ── */}
      <MarketplaceDetailModal
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        item={detailItem}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MARKETPLACE CARD — Orange theme, clickable
   ═══════════════════════════════════════════════════════ */
function MarketplaceCard({ item, isPremium = false, onClick }: { item: MarketplaceItem; isPremium?: boolean; onClick: () => void }) {
  const catColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.dll;
  const catIcon = CATEGORY_ICONS[item.category] || <Tag className="w-4 h-4" />;
  const images = parseImages(item);
  const firstImage = images[0];

  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl border overflow-hidden transition-all duration-200 hover:scale-[1.01] cursor-pointer animate-fade-enter-sm ${
        isPremium
          ? 'bg-gradient-to-br from-orange-500/10 via-transparent to-orange-500/5 border-orange-500/25 shadow-[0_0_20px_rgba(249,115,22,0.06)]'
          : 'bg-idm-gold-warm/5 border border-idm-gold-warm/10 hover:border-orange-500/15'
      }`}
    >
      {/* Premium badge — Orange */}
      {isPremium && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30">
          <Crown className="w-2.5 h-2.5 text-orange-400" />
          <span className="text-[8px] font-bold text-orange-300 uppercase tracking-wider">Premium</span>
        </div>
      )}

      {/* Image preview area */}
      {firstImage ? (
        <div className="relative w-full h-28 sm:h-32 overflow-hidden">
          <Image src={firstImage} alt={item.title} fill className="w-full h-full object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
          {images.length > 1 && (
            <div className="absolute bottom-12 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm">
              <Package className="w-2.5 h-2.5 text-white/80" />
              <span className="text-[8px] font-bold text-white/80">{images.length}</span>
            </div>
          )}
        </div>
      ) : (
        <div className={`w-full h-28 sm:h-32 bg-gradient-to-br ${catColor} flex items-center justify-center`}>
          <div className="text-muted-foreground/20">
            {catIcon}
          </div>
        </div>
      )}

      <div className="p-3 sm:p-4">
        {/* Category tag */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`text-[8px] font-bold uppercase tracking-wider ${
            CATEGORIES.find(c => c.id === item.category)?.color || 'text-muted-foreground'
          }`}>
            {getCategoryLabel(item.category)}
          </span>
          <span className="text-muted-foreground/20">•</span>
          <span className="text-[8px] text-muted-foreground/40">{timeAgo(item.createdAt)}</span>
        </div>

        {/* Title */}
        <h4 className="text-xs sm:text-sm font-bold text-foreground truncate mb-0.5 pr-12">
          {item.title}
        </h4>

        {/* Description */}
        <p className="text-[10px] sm:text-xs text-muted-foreground/60 line-clamp-2 mb-2 leading-relaxed">
          {item.description}
        </p>

        {/* Price + Seller row */}
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs sm:text-sm font-black ${
            item.price === 0 ? 'text-emerald-400' : 'text-orange-400'
          }`}>
            {formatPrice(item.price)}
          </span>

          {/* Seller mini */}
          <div className="flex items-center gap-1">
            {item.sellerAvatar ? (
              <Image src={item.sellerAvatar} alt="" width={16} height={16} className="w-4 h-4 rounded-full" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-orange-500/10 flex items-center justify-center">
                <span className="text-[7px] font-bold text-orange-400/60">{item.sellerName.charAt(0)}</span>
              </div>
            )}
            <span className="text-[9px] text-muted-foreground/50 font-medium truncate max-w-[60px]">{item.sellerName}</span>
            {item.playerId && (
              <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
