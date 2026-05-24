'use client';

import { useState } from 'react';
import {
  X, MessageCircle, Crown, ShieldCheck, Tag,
  ChevronLeft, ChevronRight, ShoppingBag, Phone, Info
} from 'lucide-react';
import Image from 'next/image';

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

interface MarketplaceDetailModalProps {
  open: boolean;
  onClose: () => void;
  item: MarketplaceItem | null;
}

/* ═══════════════════════════════════════════════════════
   CATEGORY CONFIG
   ═══════════════════════════════════════════════════════ */
const CATEGORY_LABELS: Record<string, string> = {
  ava: 'Avatar',
  item: 'Item',
  char: 'Character',
  jasa: 'Jasa',
  dll: 'Lainnya',
};

const CATEGORY_COLORS: Record<string, string> = {
  ava: 'text-cyan-400',
  item: 'text-orange-400',
  char: 'text-purple-400',
  jasa: 'text-emerald-400',
  dll: 'text-muted-foreground',
};

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */
function formatPrice(price: number): string {
  if (price === 0) return 'GRATIS';
  return `Rp ${price.toLocaleString('id-ID')}`;
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
  // Try images field first (JSON array), fallback to imageUrl
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
   MARKETPLACE DETAIL MODAL — Orange theme
   Shows: Image gallery, seller info, price, description,
   WhatsApp contact, how to buy instructions
   ═══════════════════════════════════════════════════════ */
export function MarketplaceDetailModal({ open, onClose, item }: MarketplaceDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showWhatsApp, setShowWhatsApp] = useState(false);

  if (!item) return null;

  const images = parseImages(item);
  const catLabel = CATEGORY_LABELS[item.category] || item.category;
  const catColor = CATEGORY_COLORS[item.category] || 'text-muted-foreground';

  const handlePrevImage = () => {
    setCurrentImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1);
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0);
  };

  return (
    <>
            {open && (
              <div
                className="modal-backdrop modal-backdrop-enter z-50 p-4"
                onClick={onClose}
              >
                <div
                  className="modal-container modal-container-lg modal-enter-slide"
                  onClick={(e) => e.stopPropagation()}
                >
            {/* Close button */}
            <button
              onClick={onClose}
              className="modal-close-dark absolute top-3 right-3 z-20"
            >
              <X className="w-4 h-4" />
            </button>

            {/* ═══ Image Gallery ═══ */}
            {images.length > 0 ? (
              <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-orange-900/20 to-black/40 overflow-hidden">
                {/* Main image */}
              <Image
                    key={currentImageIndex}
                    src={images[currentImageIndex]}
                    alt={`${item.title} - ${currentImageIndex + 1}`}
                    fill
                    className="w-full h-full object-cover animate-fade-in"
                    sizes="(max-width: 640px) 100vw, 512px"
                  />

                {/* Navigation arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* Image counter */}
                {images.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentImageIndex(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                          i === currentImageIndex
                            ? 'bg-orange-400 w-4'
                            : 'bg-muted-foreground/40 hover:bg-muted-foreground/60'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Premium badge overlay */}
                {item.isPremium && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/80 backdrop-blur-sm">
                    <Crown className="w-3 h-3 text-white" />
                    <span className="text-[9px] font-bold text-white uppercase tracking-wider">Premium</span>
                  </div>
                )}
              </div>
            ) : (
              /* No image placeholder */
              <div className="w-full aspect-[4/3] bg-gradient-to-br from-orange-900/10 to-black/20 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <ShoppingBag className="w-12 h-12 text-orange-400/20" />
                  <p className="text-[10px] text-muted-foreground/30 mt-2">Tidak ada gambar</p>
                </div>
              </div>
            )}

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="flex gap-2 p-3 bg-black/10">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImageIndex(i)}
                    className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer flex-shrink-0 ${
                      i === currentImageIndex
                        ? 'border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.3)]'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Image src={img} alt="" fill className="w-full h-full object-cover" sizes="56px" />
                  </button>
                ))}
              </div>
            )}

            {/* ═══ Content Section ═══ */}
            <div className="modal-body-compact space-y-4">
              {/* Category + Time */}
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${catColor}`}>
                  {catLabel}
                </span>
                <span className="text-muted-foreground/20">•</span>
                <span className="text-[10px] text-muted-foreground/50">{timeAgo(item.createdAt)}</span>
                {item.playerId && (
                  <>
                    <span className="text-muted-foreground/20">•</span>
                    <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </span>
                  </>
                )}
              </div>

              {/* Title + Price */}
              <div>
                <h2 className="text-lg font-black text-foreground leading-tight mb-1.5">{item.title}</h2>
                <span className={`text-xl font-black ${item.price === 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {formatPrice(item.price)}
                </span>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Deskripsi</h3>
                <p className="text-sm text-muted-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {item.description}
                </p>
              </div>

              {/* ═══ Seller Info ═══ */}
              <div className="p-4 sm:p-5 rounded-2xl bg-orange-500/5 border border-orange-500/10">
                <h3 className="text-[10px] font-semibold text-orange-400/70 uppercase tracking-wider mb-2.5">Penjual</h3>
                <div className="flex items-center gap-3">
                  {item.sellerAvatar ? (
                    <Image src={item.sellerAvatar} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover border border-orange-500/15" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/15">
                      <span className="text-sm font-bold text-orange-400">{item.sellerName.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-foreground truncate">{item.sellerName}</span>
                      {item.playerId && (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      )}
                    </div>
                    {item.sellerWhatsapp && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-emerald-400/60" />
                        <span className="text-[11px] text-muted-foreground/60">{item.sellerWhatsapp}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ═══ How to Buy ═══ */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                <h3 className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-wider mb-2">Cara Membeli</h3>
                <ol className="space-y-1.5">
                  <li className="flex items-start gap-2 text-xs text-muted-foreground/70">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center text-[8px] font-bold text-emerald-400 flex-shrink-0 mt-0.5">1</span>
                    Klik tombol &quot;Hubungi via WhatsApp&quot; di bawah
                  </li>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground/70">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center text-[8px] font-bold text-emerald-400 flex-shrink-0 mt-0.5">2</span>
                    Chat penjual dan tentukan kesepakatan jual-beli
                  </li>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground/70">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center text-[8px] font-bold text-emerald-400 flex-shrink-0 mt-0.5">3</span>
                    Lakukan pembayaran sesuai kesepakatan
                  </li>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground/70">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center text-[8px] font-bold text-emerald-400 flex-shrink-0 mt-0.5">4</span>
                    Penjual akan mengirimkan item / menjalankan jasa
                  </li>
                </ol>
                <div className="flex items-start gap-1.5 mt-2.5 px-2 py-1.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                  <Info className="w-3 h-3 text-yellow-500/60 flex-shrink-0 mt-0.5" />
                  <p className="text-[9px] text-yellow-500/60 leading-relaxed">
                    Transaksi dilakukan di luar platform. Harap berhati-hati dan gunakan metode pembayaran yang aman.
                  </p>
                </div>
              </div>

              {/* ═══ CTA Buttons ═══ */}
              <div className="flex gap-2 pt-1">
                {item.sellerWhatsapp ? (
                  <a
                    href={`https://wa.me/${item.sellerWhatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Hubungi via WhatsApp
                  </a>
                ) : (
                  <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-muted/30 text-muted-foreground text-xs font-medium">
                    <Phone className="w-3.5 h-3.5" />
                    Tidak ada kontak penjual
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        )}
    </>
  );
}
