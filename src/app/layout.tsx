import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Defer — not needed for first paint
});

export const metadata: Metadata = {
  metadataBase: new URL("https://idolmeta.vercel.app"),
  title: "TARKAM — Turnamen Idol Meta Indonesia",
  description: "Komunitas Idol Meta Indonesia. Turnamen dance rhythm mingguan, leaderboard, MVP, Sultan of the Week, dan komunitas terbesar. Gabung sekarang!",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo1.webp",
    apple: "/og-banner.png",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
  },

  // ── Open Graph ──
  openGraph: {
    title: "TARKAM — Turnamen Idol Meta Indonesia",
    description: "Komunitas Idol Meta Indonesia. Turnamen dance rhythm mingguan, leaderboard, MVP, Sultan of the Week, dan komunitas terbesar. Gabung sekarang!",
    url: "https://idolmeta.vercel.app",
    siteName: "TARKAM IDM",
    images: [
      {
        url: "https://idolmeta.vercel.app/og-banner.jpg",
        width: 1200,
        height: 630,
        alt: "TARKAM — Turnamen Idol Meta Indonesia",
      },
    ],
    locale: "id_ID",
    type: "website",
  },

  // ── Twitter Card ──
  twitter: {
    card: "summary_large_image",
    title: "TARKAM — Turnamen Idol Meta Indonesia",
    description: "Komunitas Idol Meta Indonesia. Turnamen dance rhythm mingguan, leaderboard, MVP, dan komunitas terbesar.",
    images: ["https://idolmeta.vercel.app/og-banner.jpg"],
  },

  keywords: ["TARKAM", "IDM", "Idol Meta", "turnamen", "dance", "rhythm", "komunitas", "leaderboard", "MVP"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#080a14" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://va.vercel-scripts.com" />

        {/* PWA: Register service worker (async to avoid render-blocking) */}
        <script
          async
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-center" />
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
