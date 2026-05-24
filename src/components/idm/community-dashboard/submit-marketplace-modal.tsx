'use client';

import { useState, useEffect } from 'react';
import {
  X, ShoppingBag, Upload, CheckCircle, AlertCircle,
  UserCheck, Sparkles, Gamepad2, Package, Tag,
  Loader2, LogIn, ShieldCheck, Plus, Trash2, Image as ImageIcon
} from 'lucide-react';
import Image from 'next/image';
import { getOptimizedCloudinaryUrl } from '@/lib/utils';
import { compressImage } from '@/lib/image-compress';
import { useAppStore } from '@/lib/store';

/* ═══════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════ */
interface SubmitMarketplaceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onLoginRequired?: () => void;
}

type CategoryOption = 'ava' | 'item' | 'char' | 'jasa' | 'dll';

/* ═══════════════════════════════════════════════════════
   CATEGORY CONFIG — Simplified
   ═══════════════════════════════════════════════════════ */
const CATEGORIES: { id: CategoryOption; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'ava', label: 'Ava', icon: <UserCheck className="w-4 h-4" />, desc: 'Avatar, skin' },
  { id: 'item', label: 'Item', icon: <Package className="w-4 h-4" />, desc: 'Item game' },
  { id: 'char', label: 'Char', icon: <Sparkles className="w-4 h-4" />, desc: 'Karakter' },
  { id: 'jasa', label: 'Jasa', icon: <Gamepad2 className="w-4 h-4" />, desc: 'GB, Joki, dll' },
  { id: 'dll', label: 'Dll', icon: <Tag className="w-4 h-4" />, desc: 'Lain-lain' },
];

const MAX_IMAGES = 5;

/* ═══════════════════════════════════════════════════════
   SINGLE IMAGE UPLOADER — Upload ke Cloudinary (player auth)
   ═══════════════════════════════════════════════════════ */
function ImageUploader({
  index,
  url,
  onChange,
  onRemove,
  canRemove,
  isFirst,
}: {
  index: number;
  url: string;
  onChange: (url: string) => void;
  onRemove: () => void;
  canRemove: boolean;
  isFirst: boolean;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const fileInputRef = useState<HTMLInputElement | null>(null);

  async function handleFileSelect(file: File) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Hanya file gambar yang diperbolehkan');
      return;
    }
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal 5MB');
      return;
    }

    setUploadError('');
    setIsUploading(true);

    try {
      // ★ Compress image before base64 to avoid Vercel 413 error
      const base64 = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8,
        maxOutputBytes: 3 * 1024 * 1024, // target under 3MB before base64 (safe for Vercel 4.5MB limit)
      });

      // Show local preview while uploading
      setLocalPreview(base64);

      // Upload to Cloudinary via player-authenticated endpoint
      const res = await fetch('/api/marketplace/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ file: base64 }),
      });

      // Safely parse JSON — handle empty/HTML error responses
      let data: { url?: string; error?: string; publicId?: string };
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        if (res.status === 401) throw new Error('Login diperlukan untuk upload');
        if (res.status === 413) throw new Error('File terlalu besar — maksimal 5MB');
        if (res.status >= 500) throw new Error('Upload gagal — server error, coba lagi nanti');
        throw new Error('Upload gagal — server tidak merespons dengan benar');
      }

      if (!res.ok) {
        throw new Error(data.error || `Upload gagal (HTTP ${res.status})`);
      }

      // Set the URL from Cloudinary response
      onChange(data.url || '');
      setLocalPreview(null);
    } catch (err: any) {
      setUploadError(err.message || 'Upload gagal, coba lagi');
      setLocalPreview(null);
    } finally {
      setIsUploading(false);
    }
  }

  function triggerFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFileSelect(file);
    };
    input.click();
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {/* Image number indicator */}
        <div className="w-6 h-6 rounded bg-orange-500/10 flex items-center justify-center flex-shrink-0">
          <span className="text-[9px] font-bold text-orange-400">{index + 1}</span>
        </div>

        {/* URL input */}
        <input
          type="url"
          placeholder={isFirst ? 'URL gambar utama (wajib)' : 'URL gambar (opsional)'}
          value={url}
          onChange={(e) => onChange(e.target.value)}
          disabled={isUploading}
          className="flex-1 px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-orange-500/30 focus:ring-1 focus:ring-orange-500/20 transition-colors disabled:opacity-50"
        />

        {/* Upload button */}
        <button
          type="button"
          onClick={triggerFileInput}
          disabled={isUploading}
          className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-orange-500/10 border border-orange-500/15 text-[10px] font-bold text-orange-400 hover:bg-orange-500/20 transition-colors cursor-pointer flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Upload className="w-3 h-3" />
          )}
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>

        {/* Remove button */}
        {canRemove && !isUploading && (
          <button
            type="button"
            onClick={onRemove}
            className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer flex-shrink-0"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Upload error */}
      {uploadError && (
        <p className="ml-8 text-[9px] text-red-400">{uploadError}</p>
      )}

      {/* Preview thumbnail */}
      {(url || localPreview) && (
        <div className="ml-8 relative w-20 h-14 rounded-lg overflow-hidden border border-orange-500/15 bg-muted/20 group">
          <Image
            src={getOptimizedCloudinaryUrl(localPreview || url, 160)}
            alt={`Preview ${index + 1}`}
            fill
            className="w-full h-full object-cover"
            sizes="80px"
            unoptimized
          />
          {!isUploading && url && (
            <button
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={triggerFileInput}
              title="Ganti gambar"
            >
              <Upload className="w-3.5 h-3.5 text-white" />
            </button>
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SUBMIT MARKETPLACE MODAL — Orange theme + Upload
   ═══════════════════════════════════════════════════════ */
export function SubmitMarketplaceModal({ open, onClose, onSuccess, onLoginRequired }: SubmitMarketplaceModalProps) {
  const { playerAuth } = useAppStore();
  const isLoggedIn = playerAuth.isAuthenticated && !!playerAuth.account;

  const [form, setForm] = useState({
    sellerWhatsapp: '',
    title: '',
    description: '',
    price: '' as string | number,
    category: 'item' as CategoryOption,
    imageUrls: [''] as string[], // Up to 5 image URLs
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Auto-fill WhatsApp from player phone when logged in
  useEffect(() => {
    if (isLoggedIn && (playerAuth.account?.player as Record<string, unknown>)?.phone && !form.sellerWhatsapp) {
      setForm(p => ({ ...p, sellerWhatsapp: ((playerAuth.account!.player as unknown as { phone: string })).phone }));
    }
  }, [isLoggedIn, playerAuth.account]);

  function handleClose() {
    if (isSubmitting) return;
    setSubmitResult('idle');
    setErrorMessage('');
    onClose();
  }

  function addImageField() {
    if (form.imageUrls.length < MAX_IMAGES) {
      setForm(p => ({ ...p, imageUrls: [...p.imageUrls, ''] }));
    }
  }

  function removeImageField(index: number) {
    setForm(p => ({
      ...p,
      imageUrls: p.imageUrls.filter((_, i) => i !== index),
    }));
  }

  function updateImageUrl(index: number, url: string) {
    setForm(p => ({
      ...p,
      imageUrls: p.imageUrls.map((u, i) => i === index ? url : u),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitResult('idle');
    setErrorMessage('');

    try {
      const priceNum = typeof form.price === 'string' ? parseInt(form.price) || 0 : form.price;

      // Collect valid image URLs
      const validImages = form.imageUrls
        .map(url => url.trim())
        .filter(url => url.length > 0);

      const res = await fetch('/api/marketplace/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sellerWhatsapp: form.sellerWhatsapp || undefined,
          title: form.title,
          description: form.description,
          price: priceNum,
          category: form.category,
          imageUrl: validImages[0] || undefined,
          images: validImages.length > 0 ? validImages : undefined,
        }),
      });

      // Safely parse JSON — handle empty/HTML error responses
      let data: { item?: unknown; error?: string; message?: string };
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        if (res.status === 401) throw new Error('Login diperlukan');
        if (res.status >= 500) throw new Error('Server error — coba lagi nanti');
        throw new Error('Gagal mengajukan iklan — server tidak merespons');
      }

      if (!res.ok) {
        setSubmitResult('error');
        setErrorMessage(data.error || 'Gagal mengajukan iklan');
        return;
      }

      setSubmitResult('success');
      onSuccess();

      setTimeout(() => {
        setForm({
          sellerWhatsapp: '',
          title: '',
          description: '',
          price: '',
          category: 'item',
          imageUrls: [''],
        });
        setSubmitResult('idle');
      }, 2000);
    } catch {
      setSubmitResult('error');
      setErrorMessage('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const playerGamertag = playerAuth.account?.player?.gamertag || '';
  const playerAvatar = playerAuth.account?.player?.avatar || null;
  const validImageCount = form.imageUrls.filter(u => u.trim()).length;

  return (
    <>
      {open && (
        <div
          className="modal-backdrop modal-backdrop-enter z-50 p-4"
          onClick={handleClose}
        >
          <div
            className="modal-container modal-container-md modal-enter-slide"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — Orange theme */}
            <div className="modal-header">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Pasang Iklan</h3>
                  <p className="text-[10px] text-muted-foreground">Jual item atau jasa game kamu</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="modal-close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="modal-body">
            {/* Not Logged In State */}
            {!isLoggedIn ? (
              <div className="flex flex-col items-center justify-center py-10 px-6">
                <div className="w-14 h-14 rounded-full bg-orange-500/10 flex items-center justify-center mb-3">
                  <LogIn className="w-7 h-7 text-orange-400/60" />
                </div>
                <p className="text-sm font-bold text-foreground mb-1">Login Diperlukan</p>
                <p className="text-[10px] text-muted-foreground text-center max-w-[240px] mb-4">
                  Kamu harus login dengan akun gamertag terlebih dahulu untuk memasang iklan di marketplace. Ini agar identitas penjual bisa diverifikasi.
                </p>
                <button
                  onClick={() => {
                    // Close this modal first, then open login modal after a brief delay
                    // to avoid state batching race condition between the two modals
                    handleClose();
                    if (onLoginRequired) {
                      setTimeout(onLoginRequired, 50);
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Login Sekarang
                </button>
              </div>
            ) : submitResult === 'success' ? (
              /* Success State */
              <div className="flex flex-col items-center justify-center py-10 px-6">
              <div
                className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mb-3 animate-scale-in"
              >
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
                <p className="text-sm font-bold text-foreground mb-1">Iklan Berhasil Diajukan!</p>
                <p className="text-[10px] text-muted-foreground text-center max-w-[240px]">
                  Iklan kamu menunggu approval admin. Setelah disetujui, iklan akan otomatis tampil di marketplace.
                </p>
              </div>
            ) : (
              /* Form — only shown when logged in, Orange theme */
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* Verified Seller Badge */}
                <div className="flex items-center gap-3 p-3 sm:p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
                  <div className="relative flex-shrink-0">
                    {playerAvatar ? (
                      <Image src={playerAvatar} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-orange-500/15 flex items-center justify-center">
                        <span className="text-sm font-bold text-orange-400">{playerGamertag.charAt(0)}</span>
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                      <ShieldCheck className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground">{playerGamertag}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span className="text-[9px] text-emerald-400 font-semibold">Penjual Terverifikasi</span>
                    </div>
                  </div>
                </div>

                {/* Category Selection — Simplified */}
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Kategori</label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, category: cat.id }))}
                        className={`flex flex-col items-center gap-1 p-2 rounded-2xl border text-[9px] font-semibold transition-all cursor-pointer ${
                          form.category === cat.id
                            ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                            : 'bg-muted/5 border-border/15 text-muted-foreground hover:bg-muted/10 hover:text-foreground'
                        }`}
                      >
                        {cat.icon}
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Item Details */}
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Detail Iklan</label>
                  <input
                    type="text"
                    required
                    placeholder="Judul item / jasa"
                    value={form.title}
                    onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                    maxLength={100}
                    className="w-full px-3 py-2.5 rounded-2xl bg-muted/30 border border-border/30 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-orange-500/30 focus:ring-1 focus:ring-orange-500/20 transition-colors"
                  />
                  <textarea
                    required
                    placeholder="Deskripsi singkat item/jasa kamu..."
                    value={form.description}
                    onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                    maxLength={500}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-2xl bg-muted/30 border border-border/30 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-orange-500/30 focus:ring-1 focus:ring-orange-500/20 transition-colors resize-none"
                  />
                  <div className="text-right">
                    <span className="text-[9px] text-muted-foreground/30">{form.description.length}/500</span>
                  </div>
                </div>

                {/* ═══ Screenshot Upload — dengan Cloudinary ═══ */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-3 h-3 text-orange-400" />
                      Screenshot ({validImageCount}/{MAX_IMAGES})
                    </label>
                    {form.imageUrls.length < MAX_IMAGES && (
                      <button
                        type="button"
                        onClick={addImageField}
                        className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/15 text-[9px] font-bold text-orange-400 hover:bg-orange-500/20 transition-colors cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        Tambah
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {form.imageUrls.map((url, i) => (
                      <ImageUploader
                        key={i}
                        index={i}
                        url={url}
                        onChange={(newUrl) => updateImageUrl(i, newUrl)}
                        onRemove={() => removeImageField(i)}
                        canRemove={form.imageUrls.length > 1}
                        isFirst={i === 0}
                      />
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground/30">Klik &quot;Upload&quot; untuk mengupload gambar dari HP/komputer kamu (otomatis tersimpan di Cloudinary). Atau tempel URL gambar langsung. Maksimal {MAX_IMAGES} screenshot. Gambar pertama jadi thumbnail.</p>
                </div>

                {/* Price — Orange */}
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Harga (IDR)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-400/60">Rp</span>
                    <input
                      type="number"
                      required
                      placeholder="0"
                      min="0"
                      value={form.price}
                      onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-muted/30 border border-border/30 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-orange-500/30 focus:ring-1 focus:ring-orange-500/20 transition-colors"
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground/30">Masukkan 0 jika gratis</p>
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">WhatsApp (opsional)</label>
                  <input
                    type="tel"
                    placeholder="08xxx — untuk dihubungi pembeli"
                    value={form.sellerWhatsapp}
                    onChange={(e) => setForm(p => ({ ...p, sellerWhatsapp: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-2xl bg-muted/30 border border-border/30 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-orange-500/30 focus:ring-1 focus:ring-orange-500/20 transition-colors"
                  />
                </div>

                {/* Error Message */}
                {submitResult === 'error' && (
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 animate-fade-enter-sm"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <p className="text-[10px] text-red-400">{errorMessage}</p>
                </div>
                )}

                {/* Info Note — Orange */}
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-2xl bg-orange-500/5 border border-orange-500/10">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-400/50 flex-shrink-0 mt-0.5" />
                  <p className="text-[9px] text-muted-foreground/50 leading-relaxed">
                    Iklan kamu akan ditinjau admin terlebih dahulu sebelum tampil di marketplace. Maksimal 5 pengajuan per hari. Nama penjual otomatis menggunakan gamertag kamu.
                  </p>
                </div>

                {/* Submit Button — Orange */}
                <button
                  type="submit"
                  disabled={isSubmitting || !form.title || !form.description || !form.price}
                  className="w-full py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Mengajukan...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Ajukan Iklan
                    </>
                  )}
                </button>
              </form>
            )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

