'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  Wallet, X, Copy, Check, Phone, MessageCircle, ExternalLink,
  CreditCard, Shield, Info, QrCode,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

/* ═══ Payment Method Config ═══ */
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
    activeBorderColor: 'border-idm-gold-warm',
    description: 'Semua Bank & E-Wallet',
    icon: QrCode,
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
    activeBorderColor: 'border-[#108ee9]',
    description: 'Transfer ke nomor DANA',
    icon: Phone,
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
    activeBorderColor: 'border-[#4c3494]',
    description: 'Transfer ke nomor OVO',
    icon: Phone,
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
    activeBorderColor: 'border-[#ee4d2d]',
    description: 'Transfer ke nomor ShopeePay',
    icon: Phone,
  },
] as const;

/* ═══ Division Color Map ═══ */
const DIVISION_CONFIG = {
  male: {
    color: '#2E9FFF',
    colorRgb: '46,159,255',
    gradient: 'from-[#2E9FFF] via-[#1478D9] to-[#0a0c16]',
    label: 'Cowo Tarkam',
    icon: '🕺',
  },
  female: {
    color: '#FF2D78',
    colorRgb: '255,45,120',
    gradient: 'from-[#FF2D78] via-[#D9165E] to-[#0a0c16]',
    label: 'Cewe Tarkam',
    icon: '💃',
  },
};

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  division: 'male' | 'female';
}

export function PaymentModal({ open, onClose, division }: PaymentModalProps) {
  const [copiedKey, setCopiedKey] = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<string>('qris');
  const [portalTarget] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' ? document.body : null
  );

  /* ── Fetch CMS settings ── */
  const { data: cmsSettings = {} as Record<string, string> } = useQuery({
    queryKey: ['cms-settings-payment'],
    queryFn: async () => {
      const res = await fetch('/api/cms/settings');
      const d = await res.json();
      return (d?.map || {}) as Record<string, string>;
    },
    staleTime: 60_000,
    enabled: open, // only fetch when modal is open
  });

  const divConfig = DIVISION_CONFIG[division];
  const adminWaLink = cmsSettings.registration_admin_wa_link || '';
  const instructions = cmsSettings.registration_payment_instructions || '';
  const holder = cmsSettings.donation_payment_holder || '';
  const paymentNotes = cmsSettings.donation_payment_notes || '';

  /* ── Available payment methods ── */
  const availablePayments = paymentMethods.filter(pm => {
    if (pm.mode === 'qr') return !!cmsSettings[pm.settingKey];
    return !!(cmsSettings[pm.numberKey] || cmsSettings[pm.settingKey]);
  });

  const hasAnyPayment = availablePayments.length > 0;

  // Resolve active payment: use user selection if valid, otherwise first available
  const activePayment = availablePayments.find(p => p.key === selectedPayment)
    ? selectedPayment
    : availablePayments.length > 0
      ? availablePayments[0].key
      : 'qris';

  /* ── Get payment value for number-based methods ── */
  const getPaymentValue = (pm: typeof paymentMethods[number]): string => {
    if (pm.mode === 'qr') return cmsSettings[pm.settingKey] || '';
    return cmsSettings[pm.numberKey] || cmsSettings[pm.settingKey] || '';
  };

  /* ── Copy handler ── */
  const handleCopy = useCallback(async (text: string, key: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    } catch { /* ignore */ }
  }, []);

  /* ── Close on Escape ── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* ── Lock body scroll ── */
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [open]);

  const activePM = paymentMethods.find(pm => pm.key === activePayment);

  if (!open || !portalTarget) return null;

  return createPortal(
    <div
      className="modal-backdrop modal-backdrop-enter z-[9999] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Info Pembayaran"
      onClick={onClose}
    >
      {/* ── Modal Card ── */}
      <div
        className={`modal-container modal-container-md modal-enter-slide ${division === 'male' ? 'modal-container-male' : 'modal-container-female'}`}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ═══ Header ═══ */}
        <div className={`modal-header-gradient relative h-32 bg-gradient-to-br ${divConfig.gradient} overflow-hidden`}>
          {/* Animated shimmer */}
          <div
            className="absolute inset-0 animate-[shimmer_4s_ease-in-out_infinite]"
            style={{ background: 'radial-gradient(circle at 30% 60%, rgba(255,255,255,0.08) 0%, transparent 50%)' }}
          />
          {/* Decorative dots */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `radial-gradient(circle, ${divConfig.color} 1px, transparent 1px)`,
              backgroundSize: '16px 16px',
            }}
          />

          <div className="relative z-10 flex items-center gap-3 p-5 h-full">
            <div
              className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg"
              style={{ boxShadow: `0 0 25px rgba(${divConfig.colorRgb},0.3)` }}
            >
              <CreditCard className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white drop-shadow-sm">
                Pembayaran
              </h2>
              <p className="text-[11px] text-white/80 flex items-center gap-1.5">
                <span>{divConfig.icon}</span>
                <span>{divConfig.label}</span>
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="modal-close-dark absolute top-3 right-3 z-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ═══ Content ═══ */}
        <div className="modal-body modal-scroll space-y-4">

          {/* ── Registration Fee Notice ── */}
          <div
            className="flex items-start gap-3 p-4 rounded-2xl border"
            style={{
              background: `linear-gradient(135deg, rgba(${divConfig.colorRgb},0.06) 0%, rgba(${divConfig.colorRgb},0.02) 100%)`,
              borderColor: `rgba(${divConfig.colorRgb},0.15)`,
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `rgba(${divConfig.colorRgb},0.12)` }}
            >
              <Wallet className="w-4 h-4" style={{ color: divConfig.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Biaya Registrasi</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sesuai ketentuan yang berlaku</p>
            </div>
            <Shield className="w-5 h-5 text-idm-gold-warm/40 shrink-0 mt-0.5" />
          </div>

          {/* ── Payment Instructions ── */}
          {instructions && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-muted/40 border border-border/30">
              <Info className="w-4 h-4 text-idm-gold-warm shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">{instructions}</p>
            </div>
          )}

          {/* ── Account Holder ── */}
          {holder && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border/30">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Atas Nama</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{holder}</p>
              </div>
              <button
                onClick={() => handleCopy(holder, 'holder')}
                className="p-2 rounded-xl hover:bg-muted transition-colors cursor-pointer"
                title="Salin nama"
              >
                {copiedKey === 'holder' ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
          )}

          {/* ── Payment Method Tabs ── */}
          {hasAnyPayment && availablePayments.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {availablePayments.map(pm => {
                const PmIcon = pm.icon;
                return (
                  <button
                    key={pm.key}
                    onClick={() => setSelectedPayment(pm.key)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold border transition-all duration-200 cursor-pointer ${
                      activePayment === pm.key
                        ? `${pm.bgColor} ${pm.textColor} ${pm.activeBorderColor} border-2 shadow-sm`
                        : 'border-border/30 text-muted-foreground hover:text-foreground hover:border-border/50'
                    }`}
                  >
                    <PmIcon className="w-3.5 h-3.5" />
                    {pm.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Payment Display (QR or Phone) ── */}
          {hasAnyPayment && activePM && (
            <div key={activePayment} className="flex flex-col items-center animate-[fadeIn_200ms_ease-out]">
              {activePM.mode === 'qr' ? (
                /* QRIS Display */
                <div className={`relative w-52 h-52 rounded-2xl border-2 ${activePM.borderColor} ${activePM.bgColor} p-3 overflow-hidden`}>
                  <Image
                    src={cmsSettings[activePM.settingKey] || ''}
                    alt="QRIS Code"
                    fill
                    className="object-contain p-1"
                    unoptimized
                  />
                </div>
              ) : (
                /* Phone Number Display */
                <div className={`w-full max-w-[300px] rounded-2xl border-2 ${activePM.borderColor} ${activePM.bgColor} p-5`}>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Phone className={`w-4 h-4 ${activePM.textColor}`} />
                    <span className={`text-sm font-bold ${activePM.textColor}`}>{activePM.label}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 bg-background/80 rounded-2xl px-4 py-3.5 border border-border/30">
                    <span className="text-lg font-mono font-bold tracking-wider">{getPaymentValue(activePM)}</span>
                    <button
                      onClick={() => handleCopy(getPaymentValue(activePM), activePM.key)}
                      className="p-2 rounded-xl hover:bg-muted transition-colors shrink-0 cursor-pointer"
                      title={`Salin nomor ${activePM.label}`}
                    >
                      {copiedKey === activePM.key ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-center text-muted-foreground/70 mt-2.5">{activePM.description}</p>
                </div>
              )}
            </div>
          )}

          {/* ── No Payment Configured ── */}
          {!hasAnyPayment && (
            <div className="text-center py-6">
              <Wallet className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground/60">Info pembayaran belum dikonfigurasi admin.</p>
              <p className="text-[10px] text-muted-foreground/40 mt-1">Hubungi admin untuk detail transfer.</p>
            </div>
          )}

          {/* ── Payment Notes ── */}
          {paymentNotes && (
            <p className="text-[11px] text-center text-muted-foreground/70 leading-relaxed">
              💡 {paymentNotes}
            </p>
          )}

          {/* ── WhatsApp Button ── */}
          {adminWaLink && (
            <a
              href={adminWaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-sm font-bold transition-all duration-200 shadow-lg shadow-green-500/20 hover:shadow-green-500/30"
            >
              <MessageCircle className="w-4 h-4" />
              Kirim Bukti Pembayaran
              <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
            </a>
          )}

          {/* ── Reminder ── */}
          <p className="text-[11px] text-center text-muted-foreground/60 leading-relaxed">
            ⏳ Pendaftaran akan disetujui admin setelah bukti pembayaran dikonfirmasi
          </p>

        </div>
      </div>
    </div>,
    document.body
  );
}
