'use client';

import { useEffect, useCallback, useState } from 'react';

import { X, ExternalLink, Play } from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title?: string;
}

/**
 * Extracts YouTube video ID and start time from various URL formats:
 *  - https://www.youtube.com/watch?v=XXX
 *  - https://youtu.be/XXX
 *  - https://www.youtube.com/embed/XXX
 *  - https://youtube.com/watch?v=XXX&list=...
 *  - https://youtu.be/XXX?t=123  (timestamp)
 *  - https://www.youtube.com/watch?v=XXX&t=123s  (copy at current time)
 */
function parseYouTubeUrl(url: string): { id: string; startTime: number } | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  let id: string | null = null;
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) { id = match[1]; break; }
  }
  if (!id) return null;

  // Extract start time from ?t=123s or ?t=123 or &t=123s
  let startTime = 0;
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const t = urlObj.searchParams.get('t');
    if (t) {
      // Remove trailing 's' if present (e.g. "123s" → "123")
      const seconds = parseInt(t.replace(/s$/, ''), 10);
      if (!isNaN(seconds)) startTime = seconds;
    }
  } catch {
    // URL parse failed, try regex fallback
    const tMatch = url.match(/[?&]t=(\d+)s?/);
    if (tMatch) startTime = parseInt(tMatch[1], 10);
  }

  return { id, startTime };
}

export function VideoModal({ isOpen, onClose, videoUrl, title }: VideoModalProps) {
  /* ─── Resolve video source ─── */
  const ytInfo = parseYouTubeUrl(videoUrl);
  const youtubeId = ytInfo?.id ?? null;
  const isYouTube = youtubeId !== null;
  const youtubeWatchUrl = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}${ytInfo?.startTime ? `&t=${ytInfo.startTime}s` : ''}` : null;

  /* ─── Track iframe load state for fallback ─── */
  const [iframeError, setIframeError] = useState(false);
  const [fallbackDismissed, setFallbackDismissed] = useState(false);

  /* ─── Reset state when modal re-opens or video changes ─── */
  useEffect(() => {
    if (!isOpen) return;
    // Reset error state when modal opens with a (possibly new) video
    const timer = setTimeout(() => {
      setIframeError(true);
    }, 8000);
    return () => {
      clearTimeout(timer);
      // Cleanup: reset for next open
      setIframeError(false);
      setFallbackDismissed(false);
    };
  }, [isOpen, videoUrl]);

  /* ─── Escape key handler ─── */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  const showFallback = iframeError && !fallbackDismissed;

  return (
    <>
    {isOpen && (
      <div
        className="modal-backdrop-heavy modal-backdrop-enter z-[60] p-4 sm:p-6"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/90"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Content */}
        <div
          className="modal-container modal-container-lg modal-enter-slide"
          role="dialog"
          aria-modal="true"
          aria-label={title ?? 'Video player'}
        >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="modal-close-dark absolute top-3 right-3 z-50"
              aria-label="Close video"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title bar */}
            {title && (
              <div className="mb-2 px-1">
                <h3 className="text-sm font-semibold text-white/90 truncate">{title}</h3>
              </div>
            )}

            {/* Video container — 16:9 aspect ratio */}
            <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/40">
              <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                {isYouTube ? (
                  <>
                    {/* YouTube iframe — always rendered, persists even when fallback shows */}
                    <iframe
                      src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1${ytInfo?.startTime ? `&start=${ytInfo.startTime}` : ''}`}
                      title={title ?? 'YouTube video'}
                      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full"
                    />

                    {/* Fallback overlay — NON-BLOCKING: user can dismiss to retry iframe */}
                    {showFallback && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/85 backdrop-blur-sm animate-fade-enter-sm">
                        {/* YouTube thumbnail as background */}
                        <img
                          src={`https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`}
                          alt={title ?? 'Video thumbnail'}
                          className="absolute inset-0 w-full h-full object-cover opacity-20"
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (!img.dataset.fallback) {
                              img.dataset.fallback = '1';
                              img.src = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
                            }
                          }}
                        />

                        <div className="relative z-10 flex flex-col items-center gap-4">
                          {/* Watch on YouTube button */}
                          <a
                            href={youtubeWatchUrl ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center gap-3 group"
                          >
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600/25 border-2 border-red-500/50 flex items-center justify-center group-hover:bg-red-600/40 group-hover:border-red-500/70 group-hover:scale-110 transition-all duration-300">
                              <Play className="w-7 h-7 sm:w-9 sm:h-9 text-red-500 fill-red-500 ml-0.5" />
                            </div>
                            <span className="text-sm sm:text-base font-bold text-white tracking-wider">Watch on YouTube</span>
                          </a>

                          {/* Dismiss button — retry iframe / close fallback */}
                          <button
                            onClick={() => setFallbackDismissed(true)}
                            className="mt-1 text-[11px] font-semibold text-white/40 hover:text-white/70 transition-colors cursor-pointer underline underline-offset-2"
                          >
                            Coba lagi di sini
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    className="absolute inset-0 h-full w-full"
                    preload="metadata"
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
              </div>

              {/* YouTube direct link bar — always visible below video */}
              {isYouTube && youtubeWatchUrl && (
                <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-t border-white/10">
                  <span className="text-xs text-white/50">Tidak bisa memutar video?</span>
                  <a
                    href={youtubeWatchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Buka di YouTube
                  </a>
                </div>
              )}
            </div>
      </div>
    </div>
    )}
    </>
  );
}
