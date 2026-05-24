'use client';

import {
  Gift, Plus, Loader2, Clock, CheckCircle2, XCircle, Wallet, Save,
  UserPlus, MessageCircle, FileText, Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { getOptimizedCloudinaryUrl } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { UseMutationResult } from '@tanstack/react-query';

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

interface AdminKeuanganTabProps {
  donations: any;
  division: string;
  addDonation: UseMutationResult<any, Error, { donorName: string; amount: number; message: string; type: string; tournamentId?: string }, unknown>;
  approveDonation: UseMutationResult<any, Error, { id: string; status: 'approved' | 'rejected' }, unknown>;
  deleteDonation: UseMutationResult<any, Error, string, unknown>;
  newDonation: { donorName: string; amount: string; message: string; type: string };
  setNewDonation: (fn: ((prev: { donorName: string; amount: string; message: string; type: string }) => { donorName: string; amount: string; message: string; type: string }) | { donorName: string; amount: string; message: string; type: string }) => void;
  paymentForm: Record<string, string>;
  updatePaymentForm: (updates: Partial<Record<string, string>>) => void;
  savePaymentSettingsBatch: UseMutationResult<any, Error, { key: string; value: string; type?: string }[], unknown>;
  setQrisPickerOpen: (open: boolean) => void;
  setConfirmDialog: (state: ConfirmDialogState) => void;
  dt: ReturnType<typeof import('@/hooks/use-division-theme')['useDivisionTheme']>;
}

export function AdminKeuanganTab({
  donations,
  division,
  addDonation,
  approveDonation,
  deleteDonation,
  newDonation,
  setNewDonation,
  paymentForm,
  updatePaymentForm,
  savePaymentSettingsBatch,
  setQrisPickerOpen,
  setConfirmDialog,
  dt,
}: AdminKeuanganTabProps) {
  return (
    <div className="space-y-4">
      {/* Pending Donations — Approval Queue */}
      {donations?.donations?.filter((d: { status: string }) => d.status === 'pending').length > 0 && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-yellow-500">
              <Clock className="w-4 h-4" /> Menunggu Persetujuan ({donations.donations.filter((d: { status: string }) => d.status === 'pending').length})
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {donations.donations.filter((d: { status: string }) => d.status === 'pending').map((d: { id: string; donorName: string; amount: number; message: string | null; type: string; createdAt: string }, index) => (
                <div key={d.id} className="p-4 sm:p-5 rounded-2xl bg-card border border-yellow-500/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Gift className="w-4 h-4 text-yellow-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{d.donorName}</p>
                          <Badge className="text-[9px] border-0 bg-[#57B5FF]/10 text-[#57B5FF]">{d.type === 'season' ? 'Donasi' : 'Sawer'}</Badge>
                        </div>
                        {d.message && <p className="text-[10px] text-muted-foreground truncate">{d.message}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-yellow-500">{formatCurrency(d.amount)}</span>
                      <Button size="sm" className="h-7 text-[10px] bg-green-600 hover:bg-green-700 text-white px-2"
                        onClick={() => approveDonation.mutate({ id: d.id, status: 'approved' })}
                        disabled={approveDonation.isPending}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] text-red-500 hover:text-red-400 hover:bg-red-500/10 px-2"
                        onClick={() => approveDonation.mutate({ id: d.id, status: 'rejected' })}
                        disabled={approveDonation.isPending}>
                        <XCircle className="w-3 h-3 mr-1" /> Tolak
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Donation */}
      <Card className={dt.casinoCard}>
        <div className={dt.casinoBar} />
        <CardContent className="p-4 relative z-10">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Plus className={`w-4 h-4 ${dt.neonText}`} /> Tambah Donasi Manual
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <Input placeholder="Nama Donatur" value={newDonation.donorName} onChange={(e) => setNewDonation(p => ({ ...p, donorName: e.target.value }))} />
            <Input placeholder="Jumlah (IDR)" type="number" value={newDonation.amount} onChange={(e) => setNewDonation(p => ({ ...p, amount: e.target.value }))} />
            <Select value={newDonation.type} onValueChange={(v) => setNewDonation(p => ({ ...p, type: v }))}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="season">Donasi</SelectItem>
                <SelectItem value="weekly">Sawer</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Pesan" value={newDonation.message} onChange={(e) => setNewDonation(p => ({ ...p, message: e.target.value }))} />
            <Button size="sm" disabled={!newDonation.donorName || !newDonation.amount || addDonation.isPending}
              onClick={() => { addDonation.mutate({ donorName: newDonation.donorName, amount: parseInt(newDonation.amount) || 0, message: newDonation.message, type: newDonation.type }); setNewDonation({ donorName: '', amount: '', message: '', type: 'weekly' }); }}>
              {addDonation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />} Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* All Donations List */}
      <Card className="border border-border/50">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Gift className="w-4 h-4 text-idm-gold-warm" /> Semua Donasi
          </h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
            {donations?.donations?.length > 0 ? donations.donations.map((d: { id: string; donorName: string; amount: number; message: string | null; type: string; status: string; createdAt: string }, index) => (
              <div key={d.id} className={`flex items-center justify-between p-3 sm:p-4 rounded-lg border ${
                d.status === 'approved' ? 'bg-card border-green-500/10' :
                d.status === 'rejected' ? 'bg-card border-red-500/10 opacity-50' :
                'bg-card border-yellow-500/10'
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  <Gift className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium truncate">{d.donorName}</p>
                      <Badge className={`text-[8px] border-0 ${d.type === 'season' ? 'bg-[#57B5FF]/10 text-[#57B5FF]' : 'bg-idm-gold-warm/10 text-idm-gold-warm'}`}>{d.type === 'season' ? 'Donasi' : 'Sawer'}</Badge>
                      {d.status === 'approved' && <Badge className="text-[8px] border-0 bg-green-500/10 text-green-500">✓</Badge>}
                      {d.status === 'rejected' && <Badge className="text-[8px] border-0 bg-red-500/10 text-red-500">✗</Badge>}
                    </div>
                    {d.message && <p className="text-[10px] text-muted-foreground truncate">{d.message}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold">{formatCurrency(d.amount)}</span>
                  {d.status === 'pending' && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 touch-icon text-green-500 hover:bg-green-500/10"
                      onClick={() => approveDonation.mutate({ id: d.id, status: 'approved' })}>
                      <CheckCircle2 className="w-3 h-3" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 touch-icon text-red-500 hover:bg-red-500/10"
                    onClick={() => setConfirmDialog({ open: true, title: 'Hapus Donasi?', description: `Hapus donasi dari "${d.donorName}" sebesar ${formatCurrency(d.amount)}?`, onConfirm: () => deleteDonation.mutate(d.id) })}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4">Belum ada donasi</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card className="border border-border/50">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="w-4 h-4 text-idm-gold-warm" /> Pembayaran Donasi
            <Badge className="text-[8px] border-0 bg-cyan-500/10 text-cyan-400">Payment</Badge>
          </h3>
          <p className="text-[10px] text-muted-foreground">QRIS menggunakan QR code image, e-wallet menggunakan nomor handphone untuk transfer.</p>
          <div className="space-y-3">
            {/* QRIS — QR code image */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-idm-gold-warm" /> QRIS (Universal)
              </label>
              <div className="flex items-center gap-2">
                <Input value={paymentForm.donation_qris_image || ''} onChange={(e) => updatePaymentForm({ donation_qris_image: e.target.value })} className="text-xs flex-1" placeholder="URL gambar QR code" />
                <Button type="button" variant="outline" size="sm" className="h-8 text-[10px] shrink-0" onClick={() => setQrisPickerOpen(true)}>Upload</Button>
              </div>
              {paymentForm.donation_qris_image && (
                <div className="w-20 h-20 rounded-lg overflow-hidden border border-border/30 bg-muted/20">
                  <Image src={getOptimizedCloudinaryUrl(paymentForm.donation_qris_image, 160)} alt="QRIS Preview" width={80} height={80} className="w-full h-full object-contain" />
                </div>
              )}
            </div>

            <div className="h-px bg-border/20" />
            <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">E-Wallet (Nomor HP)</p>

            {/* DANA — phone number */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#108ee9]" /> DANA
              </label>
              <Input value={paymentForm.donation_dana_number || ''} onChange={(e) => updatePaymentForm({ donation_dana_number: e.target.value })} className="text-sm" placeholder="Contoh: 081234567890" />
            </div>
            {/* OVO — phone number */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#4c3494]" /> OVO
              </label>
              <Input value={paymentForm.donation_ovo_number || ''} onChange={(e) => updatePaymentForm({ donation_ovo_number: e.target.value })} className="text-sm" placeholder="Contoh: 081234567890" />
            </div>
            {/* ShopeePay — phone number */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ee4d2d]" /> ShopeePay
              </label>
              <Input value={paymentForm.donation_shopeepay_number || ''} onChange={(e) => updatePaymentForm({ donation_shopeepay_number: e.target.value })} className="text-sm" placeholder="Contoh: 081234567890" />
            </div>

            <div className="h-px bg-border/20" />

            {/* Holder */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nama Penerima (a.n.)</label>
              <Input value={paymentForm.donation_payment_holder || ''} onChange={(e) => updatePaymentForm({ donation_payment_holder: e.target.value })} className="text-sm" placeholder="Contoh: Admin Tarkam IDM" />
            </div>
            {/* Notes */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Catatan Pembayaran</label>
              <Textarea value={paymentForm.donation_payment_notes || ''} onChange={(e) => updatePaymentForm({ donation_payment_notes: e.target.value })} className="text-sm" placeholder="Contoh: Konfirmasi ke admin via WhatsApp" rows={2} />
            </div>
          </div>
          <Button size="sm" className="text-[10px] bg-idm-gold-warm hover:bg-[#D69E2E] text-black"
            onClick={() => {
              savePaymentSettingsBatch.mutate([
                { key: 'donation_qris_image', value: paymentForm.donation_qris_image || '', type: 'image' },
                { key: 'donation_dana_number', value: paymentForm.donation_dana_number || '', type: 'text' },
                { key: 'donation_ovo_number', value: paymentForm.donation_ovo_number || '', type: 'text' },
                { key: 'donation_shopeepay_number', value: paymentForm.donation_shopeepay_number || '', type: 'text' },
                { key: 'donation_payment_holder', value: paymentForm.donation_payment_holder || '', type: 'text' },
                { key: 'donation_payment_notes', value: paymentForm.donation_payment_notes || '', type: 'text' },
                { key: 'registration_admin_wa_link', value: paymentForm.registration_admin_wa_link || '', type: 'text' },
                { key: 'registration_payment_instructions', value: paymentForm.registration_payment_instructions || '', type: 'text' },
              ]);
            }}
            disabled={savePaymentSettingsBatch.isPending}>
            {savePaymentSettingsBatch.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />} Simpan Pembayaran
          </Button>
        </CardContent>
      </Card>

      {/* Registration Payment Settings */}
      <Card className="border border-idm-gold-warm/20 bg-idm-gold-warm/[0.02]">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-idm-gold-warm" /> Pembayaran Registrasi
            <Badge className="text-[8px] border-0 bg-idm-gold-warm/10 text-idm-gold-warm">Registration</Badge>
          </h3>
          <p className="text-[10px] text-muted-foreground">Pengaturan info pembayaran yang ditampilkan setelah peserta berhasil mendaftar. Metode pembayaran (DANA/OVO/ShopeePay/QRIS) menggunakan data dari kartu &quot;Pembayaran Donasi&quot; di atas.</p>

          <div className="space-y-3">
            {/* Admin WhatsApp Link */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MessageCircle className="w-3 h-3 text-green-500" /> Link WhatsApp Admin
              </label>
              <Input value={paymentForm.registration_admin_wa_link || ''} onChange={(e) => updatePaymentForm({ registration_admin_wa_link: e.target.value })} className="text-sm" placeholder="Contoh: https://wa.me/6281234567890" />
              <p className="text-[10px] text-muted-foreground">Link WA admin untuk peserta mengirim bukti pembayaran. Format: https://wa.me/62xxxxxxxxxx</p>
            </div>

            {/* Payment Instructions */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-idm-gold-warm" /> Instruksi Pembayaran
              </label>
              <Textarea value={paymentForm.registration_payment_instructions || ''} onChange={(e) => updatePaymentForm({ registration_payment_instructions: e.target.value })} className="text-sm" placeholder="Instruksi untuk peserta setelah mendaftar..." rows={3} />
              <p className="text-[10px] text-muted-foreground">Instruksi yang ditampilkan setelah pendaftaran berhasil. Jangan tuliskan nominal — cukup &quot;sesuai ketentuan yang berlaku&quot;.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
