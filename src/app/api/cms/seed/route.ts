import { db, neonDeleteMany, isPostgreSQL } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

// POST seed default CMS content
export async function POST(request: Request) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    // Seed default settings
    const defaultSettings = [
      { key: 'logo_url', value: '/logo1.webp', type: 'image' },
      { key: 'site_title', value: 'IDM League', type: 'text' },
      { key: 'hero_title', value: 'Idol Meta', type: 'text' },
      { key: 'hero_subtitle', value: 'Fan Made Edition', type: 'text' },
      { key: 'hero_tagline', value: 'Tempat dancer terbaik berkompetisi. Tournament mingguan, tarkam profesional, dan podium yang menunggu.', type: 'text' },
      { key: 'hero_bg_desktop', value: '', type: 'image' },
      { key: 'hero_bg_mobile', value: '', type: 'image' },
      { key: 'footer_text', value: '© 2026 TARKAM IDM — Idol Meta Fan Made Edition.', type: 'text' },
      { key: 'footer_tagline', value: 'Idol Meta Fane Made Edition.', type: 'text' },
      { key: 'social_discord_url', value: '#', type: 'text' },
      { key: 'social_instagram_url', value: '#', type: 'text' },
      { key: 'social_youtube_url', value: '#', type: 'text' },
      { key: 'social_whatsapp_url', value: '#', type: 'text' },
      { key: 'donation_qris_image', value: '', type: 'image' },
      { key: 'donation_dana_number', value: '', type: 'text' },
      { key: 'donation_ovo_number', value: '', type: 'text' },
      { key: 'donation_shopeepay_number', value: '', type: 'text' },
      { key: 'donation_payment_holder', value: '', type: 'text' },
      { key: 'donation_payment_notes', value: '', type: 'text' },
      // Registration payment settings
      { key: 'registration_admin_wa_link', value: '', type: 'text' },
      { key: 'registration_payment_instructions', value: 'Silakan transfer biaya pendaftaran sesuai ketentuan yang berlaku ke salah satu metode pembayaran di atas, lalu kirim bukti pembayaran ke admin via WhatsApp.', type: 'text' },
      // Background images — managed via admin CMS
      { key: 'bg_male', value: '', type: 'image' },
      { key: 'bg_female', value: '', type: 'image' },
      { key: 'hero_banner_dashboard', value: '', type: 'image' },
    ];

    for (const s of defaultSettings) {
      await db.cmsSetting.upsert({
        where: { key: s.key },
        update: { value: s.value, type: s.type },
        create: s,
      });
    }

    // Seed default sections
    const defaultSections = [
      { slug: 'hero', title: 'Hero Section', subtitle: 'Landing Hero', description: 'Bagian utama hero di halaman landing', order: 1 },
      { slug: 'kompetisi', title: 'Kompetisi', subtitle: 'Tournament & Tarkam', description: 'Informasi tournament mingguan dan tarkam profesional', order: 2 },
      { slug: 'clubs', title: 'Club', subtitle: 'Club Peserta', description: 'Daftar club peserta tarkam', order: 3 },
      { slug: 'footer', title: 'Footer', subtitle: 'Informasi', description: 'Bagian bawah website dengan informasi tambahan', order: 4 },
    ];

    for (const s of defaultSections) {
      await db.cmsSection.upsert({
        where: { slug: s.slug },
        update: { title: s.title, subtitle: s.subtitle, description: s.description, order: s.order },
        create: { ...s, isActive: true },
      });
    }

    // Migrate legacy e-wallet _image keys to _number keys
    for (const migration of [
      { from: 'donation_dana_image', to: 'donation_dana_number' },
      { from: 'donation_ovo_image', to: 'donation_ovo_number' },
      { from: 'donation_shopeepay_image', to: 'donation_shopeepay_number' },
    ]) {
      const oldSetting = await db.cmsSetting.findUnique({ where: { key: migration.from } });
      if (oldSetting && oldSetting.value) {
        // Check if it's a phone number (not a URL)
        const isPhoneNumber = oldSetting.value && !oldSetting.value.startsWith('http') && !oldSetting.value.startsWith('/');
        if (isPhoneNumber) {
          // Move value to new number key
          await db.cmsSetting.upsert({
            where: { key: migration.to },
            update: { value: oldSetting.value },
            create: { key: migration.to, value: oldSetting.value, type: 'text' },
          });
          // Clear the old image key
          await db.cmsSetting.update({ where: { key: migration.from }, data: { value: '' } });
        }
      }
    }

    // Remove legacy sections that are no longer on the landing page
    // Also remove legacy settings that are no longer used on the landing page
    const legacySettingKeys = [
      'nav_cta_male_text', 'nav_cta_female_text',
      'about_origin_story', 'about_season1_text', 'about_tagline',
      'cta_title', 'cta_description', 'cta_button_primary_text', 'cta_button_secondary_text',
      'cta_badge_1_value', 'cta_badge_1_label',
      'cta_badge_2_value', 'cta_badge_2_label',
      'cta_badge_3_value', 'cta_badge_3_label',
    ];
    for (const key of legacySettingKeys) {
      try {
        await db.cmsSetting.delete({ where: { key } });
      } catch { /* already deleted — ignore */ }
    }

    for (const legacySlug of ['gallery', 'sawer', 'howitworks', 'header', 'about', 'champions', 'mvp', 'cta']) {
      const legacy = await db.cmsSection.findUnique({ where: { slug: legacySlug } });
      if (legacy) {
        // Neon workaround: deleteMany() doesn't work with PrismaNeonHttp
        if (isPostgreSQL) {
          await neonDeleteMany('CmsCard', [{ column: 'sectionId', operator: '=', value: legacy.id }]);
        } else {
          await db.cmsCard.deleteMany({ where: { sectionId: legacy.id } });
        }
        await db.cmsSection.delete({ where: { slug: legacySlug } });
      }
    }

    // Helper: idempotent card seed — skip if cards already exist for section
    async function seedCardsForSection(sectionSlug: string, cards: { title: string; subtitle?: string; description?: string; imageUrl?: string; linkUrl?: string; tag?: string; tagColor?: string; order: number }[]) {
      const section = await db.cmsSection.findUnique({ where: { slug: sectionSlug } });
      if (!section) return;
      const existingCards = await db.cmsCard.count({ where: { sectionId: section.id } });
      if (existingCards > 0) return; // Already seeded — skip
      for (const card of cards) {
        await db.cmsCard.create({
          data: { sectionId: section.id, ...card },
        });
      }
    }

    // Seed default cards for hero section (hero badges)
    await seedCardsForSection('hero', [
      { title: 'Season 1', tag: 'badge', tagColor: '#EFF923', order: 1 },
      { title: 'Dance Tournament', tag: 'badge', tagColor: '#EFF923', order: 2 },
      { title: 'Pro League', tag: 'badge', tagColor: '#EFF923', order: 3 },
    ]);

    return NextResponse.json({ success: true, message: 'CMS content seeded successfully' });
  } catch (error) {
    console.error('CMS seed error:', error);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}
