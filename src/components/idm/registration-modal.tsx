'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  UserPlus, X, Loader2, MapPin, Phone, Users, Music, CheckCircle2, AlertTriangle, Ban, Info, ChevronDown, ChevronUp, Clock, Lock, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RegistrationPaymentInfo } from './registration-payment-info';
import { useAppStore } from '@/lib/store';

interface SimilarPlayer {
  id: string;
  name: string;
  gamertag: string;
  division: string;
  city: string;
  phone: string | null;
  registrationStatus: string;
  isActive: boolean;
  matchType: 'exact_name' | 'similar_name' | 'phone_match';
  matchDetails: {
    nameMatch: boolean;
    cityMatch: boolean;
    phoneMatch: boolean;
    nameDifferent: boolean;
  };
}

interface RegistrationModalProps {
  open: boolean;
  onClose: () => void;
  defaultDivision?: 'male' | 'female' | null;
}

export function RegistrationModal({ open, onClose, defaultDivision }: RegistrationModalProps) {
  const { setPlayerAuth, refreshPlayerSession } = useAppStore();
  const [division, setDivision] = useState<'male' | 'female'>(defaultDivision || 'male');
  const [step, setStep] = useState<'pick' | 'form'>(defaultDivision ? 'form' : 'pick');
  const [formData, setFormData] = useState({
    name: '',
    joki: '',
    phone: '',
    city: '',
    clubProfileId: '',
  });
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApprovedList, setShowApprovedList] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    gamertag?: string;
  } | null>(null);

  const [warningState, setWarningState] = useState<{
    show: boolean;
    isBlocked: boolean;
    isHighRisk: boolean;
    canReRegister: boolean;
    isApprovedPlayer: boolean;
    alreadyInTournament: boolean;
    reRegisterPlayerId: string | null;
    message: string;
    similarPlayers: SimilarPlayer[];
  } | null>(null);

  // Portal target — render modal directly into document.body to avoid
  // parent overflow/transform breaking position:fixed centering.
  // Without this, the landing page's overflow-hidden container
  // and Tailwind v4 unlayered .casino-card CSS { position: relative }
  // overrides the Dialog's position:fixed, causing the modal to appear
  // off-center or invisible.
  const [portalTarget] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' ? document.body : null
  );

  // Fetch stats for season info & registration status check
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', division],
    queryFn: async () => {
      const res = await fetch(`/api/stats?division=${division}`);
      return res.json();
    },
    enabled: open,
  });

  // Determine if registration is open for the selected division
  const tournamentStatus = stats?.activeTournament?.status;
  const isRegistrationOpen = tournamentStatus === 'registration' || tournamentStatus === 'approval';

  // Fetch ClubProfiles (global, not season-specific) for the dropdown
  const { data: clubProfiles } = useQuery({
    queryKey: ['register-club-profiles'],
    queryFn: async () => {
      const res = await fetch('/api/clubs?unified=true');
      const data = await res.json();
      return data as Array<{ id: string; name: string; logo: string | null; memberCount: number }>;
    },
  });

  // Fetch approved participants for the active tournament
  const { data: approvedParticipants } = useQuery({
    queryKey: ['approved-participants', division, stats?.season?.id],
    queryFn: async () => {
      if (!stats?.season?.id) return [];
      const res = await fetch(`/api/tournaments?seasonId=${stats.season.id}`);
      const tournaments = await res.json();
      const active = tournaments.find((t: { status: string }) =>
        !['completed', 'finalization'].includes(t.status)
      );
      if (!active?.participations) return [];
      return active.participations
        .filter((p: { status: string }) => ['approved', 'assigned'].includes(p.status))
        .map((p: { player: { id: string; gamertag: string; name: string; tier: string; points: number }; tierOverride?: string | null }) => ({
          id: p.player.id,
          gamertag: p.player.gamertag,
          name: p.player.name,
          tier: p.tierOverride || p.player.tier || 'B',
          points: p.player.points,
        }));
    },
    enabled: !!stats?.season?.id && showApprovedList,
  });

  const handleSubmit = async (force = false) => {
    if (!formData.name.trim() || !formData.city.trim() || !formData.phone.trim()) return;

    // Validate password if account creation is enabled
    if (createAccount) {
      if (password.length < 6) {
        toast.error('Password minimal 6 karakter');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Konfirmasi password tidak cocok');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          joki: formData.joki || null,
          phone: formData.phone,
          city: formData.city,
          clubProfileId: formData.clubProfileId || null,
          division,
          force,
          ...(createAccount && password ? { password } : {}),
        }),
      });

      const data = await res.json();

      if (data.blocked) {
        setWarningState({
          show: true,
          isBlocked: true,
          isHighRisk: true,
          canReRegister: false,
          isApprovedPlayer: false,
          alreadyInTournament: data.alreadyInTournament || false,
          reRegisterPlayerId: null,
          message: data.error || data.message,
          similarPlayers: data.similarPlayers || [],
        });
        setIsSubmitting(false);
        return;
      }

      if (data.canReRegister) {
        setWarningState({
          show: true,
          isBlocked: false,
          isHighRisk: data.isHighRisk || false,
          canReRegister: true,
          isApprovedPlayer: data.isApprovedPlayer || false,
          alreadyInTournament: false,
          reRegisterPlayerId: data.reRegisterPlayerId,
          message: data.message,
          similarPlayers: data.similarPlayers || [],
        });
        setIsSubmitting(false);
        return;
      }

      if (data.warning && !force) {
        setWarningState({
          show: true,
          isBlocked: false,
          isHighRisk: data.isHighRisk || false,
          canReRegister: false,
          isApprovedPlayer: false,
          alreadyInTournament: false,
          reRegisterPlayerId: null,
          message: data.message,
          similarPlayers: data.similarPlayers,
        });
        setIsSubmitting(false);
        return;
      }

      if (res.ok || data.success) {
        setSubmitResult({
          success: true,
          message: data.message,
          gamertag: data.player?.gamertag || data.tournament?.name,
        });
        setFormData({ name: '', joki: '', phone: '', city: '', clubProfileId: '' });
        setPassword('');
        setConfirmPassword('');
        setWarningState(null);
        // If account was created, auto-login via session refresh
        if (data.accountCreated) {
          await refreshPlayerSession();
          toast.success('Pendaftaran berhasil! Akun login kamu sudah aktif.', { description: 'Silakan lakukan pembayaran registrasi di bawah.' });
        } else {
          toast.success('Pendaftaran berhasil!', { description: 'Silakan lakukan pembayaran registrasi di bawah.' });
        }
      } else if (data.registrationClosed) {
        setSubmitResult({
          success: false,
          message: data.error || 'Pendaftaran belum dibuka. Hubungi admin untuk informasi lebih lanjut.',
        });
      } else {
        setSubmitResult({
          success: false,
          message: data.error || 'Gagal mendaftar',
        });
      }
    } catch {
      setSubmitResult({
        success: false,
        message: 'Terjadi kesalahan jaringan',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmWarning = () => {
    if (warningState?.isBlocked) return;
    setWarningState(prev => prev ? { ...prev, show: false } : null);
    handleSubmit(true);
  };

  const handleReRegister = () => {
    if (!warningState?.canReRegister || !warningState?.reRegisterPlayerId) return;
    setWarningState(prev => prev ? { ...prev, show: false } : null);
    handleReRegisterSubmit(warningState.reRegisterPlayerId, warningState.isApprovedPlayer);
  };

  const handleReRegisterSubmit = async (reRegisterPlayerId: string, isApprovedPlayer: boolean) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          joki: formData.joki || null,
          phone: formData.phone,
          city: formData.city,
          clubProfileId: formData.clubProfileId || null,
          division,
          reRegister: true,
          reRegisterPlayerId,
          isApprovedPlayer,
          ...(createAccount && password ? { password } : {}),
        }),
      });

      const data = await res.json();

      if (res.ok || data.success) {
        setSubmitResult({
          success: true,
          message: data.message,
          gamertag: data.player?.gamertag || data.tournament?.name,
        });
        setFormData({ name: '', joki: '', phone: '', city: '', clubProfileId: '' });
        setPassword('');
        setConfirmPassword('');
        setWarningState(null);
        if (data.accountCreated) {
          await refreshPlayerSession();
          toast.success('Daftar berhasil! Akun login kamu sudah aktif.', { description: 'Silakan lakukan pembayaran registrasi di bawah.' });
        } else {
          toast.success('Daftar berhasil!', { description: 'Silakan lakukan pembayaran registrasi di bawah.' });
        }
      } else if (data.registrationClosed) {
        setSubmitResult({
          success: false,
          message: data.error || 'Pendaftaran belum dibuka. Hubungi admin untuk informasi lebih lanjut.',
        });
      } else {
        setSubmitResult({
          success: false,
          message: data.error || 'Gagal mendaftar',
        });
      }
    } catch {
      setSubmitResult({
        success: false,
        message: 'Terjadi kesalahan jaringan',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelWarning = () => {
    setWarningState(null);
  };

  const handleClose = () => {
    setFormData({ name: '', joki: '', phone: '', city: '', clubProfileId: '' });
    setPassword('');
    setConfirmPassword('');
    setCreateAccount(false);
    setSubmitResult(null);
    setWarningState(null);
    setStep(defaultDivision ? 'form' : 'pick');
    onClose();
  };

  // Sync defaultDivision when it changes
  useEffect(() => {
    if (defaultDivision) {
      setDivision(defaultDivision);
      setStep('form');
    }
  }, [defaultDivision]);

  // Lock body scroll when modal is open + Close on Escape
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    // iOS Safari scroll lock: use position fixed + touch-action
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.touchAction = 'none';
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      document.body.style.touchAction = '';
      window.scrollTo(0, scrollY);
      window.removeEventListener('keydown', handler);
    };
  }, [open, onClose]);

  const divisionEmoji = division === 'male' ? '🕺' : '💃';

  if (!open || !portalTarget) return null;

  const modal = (
    <div
      className="modal-backdrop modal-backdrop-enter z-[9999] p-3 sm:p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Form Pendaftaran Peserta"
    >
        <div
          className={`modal-container modal-container-md modal-enter-slide ${division === 'male' ? 'modal-container-male' : 'modal-container-female'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`modal-header justify-between ${step === 'form' ? (division === 'male' ? 'modal-header-male' : 'modal-header-female') : ''}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${step === 'pick' ? 'bg-idm-gold-warm/10' : division === 'male' ? 'bg-idm-male/10' : 'bg-idm-female/10'}`}>
                <UserPlus className={`w-5 h-5 ${step === 'pick' ? 'text-idm-gold-warm' : division === 'male' ? 'text-idm-male' : 'text-idm-female'}`} />
              </div>
              <div className="min-w-0">
                <h2 className="modal-header-title text-gradient-fury">
                  {step === 'pick' ? 'Pilih Divisi' : 'Daftar Peserta'}
                </h2>
                <p className="modal-header-subtitle">
                  {step === 'pick' ? 'Pilih divisi terlebih dahulu' : 'IDM League'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {step === 'form' && (
                <button
                  onClick={() => setStep('pick')}
                  aria-label="Kembali pilih divisi"
                  className="modal-close"
                >
                  <ChevronDown className="w-4 h-4 text-muted-foreground rotate-90" />
                </button>
              )}
              <button
                onClick={handleClose}
                aria-label="Tutup form pendaftaran"
                className="modal-close"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* ═══ Division Picker Step ═══ */}
          {step === 'pick' && (
            <div className="modal-body">
              <p className="text-sm text-muted-foreground text-center">
                Pilih divisi pertandingan yang ingin kamu ikuti
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Cowo Division Card */}
                <button
                  onClick={() => { setDivision('male'); setStep('form'); }}
                  className="group relative flex flex-col items-center gap-3 p-5 sm:p-6 rounded-2xl border-2 border-idm-male/20 bg-idm-male/5 hover:border-idm-male/50 hover:bg-idm-male/10 transition-all duration-300 cursor-pointer active:scale-95"
                >
                  {/* Division icon */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-idm-male/15 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Music className="w-7 h-7 sm:w-8 sm:h-8 text-idm-male" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base sm:text-lg font-black text-idm-male uppercase tracking-wider">Cowo</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Divisi Laki-laki ♂</p>
                  </div>
                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ boxShadow: '0 0 24px rgba(46,159,255,0.15)' }} />
                </button>

                {/* Cewe Division Card */}
                <button
                  onClick={() => { setDivision('female'); setStep('form'); }}
                  className="group relative flex flex-col items-center gap-3 p-5 sm:p-6 rounded-2xl border-2 border-idm-female/20 bg-idm-female/5 hover:border-idm-female/50 hover:bg-idm-female/10 transition-all duration-300 cursor-pointer active:scale-95"
                >
                  {/* Division icon */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-idm-female/15 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Users className="w-7 h-7 sm:w-8 sm:h-8 text-idm-female" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base sm:text-lg font-black text-idm-female uppercase tracking-wider">Cewe</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Divisi Perempuan ♀</p>
                  </div>
                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ boxShadow: '0 0 24px rgba(255,45,120,0.15)' }} />
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground/50 text-center">
                Pastikan memilih divisi yang sesuai
              </p>
            </div>
          )}

          {/* ═══ Form Step ═══ */}
          {step === 'form' && (
          <div className="modal-body modal-scroll">
                {/* Success State */}
                {submitResult && (
                  <div className="py-4">
                    {submitResult.success ? (
                      <>
                        <div className="text-center mb-4">
                          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 mb-3">
                            <CheckCircle2 className="w-7 h-7 text-green-500" />
                          </div>
                          <h3 className="text-lg font-bold text-green-500 mb-2">Pendaftaran Berhasil!</h3>
                          {submitResult.gamertag && (
                            <p className="text-sm font-medium mb-2">
                              Nickname kamu: <span className={`${division === 'male' ? 'text-idm-male' : 'text-idm-female'} font-bold`}>{submitResult.gamertag}</span>
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">{submitResult.message}</p>
                        </div>

                        {/* Payment Info */}
                        <RegistrationPaymentInfo />

                        <div className="mt-4 text-center">
                          <Button
                            onClick={handleClose}
                            className="bg-idm-gold-warm hover:bg-idm-gold-warm/90 text-background font-bold"
                          >
                            Tutup
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center">
                        <X className="w-8 h-8 text-red-500 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-red-500 mb-2">Gagal Mendaftar</h3>
                        <p className="text-sm text-muted-foreground mb-4">{submitResult.message}</p>
                        <Button
                          variant="outline"
                          onClick={() => setSubmitResult(null)}
                        >
                          Coba Lagi
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Warning Dialog */}
                {warningState?.show && (
                  <div className="p-4 rounded-2xl border"
                      style={{
                        borderColor: warningState.isBlocked
                          ? warningState.alreadyInTournament
                            ? 'rgba(59,130,246,0.5)'
                            : 'rgba(239,68,68,0.5)'
                          : warningState.canReRegister
                            ? warningState.isApprovedPlayer
                              ? 'rgba(34,197,94,0.3)'
                              : 'rgba(46,159,255,0.3)'
                            : warningState.isHighRisk
                              ? 'rgba(249,115,22,0.3)'
                              : 'rgba(234,179,8,0.3)',
                        backgroundColor: warningState.isBlocked
                          ? warningState.alreadyInTournament
                            ? 'rgba(59,130,246,0.05)'
                            : 'rgba(239,68,68,0.05)'
                          : warningState.canReRegister
                            ? warningState.isApprovedPlayer
                              ? 'rgba(34,197,94,0.05)'
                              : 'rgba(46,159,255,0.05)'
                            : warningState.isHighRisk
                              ? 'rgba(249,115,22,0.05)'
                              : 'rgba(234,179,8,0.05)',
                      }}
                    >
                      <div className="flex items-start gap-3 mb-4">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                          warningState.isBlocked
                            ? warningState.alreadyInTournament
                              ? 'bg-blue-500/10'
                              : 'bg-red-500/10'
                            : warningState.canReRegister
                              ? warningState.isApprovedPlayer
                                ? 'bg-green-500/10'
                                : 'bg-idm-male/10'
                              : warningState.isHighRisk
                                ? 'bg-orange-500/10'
                                : 'bg-yellow-500/10'
                        }`}>
                          {warningState.isBlocked ? (
                            warningState.alreadyInTournament ? (
                              <Info className="w-5 h-5 text-blue-500" />
                            ) : (
                              <Ban className="w-5 h-5 text-red-500" />
                            )
                          ) : warningState.canReRegister ? (
                            warningState.isApprovedPlayer ? (
                              <Music className="w-5 h-5 text-green-500" />
                            ) : (
                              <UserPlus className="w-5 h-5 text-idm-male" />
                            )
                          ) : warningState.isHighRisk ? (
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className={`text-base font-bold mb-1 ${
                            warningState.isBlocked
                              ? warningState.alreadyInTournament
                                ? 'text-blue-500'
                                : 'text-red-500'
                              : warningState.canReRegister
                                ? warningState.isApprovedPlayer
                                  ? 'text-green-500'
                                  : 'text-idm-male'
                                : warningState.isHighRisk
                                  ? 'text-orange-500'
                                  : 'text-yellow-500'
                          }`}>
                            {warningState.isBlocked
                              ? warningState.alreadyInTournament
                                ? 'Sudah Terdaftar di Turnamen!'
                                : 'Pendaftaran Diblokir!'
                              : warningState.canReRegister
                                ? warningState.isApprovedPlayer
                                  ? 'Daftar Turnamen!'
                                  : 'Daftar Tersedia!'
                                : warningState.isHighRisk
                                  ? 'Kemungkinan Duplikat!'
                                  : 'Nama Mirip Terdeteksi!'}
                          </h3>
                          <p className="text-xs text-muted-foreground">{warningState.message}</p>
                        </div>
                      </div>

                      {warningState.similarPlayers.length > 0 && (
                        <div className="mb-4 p-3 rounded-lg bg-muted/50">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Data yang cocok:</p>
                          <div className="space-y-2">
                            {warningState.similarPlayers.slice(0, 3).map((player) => (
                              <div key={player.id} className="flex items-center justify-between text-xs gap-2 overflow-x-hidden">
                                <div>
                                  <span className="font-medium">{player.name}</span>
                                  <span className="text-muted-foreground ml-1">(@{player.gamertag})</span>
                                  {player.matchDetails.nameMatch && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px]">Nama Sama</span>
                                  )}
                                  {player.matchDetails.phoneMatch && !player.matchDetails.nameMatch && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px]">WA Sama</span>
                                  )}
                                  {player.registrationStatus && (
                                    <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
                                      player.registrationStatus === 'approved'
                                        ? 'bg-green-500/10 text-green-400'
                                        : player.registrationStatus === 'rejected'
                                          ? 'bg-red-500/10 text-red-400'
                                          : player.registrationStatus === 'pending'
                                            ? 'bg-yellow-500/10 text-yellow-400'
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                      {player.registrationStatus === 'approved' ? 'Aktif' : player.registrationStatus === 'rejected' ? 'Ditolak' : player.registrationStatus === 'pending' ? 'Menunggu' : player.registrationStatus}
                                    </span>
                                  )}
                                </div>
                                <div className="text-right">
                                  {player.matchDetails.cityMatch && (
                                    <div className="flex items-center gap-1 text-orange-400">
                                      <MapPin className="w-3 h-3" />
                                      <span>{player.city}</span>
                                    </div>
                                  )}
                                  {player.matchDetails.phoneMatch && (
                                    <div className="flex items-center gap-1 text-orange-400">
                                      <Phone className="w-3 h-3" />
                                      <span>{player.phone}</span>
                                    </div>
                                  )}
                                  {!player.matchDetails.cityMatch && !player.matchDetails.phoneMatch && (
                                    <span className="text-muted-foreground">{player.city}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Approved player re-register info */}
                      {warningState.canReRegister && warningState.isApprovedPlayer && (
                        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <div className="flex items-start gap-2">
                            <Music className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-green-400">
                              <p><strong>Daftar Turnamen:</strong> Data Anda sudah terverifikasi. Anda akan didaftarkan ke turnamen minggu ini. Admin akan menyetujui dan menentukan tier Anda.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Re-registration info */}
                      {warningState.canReRegister && !warningState.isApprovedPlayer && (
                        <div className="mb-4 p-3 rounded-lg bg-idm-male/10 border border-idm-male/20">
                          <div className="flex items-start gap-2">
                            <UserPlus className="w-4 h-4 text-idm-male mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-idm-male">
                              <p><strong>Daftar:</strong> Data Anda akan diperbarui dan status dikembalikan ke &quot;Menunggu Persetujuan&quot;. Anda juga otomatis terdaftar di turnamen minggu ini.</p>
                              <p className="mt-1 text-muted-foreground">Tier akan di-reset ke B dan admin akan menentukan tier yang sesuai.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Already in tournament message */}
                      {warningState.isBlocked && warningState.alreadyInTournament && (
                        <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs text-blue-400">
                                <strong>Sudah Terdaftar:</strong> Anda sudah terdaftar di turnamen minggu ini. Tidak perlu mendaftar lagi. Tunggu persetujuan admin atau hubungi admin jika ada kendala.
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 h-7 text-[10px] border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                                onClick={() => setShowApprovedList(!showApprovedList)}
                              >
                                <Users className="w-3 h-3 mr-1" />
                                {showApprovedList ? 'Tutup Daftar Peserta' : 'Lihat Peserta Disetujui'}
                                {showApprovedList ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Blocked message */}
                      {warningState.isBlocked && !warningState.alreadyInTournament && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                          <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-red-400">
                              <strong>Saran:</strong> Pendaftaran Anda sudah dalam antrian. Silakan tunggu admin menyetujui atau hubungi admin jika ada kendala.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* High risk message */}
                      {warningState.isHighRisk && !warningState.isBlocked && !warningState.canReRegister && (
                        <div className="mb-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                          <p className="text-xs text-orange-400">
                            <strong>Perhatian:</strong> Jika ini adalah Anda, tidak perlu mendaftar lagi. Hubungi admin jika lupa nickname.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={handleCancelWarning}
                          disabled={isSubmitting}
                        >
                          {warningState.isBlocked ? 'Tutup' : 'Batalkan'}
                        </Button>
                        {warningState.canReRegister && (
                          <Button
                            size="sm"
                            className={`flex-1 text-white ${
                              warningState.isApprovedPlayer
                                ? 'bg-green-500 hover:bg-green-600'
                                : 'bg-idm-male hover:bg-idm-male/80'
                            }`}
                            onClick={handleReRegister}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : warningState.isApprovedPlayer ? (
                              <Music className="w-4 h-4 mr-1" />
                            ) : (
                              <UserPlus className="w-4 h-4 mr-1" />
                            )}
                            {isSubmitting ? 'Memproses...' : 'Daftar'}
                          </Button>
                        )}
                        {!warningState.isBlocked && !warningState.canReRegister && (
                          <Button
                            size="sm"
                            className={`flex-1 ${warningState.isHighRisk ? 'bg-orange-500 hover:bg-orange-600' : 'bg-yellow-500 hover:bg-yellow-600'} text-white`}
                            onClick={handleConfirmWarning}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 mr-1" />
                            )}
                            {isSubmitting ? 'Memproses...' : 'Tetap Daftar'}
                          </Button>
                        )}
                      </div>
                  </div>
                )}

                {/* Registration Closed Gate */}
                {!submitResult && !warningState?.show && !isRegistrationOpen && !statsLoading && stats && (
                  <div className="py-6 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 mb-4">
                      <Clock className="w-7 h-7 text-amber-500" />
                    </div>
                    <h3 className="text-base font-bold text-amber-400 mb-2">Pendaftaran Belum Dibuka</h3>
                    <p className="text-xs text-muted-foreground mb-1">
                      Turnamen <span className={`font-semibold ${division === 'male' ? 'text-idm-male' : 'text-idm-female'}`}>{division === 'male' ? '🕺 Cowo' : '💃 Cewe'}</span> belum membuka pendaftaran.
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mb-4">
                      Hubungi admin atau nantikan pengumuman pembukaan pendaftaran.
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleClose}
                      className="text-xs"
                    >
                      Tutup
                    </Button>
                  </div>
                )}

                {/* Registration Form */}
                {!submitResult && !warningState?.show && (isRegistrationOpen || statsLoading || !stats) && (
                  <>
                    {/* Division Selector */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-2 block">Pilih Divisimu</label>
                      <div className="flex items-center bg-muted rounded-2xl p-1 gap-1">
                        <button
                          type="button"
                          onClick={() => { setDivision('male'); setFormData(p => ({ ...p, clubProfileId: '' })); }}
                          className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 ${
                            division === 'male'
                              ? 'bg-idm-male text-white shadow-md'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          🕺 Cowo
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDivision('female'); setFormData(p => ({ ...p, clubProfileId: '' })); }}
                          className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 ${
                            division === 'female'
                              ? 'bg-idm-female text-white shadow-md'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          💃 Cewe
                        </button>
                      </div>

                    </div>

                    {/* Nama/Nick */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                        Nama / Nick <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Music className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Masukkan nama atau nickname kamu"
                          value={formData.name}
                          onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                          className="pl-9 glass"
                          maxLength={30}
                        />
                      </div>
                    </div>

                    {/* Joki */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                        Joki <span className="text-muted-foreground/70 text-[10px]">(opsional)</span>
                      </label>
                      <Input
                        placeholder="Nama joki jika dimainkan orang lain"
                        value={formData.joki}
                        onChange={(e) => setFormData(p => ({ ...p, joki: e.target.value }))}
                        className="glass"
                        maxLength={30}
                      />

                    </div>

                    {/* No WhatsApp */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                        No. WhatsApp <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="08xxxxxxxxxx"
                          value={formData.phone}
                          onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                          className="pl-9 glass"
                          type="tel"
                          maxLength={15}
                        />
                      </div>
                    </div>

                    {/* Kota */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                        Kota <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Contoh: Makassar, Jakarta, Bandung"
                          value={formData.city}
                          onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))}
                          className="pl-9 glass"
                          maxLength={30}
                        />
                      </div>
                    </div>

                    {/* Club */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                        Club <span className="text-muted-foreground/70 text-[10px]">(opsional)</span>
                      </label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                        <Select
                          value={formData.clubProfileId}
                          onValueChange={(val) => setFormData(p => ({ ...p, clubProfileId: val === '_none' ? '' : val }))}
                        >
                          <SelectTrigger className="pl-9 glass">
                            <SelectValue placeholder="Pilih Club" />
                          </SelectTrigger>
                          <SelectContent className="z-[10001]">
                            <SelectItem value="_none">Tanpa Club</SelectItem>
                            {clubProfiles?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-[10px] text-idm-gold-warm mt-1 flex items-center gap-1">
                        <Info className="w-3 h-3 shrink-0" />
                        Club anda belum ada dalam daftar list club? Hubungi admin untuk membuat club
                      </p>
                    </div>

                    {/* ── Account Creation Section ── */}
                    <div className="border-t border-border/30 pt-4 mt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                        <input
                          type="checkbox"
                          checked={createAccount}
                          onChange={(e) => setCreateAccount(e.target.checked)}
                          className="w-4 h-4 rounded border-border/50 text-idm-gold-warm focus:ring-idm-gold-warm/30 accent-idm-gold-warm"
                        />
                        <div className="flex-1">
                          <span className="text-xs font-semibold text-foreground group-hover:text-idm-gold-warm transition-colors">Buat akun login?</span>
                          <p className="text-[10px] text-idm-gold-warm">Centang untuk membuat akun dengan password. Kamu bisa login untuk melihat statistik dan progress kamu.</p>
                        </div>
                      </label>

                      {createAccount && (
                        <div className="mt-3 space-y-3 pl-6">
                          {/* Password */}
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                              Password <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Min. 6 karakter"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-9 pr-10 glass"
                                maxLength={200}
                                autoComplete="new-password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                tabIndex={-1}
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Confirm Password */}
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                              Konfirmasi Password <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                type={showConfirmPassword ? 'text' : 'password'}
                                placeholder="Ulangi password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="pl-9 pr-10 glass"
                                maxLength={200}
                                autoComplete="new-password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                tabIndex={-1}
                              >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {confirmPassword && password !== confirmPassword && (
                              <p className="text-[10px] text-red-400 mt-1">Password tidak cocok</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Submit */}
                    <Button
                      className={`w-full font-semibold ${
                        division === 'male'
                          ? 'bg-idm-male hover:bg-idm-male/90 text-white'
                          : 'bg-idm-female hover:bg-idm-female/90 text-white'
                      }`}
                      size="lg"
                      disabled={
                        !formData.name.trim() || !formData.city.trim() || !formData.phone.trim()
                        || isSubmitting
                        || (createAccount && (!password || password.length < 6 || password !== confirmPassword))
                      }
                      onClick={() => handleSubmit(false)}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-2" />
                      )}
                      {isSubmitting ? 'Mendaftar...' : createAccount ? `Daftar & Ikut Turnamen ${divisionEmoji}` : `Daftar Turnamen ${divisionEmoji}`}
                    </Button>

                    <p className="text-[10px] text-center text-muted-foreground">
                      Pendaftaran akan diverifikasi oleh admin sebelum disetujui
                    </p>

                    {/* View Approved Participants Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowApprovedList(!showApprovedList)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Users className="w-3.5 h-3.5" />
                      {showApprovedList ? 'Tutup Daftar Peserta' : 'Lihat Peserta Disetujui'}
                      {showApprovedList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {/* Approved Participants List */}
                    {showApprovedList && (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Peserta Disetujui</p>
                        {(approvedParticipants?.length || 0) === 0 ? (
                          <div className="py-3 text-center">
                            <Users className="w-5 h-5 text-muted-foreground/30 mx-auto mb-1" />
                            <p className="text-[10px] text-muted-foreground">Belum ada peserta yang disetujui</p>
                          </div>
                        ) : (
                          approvedParticipants.map((p: { id: string; gamertag: string; name: string; tier: string; points: number }, idx: number) => {
                            return (
                              <div key={p.id} className="flex items-center justify-between p-1.5 rounded-lg bg-background/50 border border-blue-500/10">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center text-[9px] font-bold text-blue-400 shrink-0">{idx + 1}</span>
                                  <div className="min-w-0">
                                    <span className="text-[11px] font-medium truncate block">{p.gamertag}</span>
                                    <span className="text-[9px] text-muted-foreground">{p.name}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[9px] text-muted-foreground">{p.points}pts</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </>
                )}
        </div>
          )}
      </div>
    </div>
  );

  return createPortal(modal, portalTarget);
}
