'use client';

import { Crown, Trophy, Medal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const champions = [
  {
    rank: 1,
    team: 'RRQ Sage',
    game: 'Mobile Legends',
    prize: 'Rp 5.000.000',
    members: ['NightShade', 'StormBreaker', 'SilentKiller', 'Ace', 'Phoenix'],
    avatar: '/team-1.png'
  },
  {
    rank: 2,
    team: 'EVOS Legends',
    game: 'Mobile Legends',
    prize: 'Rp 3.000.000',
    members: ['DragonX', 'Shadow', 'Thunder', 'Blaze', 'Frost'],
    avatar: '/team-2.png'
  },
  {
    rank: 3,
    team: 'ONIC Esports',
    game: 'Mobile Legends',
    prize: 'Rp 2.000.000',
    members: ['Swift', 'Razor', 'Viper', 'Hawk', 'Eagle'],
    avatar: '/team-3.png'
  }
];

export function Champions() {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="bg-gradient-to-b from-stone-50 via-white to-stone-50 dark:from-background dark:via-background dark:to-background" />

      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <Crown className="w-12 h-12 mx-auto mb-4 text-amber-500" />
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-2">
            HALL OF <span className="text-amber-500">CHAMPIONS</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Para juara yang telah membuktikan kemampuan terbaik mereka
          </p>
        </div>

        {/* Champions Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {champions.map((champion) => (
            <Card
              key={champion.rank}
              className={`relative overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-2 transition-all hover:scale-105 ${
                champion.rank === 1
                  ? 'border-amber-400 shadow-lg shadow-amber-500/20'
                  : champion.rank === 2
                  ? 'border-gray-300 dark:border-gray-600'
                  : 'border-amber-700'
              }`}
            >
              {/* Rank Badge */}
              <div
                className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  champion.rank === 1
                    ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white'
                    : champion.rank === 2
                    ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800'
                    : 'bg-gradient-to-br from-amber-600 to-amber-800 text-white'
                }`}
              >
                {champion.rank}
              </div>

              <CardContent className="p-6">
                {/* Team Info */}
                <div className="text-center mb-4">
                  <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {champion.team}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{champion.game}</p>
                </div>

                {/* Prize */}
                <div className="bg-amber-500/10 rounded-lg p-3 text-center mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Prize Pool</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {champion.prize}
                  </p>
                </div>

                {/* Members */}
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Members:</p>
                  <div className="flex flex-wrap gap-1">
                    {champion.members.map((member) => (
                      <span
                        key={member}
                        className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300"
                      >
                        {member}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
