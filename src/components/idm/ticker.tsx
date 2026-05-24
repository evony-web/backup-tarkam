'use client';

import { Trophy, Crown, Star, Zap } from 'lucide-react';

export function Ticker() {
  const announcements = [
    { icon: Trophy, text: 'Registration Open: MLBB Weekly Tournament #45', color: 'text-cyan-400' },
    { icon: Crown, text: 'Champions: Team RRQ Sage wins Season 3 Finals!', color: 'text-amber-400' },
    { icon: Star, text: 'MVP of the Week: NightShade from EVOS Legends', color: 'text-purple-400' },
    { icon: Zap, text: 'Special Event: Double Prize Pool this Weekend!', color: 'text-green-400' },
  ];

  return (
    <section className="relative py-3 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 dark:bg-background border-y border-amber-500/20 overflow-hidden">
      <div className="animate-marquee whitespace-nowrap flex items-center gap-8">
        {[...announcements, ...announcements].map((item, index) => (
          <div key={index} className="flex items-center gap-3 px-4">
            <item.icon className={`w-5 h-5 ${item.color}`} />
            <span className="text-gray-300 font-medium">{item.text}</span>
            <span className="text-amber-500 mx-4">•</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 50s linear infinite;
        }
      `}</style>
    </section>
  );
}
