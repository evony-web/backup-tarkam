'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Wallet, Phone, MessageCircle, Copy, CheckCircle2, ExternalLink
} from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

interface PaymentMethodInfo {
  key: string;
  label: string;
  value: string;
  color: string;
  icon: string;
}

const PAYMENT_METHODS: PaymentMethodInfo[] = [
  { key: 'donation_dana_number', label: 'DANA', value: '', color: '#108ee9', icon: '💳' },
  { key: 'donation_ovo_number', label: 'OVO', value: '', color: '#4c3494', icon: '💳' },
  { key: 'donation_shopeepay_number', label: 'ShopeePay', value: '', color: '#ee4d2d', icon: '💳' },
];

export function RegistrationPaymentInfo() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: cmsSettings } = useQuery({
    queryKey: ['cms-settings-registration'],
    queryFn: async () => {
      const res = await fetch('/api/cms/settings');
      const d = await res.json();
      return (d?.map || {}) as Record<string, string>;
    },
    staleTime: 60_000,
  });

  const adminWaLink = cmsSettings?.registration_admin_wa_link || '';
  const instructions = cmsSettings?.registration_payment_instructions || '';
  const holder = cmsSettings?.donation_payment_holder || '';
  const qrisImage = cmsSettings?.donation_qris_image || '';

  // Build available payment methods
  const availableMethods = PAYMENT_METHODS.filter(m => cmsSettings?.[m.key]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Don't render if no payment info configured
  if (availableMethods.length === 0 && !qrisImage && !adminWaLink && !instructions) {
    return null;
  }

  return (
    <div className="space-y-3 text-left">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-idm-gold-warm/10 flex items-center justify-center">
          <Wallet className="w-4 h-4 text-idm-gold-warm" />
        </div>
        <h4 className="text-sm font-bold text-idm-gold-warm">Pembayaran Registrasi</h4>
      </div>

      {/* Generic registration fee notice - always shown */}
      <div className="p-3 sm:p-4 rounded-lg bg-idm-gold-warm/10 border border-idm-gold-warm/20">
        <div className="flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5 text-idm-gold-warm shrink-0" />
          <p className="text-xs font-semibold text-idm-gold-warm">Biaya Registrasi</p>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">Sesuai ketentuan yang berlaku</p>
      </div>

      {/* Payment instructions */}
      {instructions && (
        <p className="text-xs text-muted-foreground leading-relaxed">{instructions}</p>
      )}

      {/* Account holder */}
      {holder && (
        <div className="p-3 sm:p-4 rounded-lg bg-muted/50 border border-border/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Atas Nama</p>
          <p className="text-xs font-medium">{holder}</p>
        </div>
      )}

      {/* E-Wallet numbers */}
      {availableMethods.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Metode Pembayaran</p>
          {availableMethods.map((method) => {
            const val = cmsSettings?.[method.key] || '';
            return (
              <div key={method.key} className="flex items-center justify-between p-3 sm:p-4 rounded-lg bg-muted/50 border border-border/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: method.color }} />
                  <span className="text-[11px] font-semibold text-muted-foreground shrink-0">{method.label}</span>
                  <span className="text-xs font-medium truncate">{val}</span>
                </div>
                <button
                  onClick={() => handleCopy(val, method.key)}
                  className="shrink-0 ml-2 w-6 h-6 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                  aria-label={`Salin nomor ${method.label}`}
                >
                  {copiedKey === method.key ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* QRIS */}
      {qrisImage && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">QRIS (Universal)</p>
          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-lg overflow-hidden border border-border/30 bg-white/5">
              <Image src={qrisImage} alt="QRIS Code" width={128} height={128} className="w-full h-full object-contain" unoptimized />
            </div>
          </div>
        </div>
      )}

      {/* Admin WA Button */}
      {adminWaLink && (
        <a
          href={adminWaLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Kirim Bukti Pembayaran via WhatsApp
          <ExternalLink className="w-3 h-3" />
        </a>
      )}

      {/* Reminder */}
      <p className="text-[10px] text-center text-muted-foreground">
        ⏳ Pendaftaran akan disetujui admin setelah bukti pembayaran dikonfirmasi
      </p>
    </div>
  );
}
