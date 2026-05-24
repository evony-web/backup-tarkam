'use client';

import { Share2, MessageCircle, Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface ShareButtonProps {
  title: string;
  description?: string;
  url?: string;
  variant?: 'icon' | 'button';
  className?: string;
}

export function ShareButton({ title, description, url, variant = 'button', className = '' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const shareText = description ? `${title} — ${description}` : title;

  const shareToWhatsApp = useCallback(() => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
    window.open(waUrl, '_blank', 'noopener');
    toast.success('Dibagikan ke WhatsApp!');
  }, [shareText, shareUrl]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link disalin!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Gagal menyalin link');
    }
  }, [shareUrl]);

  const nativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: description, url: shareUrl });
        return;
      } catch {
        // Fallback to manual options
      }
    }
  }, [title, description, shareUrl]);

  if (variant === 'icon') {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={nativeShare}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="Bagikan"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button
        onClick={shareToWhatsApp}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 transition-colors min-h-[32px]"
        title="Bagikan ke WhatsApp"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">WhatsApp</span>
      </button>
      <button
        onClick={copyLink}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[32px]"
        title="Salin link"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{copied ? 'Tersalin!' : 'Salin'}</span>
      </button>
    </div>
  );
}
