'use client';

import { useState } from 'react';
import Image from 'next/image';
// motion removed — replaced with CSS animations
import {
  Gift, Heart, Sparkles, Wallet,
  Loader2, CheckCircle2, X, Copy, Check, Phone,
  Zap, Star
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useDivisionTheme } from '@/hooks/use-division-theme';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';


type DonationType = 'weekly' | 'season';

/* ========== Payment method config ========== */
type PaymentMode = 'qr' | 'number';

const paymentMethods = [
  {
    key: 'qris',
    label: 'QRIS',
    mode: 'qr' as PaymentMode,
    settingKey: 'donation_qris_image',
    numberKey: '',
    color: '#EFF923',
    bgColor: 'bg-idm-gold-warm/10',
    textColor: 'text-idm-gold-warm',
    borderColor: 'border-idm-gold-warm/30',
    description: 'Semua Bank & E-Wallet',
    copyLabel: 'QRIS',
  },
  {
    key: 'dana',
    label: 'DANA',
    mode: 'number' as PaymentMode,
    settingKey: 'donation_dana_image',
    numberKey: 'donation_dana_number',
    color: '#108ee9',
    bgColor: 'bg-[#108ee9]/10',
    textColor: 'text-[#108ee9]',
    borderColor: 'border-[#108ee9]/30',
    description: 'Transfer ke nomor DANA',
    copyLabel: 'Nomor DANA',
  },
  {
    key: 'ovo',
    label: 'OVO',
    mode: 'number' as PaymentMode,
    settingKey: 'donation_ovo_image',
    numberKey: 'donation_ovo_number',
    color: '#4c3494',
    bgColor: 'bg-[#4c3494]/10',
    textColor: 'text-[#4c3494]',
    borderColor: 'border-[#4c3494]/30',
    description: 'Transfer ke nomor OVO',
    copyLabel: 'Nomor OVO',
  },
  {
    key: 'shopeepay',
    label: 'ShopeePay',
    mode: 'number' as PaymentMode,
    settingKey: 'donation_shopeepay_image',
    numberKey: 'donation_shopeepay_number',
    color: '#ee4d2d',
    bgColor: 'bg-[#ee4d2d]/10',
    textColor: 'text-[#ee4d2d]',
    borderColor: 'border-[#ee4d2d]/30',
    description: 'Transfer ke nomor ShopeePay',
    copyLabel: 'Nomor ShopeePay',
  },
] as const;

interface DonationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: DonationType;
  defaultAmount?: number;
  /** If true, hide the Sawer tab toggle and force season mode */
  hideSawer?: boolean;
  /** Division filter — when provided, shows donor list for this division and pre-selects it */
  division?: 'male' | 'female';
  /** Tournament ID — filters donor list to current week only */
  tournamentId?: string | null;
  /** CMS settings map for payment configuration */
  cmsSettings?: Record<string, string>;
  /** Called after successful donation submission — used to open payment reminder modal */
  onSuccess?: (division: 'male' | 'female') => void;
}

/* Step states for multi-step flow */
type ModalStep = 'form' | 'division' | 'result';

export function DonationModal({ open, onOpenChange, defaultType = 'season', defaultAmount, hideSawer = false, division: divisionProp, tournamentId, cmsSettings = {}, onSuccess }: DonationModalProps) {
  const dt = useDivisionTheme();
  const division = useAppStore((s) => s.division);
  const addNotification = useAppStore((s) => s.addNotification);

  const [step, setStep] = useState<ModalStep>('form');
  const [donationType, setDonationType] = useState<DonationType>(defaultType);
  const [selectedDivision, setSelectedDivision] = useState<'male' | 'female'>(divisionProp || (division === 'female' ? 'female' : 'male'));

  // If hideSawer is true, always use season type
  const effectiveType = hideSawer ? 'season' : donationType;
  const [selectedAmount, setSelectedAmount] = useState<number | null>(defaultAmount || null);
  const [customAmount, setCustomAmount] = useState('');
  const [donorName, setDonorName] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activePayment, setActivePayment] = useState<string>('qris');
  const [copiedKey, setCopiedKey] = useState<string>('');

  const finalAmount = customAmount ? parseInt(customAmount.replace(/\D/g, '')) || 0 : (selectedAmount || 0);

  const isFormValid = donorName.trim().length > 0 && finalAmount >= 1000;

  const effectiveDivision = divisionProp || selectedDivision;

  // Determine which payment methods are available
  // QRIS: available if donation_qris_image has a value
  // E-wallets: available if donation_*_number has a value (falls back to donation_*_image for legacy data)
  const availablePayments = paymentMethods.filter(pm => {
    if (pm.mode === 'qr') {
      return !!cmsSettings[pm.settingKey];
    }
    // For number-based methods, check numberKey first, then fall back to settingKey (legacy)
    return !!(cmsSettings[pm.numberKey] || cmsSettings[pm.settingKey]);
  });
  const hasAnyPayment = availablePayments.length > 0;
  const paymentHolder = cmsSettings.donation_payment_holder || '';
  const paymentNotes = cmsSettings.donation_payment_notes || '';

  // Helper: get the display value for a payment method
  const getPaymentValue = (pm: typeof paymentMethods[number]): string => {
    if (pm.mode === 'qr') return cmsSettings[pm.settingKey] || '';
    // For number-based, prefer numberKey, fall back to settingKey (legacy data had phone numbers in _image keys)
    return cmsSettings[pm.numberKey] || cmsSettings[pm.settingKey] || '';
  };

  const handleCopy = async (text: string, key: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
      toast.success('Berhasil disalin!');
    } catch {
      toast.error('Gagal menyalin');
    }
  };

  /** Submit the donation to API with the chosen division */
  const submitDonation = async (div: 'male' | 'female') => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorName: donorName.trim(),
          amount: finalAmount,
          message: message.trim() || null,
          type: effectiveType,
          division: div,
          tournamentId: tournamentId || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSelectedDivision(div);
        setSubmitResult({ success: true, message: data.donation?.status === 'pending' ? `Terima kasih, ${donorName.trim()}! Donasi Anda sedang menunggu konfirmasi admin setelah pembayaran dikonfirmasi.` : data.message });
        addNotification('donation', `${donorName.trim()} ${effectiveType === 'weekly' ? 'menyawer' : 'mendonasi'} ${formatCurrency(finalAmount)}! Menunggu konfirmasi.`);
        toast.success('Donasi dicatat!', { description: `Terima kasih, ${donorName.trim()}! Silakan lakukan pembayaran.` });
        // Set default active payment to first available
        if (availablePayments.length > 0) {
          setActivePayment(availablePayments[0].key);
        }
        setStep('result');
        // Notify parent so PaymentModal can open as payment reminder
        onSuccess?.(div);
      } else {
        setSubmitResult({ success: false, message: data.error || 'Gagal memproses donasi' });
        setStep('result');
      }
    } catch {
      setSubmitResult({ success: false, message: 'Terjadi kesalahan jaringan' });
      setStep('result');
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Form submit — for weekly go to division picker (unless division prop is provided), for season submit directly */
  const handleFormSubmit = () => {
    if (!isFormValid || isSubmitting) return;
    if (effectiveType === 'weekly' && !divisionProp) {
      setStep('division');
    } else {
      // Season donation or weekly with pre-selected division — submit directly
      submitDonation(divisionProp || selectedDivision);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setStep('form');
      setSubmitResult(null);
      setSelectedAmount(null);
      setCustomAmount('');
      setDonorName('');
      setMessage('');
      onOpenChange(false);
    }
  };

  const typeConfig = {
    weekly: {
      icon: Gift,
      title: 'Sawer',
      subtitle: 'Sawer untuk menambah hadiah mingguan tournament',
      accent: '#EFF923',
      accentLight: '#e8d5a3',
      gradient: 'from-idm-gold-warm to-[#e8d5a3]',
      bgAccent: 'bg-idm-gold-warm',
      borderAccent: 'border-idm-gold-warm',
      textAccent: 'text-idm-gold-warm',
      bgSubtle: 'bg-idm-gold-warm/5',
      borderSubtle: 'border-idm-gold-warm/20',
      hoverBg: 'hover:bg-idm-gold-warm/15',
      emoji: '💰',
    },
    season: {
      icon: Sparkles,
      title: 'Donasi Tarkam',
      subtitle: 'Donasi untuk mendanai tarkam season berikutnya',
      accent: '#57B5FF',
      accentLight: '#8FCEFF',
      gradient: 'from-[#2E9FFF] to-[#57B5FF]',
      bgAccent: 'bg-[#57B5FF]',
      borderAccent: 'border-[#57B5FF]',
      textAccent: 'text-[#57B5FF]',
      bgSubtle: 'bg-[#57B5FF]/5',
      borderSubtle: 'border-[#57B5FF]/20',
      hoverBg: 'hover:bg-[#57B5FF]/15',
      emoji: '✨',
    },
  };

  const config = typeConfig[effectiveType];
  const TypeIcon = config.icon;
  const activePM = paymentMethods.find(pm => pm.key === activePayment);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showCloseButton={false} className={`flex flex-col modal-container modal-container-md modal-enter-slide ${effectiveDivision === 'female' ? 'modal-container-female' : 'modal-container-male'} sm:max-w-md p-0 border-border/50 bg-background`}>
        {/* Accessible title - visually hidden */}
        <DialogHeader className="sr-only">
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.subtitle}</DialogDescription>
        </DialogHeader>
        {/* Header with animated gradient + custom close button */}
        <div className={`modal-header-gradient shrink-0 bg-gradient-to-br ${step === 'division' ? 'from-cyan-600 via-purple-600 to-idm-gold-warm' : config.gradient}`}>
          <div className="absolute inset-0 bg-black/20" />
          {/* Animated sparkles — CSS animation instead of framer-motion */}
          <div
            className="absolute inset-0 animate-[shimmer_4s_ease-in-out_infinite]"
            style={{ background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)' }}
          />
          <div className="relative z-10 flex items-center gap-3 p-5 h-full">
            <div
              className="w-12 h-12 rounded-2xl bg-white/25 flex items-center justify-center animate-[wiggle_3s_ease-in-out_infinite]"
            >
              {step === 'division' ? (
                <Zap className="w-6 h-6 text-white" />
              ) : step === 'result' && submitResult?.success ? (
                <CheckCircle2 className="w-6 h-6 text-white" />
              ) : (
                <TypeIcon className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h2 className="modal-header-title text-lg font-black text-white drop-shadow-sm">
                {step === 'division'
                  ? 'Pilih Divisi'
                  : step === 'result' && submitResult?.success
                  ? 'Terima Kasih!'
                  : config.title}
              </h2>
              <p className="modal-header-subtitle text-[11px] text-white/80 max-w-[220px]">
                {step === 'division'
                  ? 'Sawer untuk prize pool divisi mana?'
                  : step === 'result' && submitResult?.success
                  ? 'Donasi berhasil dicatat'
                  : config.subtitle}
              </p>
            </div>
          </div>
          {/* Custom close button — always on top */}
          <button
            onClick={handleClose}
            aria-label="Tutup"
            className="modal-close-dark absolute top-3 right-3 z-50"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="modal-body">

          {/* ═══════════════ STEP 1: FORM ═══════════════ */}
          {step === 'form' && (
            <div className="stagger-item space-y-4">
              {/* Type Toggle — hidden when hideSawer is true (landing page donation) */}
              {!hideSawer && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-2 block">Jenis Dukungan</label>
                  <div className="flex items-center bg-muted rounded-2xl p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => { setDonationType('weekly'); }}
                      className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 ${
                        donationType === 'weekly'
                          ? `${typeConfig.weekly.bgAccent} text-white shadow-md`
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Gift className="w-3.5 h-3.5" />
                      Sawer
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDonationType('season'); }}
                      className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 ${
                        donationType === 'season'
                          ? `${typeConfig.season.bgAccent} text-white shadow-md`
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Donasi
                    </button>
                  </div>
                </div>
              )}

              {/* Custom Amount */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Masukkan Nominal
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">Rp</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Contoh: Rp.25000"
                    value={customAmount}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setCustomAmount(val);
                      if (val) setSelectedAmount(null);
                    }}
                    className="pl-9 font-semibold"
                  />
                  {customAmount && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {formatCurrency(parseInt(customAmount) || 0)}
                    </span>
                  )}
                </div>
              </div>

              {/* Donor Name */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Nama / Nick <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Heart className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Masukkan nama kamu"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    className="pl-9"
                    maxLength={30}
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Pesan <span className="text-muted-foreground/70 text-[10px]">(opsional)</span>
                </label>
                <Textarea
                  placeholder="Tulis pesan semangat atau dukungan..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[60px] resize-none text-sm"
                  maxLength={200}
                />
                {message.length > 0 && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 text-right">{message.length}/200</p>
                )}
              </div>

              {/* Summary & Submit */}
              <div className={`rounded-2xl ${config.bgSubtle} ${config.borderSubtle} border p-4 sm:p-5`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Total {effectiveType === 'weekly' ? 'Sawer' : 'Donasi'}</span>
                  <span className={`text-lg font-black ${config.textAccent}`}>
                    {formatCurrency(finalAmount || 0)}
                  </span>
                </div>
                <Button
                  className={`w-full font-bold bg-gradient-to-r ${config.gradient} text-black hover:opacity-90 transition-opacity`}
                  size="lg"
                  disabled={!isFormValid || isSubmitting}
                  onClick={handleFormSubmit}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <span className="mr-1">{config.emoji}</span>
                  )}
                  {isSubmitting
                    ? 'Memproses...'
                    : `${effectiveType === 'weekly' ? 'Sawer' : 'Donasi'} Sekarang`
                  }
                </Button>
              </div>

              <p className="text-[10px] text-center text-muted-foreground/60">
                {effectiveType === 'weekly'
                  ? '💰 Sawer menambah prize pool mingguan'
                  : '✨ Donasi membantu mendanai tarkam season berikutnya'
                }
              </p>
            </div>
          )}

          {/* ═══════════════ STEP 2: DIVISION PICKER ═══════════════ */}
          {step === 'division' && (
            <div className="stagger-item space-y-5">
              {/* Back to form */}
              <button
                type="button"
                onClick={() => setStep('form')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5 rotate-45 -scale-x-100" />
                Kembali ke form
              </button>

              {/* Summary recap */}
              <div className={`text-center p-4 sm:p-5 rounded-2xl ${config.bgSubtle} ${config.borderSubtle} border`}>
                <p className="text-xs text-muted-foreground mb-0.5">{donorName.trim()}</p>
                <p className={`text-2xl font-black ${config.textAccent}`}>{formatCurrency(finalAmount)}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">Sawer</p>
              </div>

              {/* Division selection heading */}
              <div className="text-center">
                <p className="text-xs font-bold text-idm-gold-warm/80 uppercase tracking-widest mb-1">Pilih Divisi</p>
                <p className="text-[11px] text-muted-foreground">Sawer ini untuk prize pool divisi mana?</p>
              </div>

              {/* Male | Female cards — styled like bracket picker */}
              <div className="grid grid-cols-2 gap-3">
                {/* Male */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitDonation('male')}
                  className="group relative flex flex-col items-center gap-2.5 p-5 rounded-2xl border-2 border-idm-male/20 bg-idm-male/5 hover:bg-idm-male/15 hover:border-idm-male/40 hover:shadow-[0_0_25px_rgba(46,159,255,0.15)] transition-all duration-300 cursor-pointer active:scale-[0.97]"
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-idm-male/15">
                    <Zap className="w-6 h-6 text-idm-male" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-black text-idm-male block">Cowo</span>
                    <span className="text-lg">🕺</span>
                  </div>
                  <span className="text-[10px] text-idm-male/60 font-medium uppercase tracking-wider">Prize Pool</span>
                </button>

                {/* Female */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submitDonation('female')}
                  className="group relative flex flex-col items-center gap-2.5 p-5 rounded-2xl border-2 border-idm-female/20 bg-idm-female/5 hover:bg-idm-female/15 hover:border-idm-female/40 hover:shadow-[0_0_25px_rgba(255,45,120,0.15)] transition-all duration-300 cursor-pointer active:scale-[0.97]"
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-idm-female/15">
                    <Star className="w-6 h-6 text-idm-female" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-black text-idm-female block">Cewe</span>
                    <span className="text-lg">💃</span>
                  </div>
                  <span className="text-[10px] text-idm-female/60 font-medium uppercase tracking-wider">Prize Pool</span>
                </button>
              </div>

              {/* Loading overlay hint */}
              {isSubmitting && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ STEP 3: RESULT (SUCCESS/ERROR) ═══════════════ */}
          {step === 'result' && submitResult && (
            <div className="stagger-item-subtle">
                {submitResult.success ? (
                  <div className="space-y-4">
                    {/* Success Header */}
                    <div className="text-center pt-2">
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 mb-3">
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                      </div>
                      <h3 className="text-lg font-bold text-green-500 mb-1">Terima Kasih! 🎉</h3>
                      <p className="text-sm text-muted-foreground mb-0.5">{donorName} — {formatCurrency(finalAmount)}</p>
                      {effectiveType === 'weekly' && (
                        <p className={`text-xs font-semibold ${selectedDivision === 'male' ? 'text-idm-male' : 'text-idm-female'}`}>
                          Prize Pool {selectedDivision === 'male' ? '🕺 Cowo' : '💃 Cewe'}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{submitResult.message}</p>
                    </div>

                    {/* Payment Section */}
                    {hasAnyPayment ? (
                      <div className="space-y-3">
                        <div className="h-px bg-border/30" />
                        <div className="text-center">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Selesaikan Pembayaran</p>
                        </div>

                        {/* Payment Method Tabs */}
                        {availablePayments.length > 1 && (
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                            {availablePayments.map(pm => (
                              <button
                                key={pm.key}
                                type="button"
                                onClick={() => setActivePayment(pm.key)}
                                className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                                  activePayment === pm.key
                                    ? `${pm.bgColor} ${pm.textColor} ${pm.borderColor}`
                                    : 'border-border/30 text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {pm.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Payment Display — QR or Phone Number */}
                        {activePM && (
                          <div
                            key={activePM.key}
                            className="stagger-item-subtle flex flex-col items-center"
                          >
                            {activePM.mode === 'qr' ? (
                              /* QR Code Display (QRIS) */
                              <>
                                <div className={`relative w-52 h-52 rounded-2xl border-2 ${activePM.borderColor} ${activePM.bgColor} p-3 sm:p-4 overflow-hidden`}>
                                  <Image
                                    src={cmsSettings[activePM.settingKey] || ''}
                                    alt={`QR Code ${activePM.label}`}
                                    fill
                                    className="object-contain p-1"
                                  />
                                </div>
                                <div className="mt-2 text-center">
                                  <p className={`text-xs font-bold ${activePM.textColor}`}>{activePM.label}</p>
                                  <p className="text-[10px] text-muted-foreground/70">{activePM.description}</p>
                                </div>
                              </>
                            ) : (
                              /* Phone Number Display (DANA, OVO, ShopeePay) */
                              <>
                                <div className={`w-full max-w-[260px] rounded-2xl border-2 ${activePM.borderColor} ${activePM.bgColor} p-4`}>
                                  <div className="flex items-center justify-center gap-2 mb-3">
                                    <Phone className={`w-4 h-4 ${activePM.textColor}`} />
                                    <span className={`text-sm font-bold ${activePM.textColor}`}>{activePM.label}</span>
                                  </div>
                                  <div className="flex items-center justify-center gap-2 bg-background/80 rounded-2xl px-4 py-3 border border-border/30">
                                    <span className="text-lg font-mono font-bold tracking-wider">{getPaymentValue(activePM)}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(getPaymentValue(activePM), activePM.key)}
                                      className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
                                      title={`Salin ${activePM.copyLabel}`}
                                    >
                                      {copiedKey === activePM.key ? (
                                        <Check className="w-4 h-4 text-green-500" />
                                      ) : (
                                        <Copy className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-center text-muted-foreground/70 mt-2">{activePM.description}</p>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Holder Name */}
                        {paymentHolder && (
                          <div className="flex items-center justify-center gap-2 p-3 sm:p-4 rounded-2xl bg-muted/50 border border-border/30">
                            <span className="text-xs text-muted-foreground">a.n.</span>
                            <span className="text-xs font-semibold">{paymentHolder}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(paymentHolder, 'holder')}
                              className="p-1 rounded-md hover:bg-muted transition-colors"
                              title="Salin nama"
                            >
                              {copiedKey === 'holder' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                            </button>
                          </div>
                        )}

                        {/* Notes */}
                        {paymentNotes && (
                          <p className="text-[10px] text-center text-muted-foreground/70 leading-relaxed">
                            💡 {paymentNotes}
                          </p>
                        )}
                      </div>
                    ) : (
                      /* No payment configured yet */
                      <div className="text-center py-3">
                        <Wallet className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground/60">Info pembayaran belum dikonfigurasi oleh admin.</p>
                        <p className="text-[10px] text-muted-foreground/40">Hubungi admin untuk detail transfer.</p>
                      </div>
                    )}

                    {/* Close Button */}
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90"
                      onClick={handleClose}
                    >
                      Selesai
                    </Button>
                  </div>
                ) : (
                  /* Error state */
                  <div className="text-center py-6">
                    <X className="w-9 h-9 text-red-500 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-red-500 mb-1">Gagal</h3>
                    <p className="text-sm text-muted-foreground">{submitResult.message}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => { setSubmitResult(null); setStep('form'); }}
                    >
                      Coba Lagi
                    </Button>
                  </div>
                )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
