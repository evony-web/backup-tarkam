'use client';

import { Users, Trophy, Gamepad2, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const clubs = [
  {
    name: 'RRQ Sage',
    location: 'Jakarta',
    members: 15,
    tournaments: 25,
    wins: 12,
    game: 'Mobile Legends',
    color: 'from-cyan-500 to-blue-500'
  },
  {
    name: 'EVOS Legends',
    location: 'Surabaya',
    members: 20,
    tournaments: 30,
    wins: 10,
    game: 'Mobile Legends',
    color: 'from-purple-500 to-indigo-500'
  },
  {
    name: 'ONIC Esports',
    location: 'Bandung',
    members: 18,
    tournaments: 28,
    wins: 8,
    game: 'Mobile Legends',
    color: 'from-amber-500 to-orange-500'
  },
  {
    name: 'Bigetron Alpha',
    location: 'Medan',
    members: 12,
    tournaments: 20,
    wins: 6,
    game: 'PUBG Mobile',
    color: 'from-red-500 to-rose-500'
  },
  {
    name: 'Alter Ego',
    location: 'Yogyakarta',
    members: 16,
    tournaments: 22,
    wins: 7,
    game: 'Free Fire',
    color: 'from-green-500 to-emerald-500'
  },
  {
    name: 'Rebellion',
    location: 'Bali',
    members: 14,
    tournaments: 18,
    wins: 5,
    game: 'Mobile Legends',
    color: 'from-pink-500 to-purple-500'
  }
];

export function ClubPeserta() {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="bg-gradient-to-b from-stone-50 via-white to-stone-50 dark:from-background dark:via-background dark:to-background" />

      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <Users className="w-12 h-12 mx-auto mb-4 text-cyan-500" />
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-2">
            CLUB <span className="text-cyan-500">PESERTA</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Tim-tim profesional yang telah bergabung dalam turnamen kami
          </p>
        </div>

        {/* Clubs Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {clubs.map((club) => (
            <Card
              key={club.name}
              className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800 hover:border-cyan-500/50 transition-all group"
            >
              <CardContent className="p-6">
                {/* Club Header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${club.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <Gamepad2 className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {club.name}
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                      <MapPin className="w-3 h-3" />
                      {club.location}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 sm:p-4 text-center">
                    <Users className="w-4 h-4 mx-auto mb-1 text-cyan-500" />
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{club.members}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Members</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 sm:p-4 text-center">
                    <Trophy className="w-4 h-4 mx-auto mb-1 text-amber-500" />
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{club.tournaments}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tournaments</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 sm:p-4 text-center">
                    <Trophy className="w-4 h-4 mx-auto mb-1 text-green-500" />
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{club.wins}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Wins</p>
                  </div>
                </div>

                {/* Game Badge */}
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                  {club.game}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
