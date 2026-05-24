'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';

interface SponsorBannerProps {
  placement: 'bracket_top' | 'bracket_side' | 'stream_overlay' | 'landing_page' | 'dashboard';
  className?: string;
}

interface Banner {
  id: string;
  imageUrl: string;
  linkUrl?: string | null;
  width?: number | null;
  height?: number | null;
  sponsor: {
    id: string;
    name: string;
    logo?: string | null;
  };
}

export function SponsorBanner({ placement, className = '' }: SponsorBannerProps) {
  const { data: bannersData, isLoading } = useQuery({
    queryKey: ['sponsor-banners', placement],
    queryFn: async () => {
      const res = await fetch(`/api/sponsors/banners?placement=${placement}&active=true`);
      if (!res.ok) return { banners: [] };
      return res.json();
    },
    staleTime: 60000, // Cache for 1 minute
  });

  const banners: Banner[] = bannersData?.banners || [];

  if (isLoading || banners.length === 0) return null;

  return (
    <div className={`sponsor-banners ${className}`}>
      {banners.map((banner, index) => (
        <div
          key={banner.id}
          className="animate-fade-enter-sm"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {banner.linkUrl ? (
            <a
              href={banner.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sponsor-banner"
            >
              <Image
                src={banner.imageUrl}
                alt={banner.sponsor.name}
                width={120}
                height={40}
                className="sponsor-logo"
                unoptimized
              />
              <span className="text-xs text-muted-foreground">{banner.sponsor.name}</span>
            </a>
          ) : (
            <div className="sponsor-banner">
              <Image
                src={banner.imageUrl}
                alt={banner.sponsor.name}
                width={120}
                height={40}
                className="sponsor-logo"
                unoptimized
              />
              <span className="text-xs text-muted-foreground">{banner.sponsor.name}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Presented By Badge Component
interface PresentedByProps {
  tournamentId: string;
  className?: string;
}

export function PresentedBy({ tournamentId, className = '' }: PresentedByProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['tournament-sponsors', tournamentId],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournamentId}/sponsors`);
      if (!res.ok) return { presentedBy: null };
      return res.json();
    },
    staleTime: 60000,
  });

  if (isLoading || !data?.presentedBy) return null;

  const sponsor = data.presentedBy;

  return (
    <div className={`presented-by ${className}`}>
      <span className="opacity-60">Presented by</span>
      {sponsor.logo && (
        <Image src={sponsor.logo} alt={sponsor.name} width={20} height={20} className="h-5 w-auto" unoptimized />
      )}
      <span className="font-semibold">{sponsor.name}</span>
    </div>
  );
}

// Sponsored Prize Card
interface SponsoredPrizeProps {
  tournamentId: string;
  className?: string;
}

export function SponsoredPrizes({ tournamentId, className = '' }: SponsoredPrizeProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['tournament-sponsored-prizes', tournamentId],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournamentId}/sponsors`);
      if (!res.ok) return { sponsoredPrizes: [] };
      return res.json();
    },
    staleTime: 60000,
  });

  const prizes = data?.sponsoredPrizes || [];

  if (isLoading || prizes.length === 0) return null;

  const getPositionLabel = (position: string | null) => {
    switch (position) {
      case 'juara1':
        return '🏆 Juara 1';
      case 'juara2':
        return '🥈 Juara 2';
      case 'juara3':
        return '🥉 Juara 3';
      case 'mvp':
        return '⭐ MVP';
      default:
        return '🎁 Hadiah';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-sm font-semibold text-idm-gold-warm uppercase tracking-wider">
        Sponsored Prizes
      </h4>
      <div className="grid gap-2">
        {prizes.map((prize: any) => (
          <div
            key={prize.id}
            className="animate-fade-enter hover-scale-sm sponsored-prize-card"
          >
            <div className="flex items-center gap-3">
              {prize.imageUrl && (
                <Image
                  src={prize.imageUrl}
                  alt={prize.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 object-cover rounded-lg"
                  unoptimized
                />
              )}
              <div className="flex-1">
                <div className="text-xs text-idm-gold-warm mb-0.5">
                  {getPositionLabel(prize.position)}
                </div>
                <div className="font-medium text-sm">{prize.name}</div>
                {prize.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {prize.description}
                  </div>
                )}
              </div>
              {prize.sponsor?.logo && (
                <Image
                  src={prize.sponsor.logo}
                  alt={prize.sponsor.name}
                  width={32}
                  height={32}
                  className="w-8 h-8 object-contain opacity-60"
                  unoptimized
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Stream Overlay Sponsor Component
export function StreamOverlaySponsor({ tournamentId }: { tournamentId: string }) {
  const { data } = useQuery({
    queryKey: ['tournament-sponsors', tournamentId],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournamentId}/sponsors`);
      if (!res.ok) return { sponsors: [] };
      return res.json();
    },
    staleTime: 60000,
  });

  const mainSponsor = data?.sponsors?.find((s: any) => s.role === 'main_sponsor');

  if (!mainSponsor?.sponsor?.logo) return null;

  return (
    <div className="stream-overlay-sponsor">
      <Image
        src={mainSponsor.sponsor.logo}
        alt={mainSponsor.sponsor.name}
        width={120}
        height={40}
        className="stream-overlay-logo"
        unoptimized
      />
    </div>
  );
}
