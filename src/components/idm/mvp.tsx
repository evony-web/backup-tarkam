'use client';

import { Star, Trophy, Gamepad2, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const mvpPlayers = [
  {
    name: 'NightShade',
    team: 'RRQ Sage',
    game: 'Mobile Legends',
    role: 'Jungler',
    kd: '8.5',
    winRate: '78%',
    mvpCount: 12,
    avatar: '/player-1.png'
  },
  {
    name: 'DragonX',
    team: 'EVOS Legends',
    game: 'Mobile Legends',
    role: 'Mid Laner',
    kd: '7.2',
    winRate: '75%',
    mvpCount: 10,
    avatar: '/player-2.png'
  },
  {
    name: 'Phoenix',
    team: 'ONIC Esports',
    game: 'Mobile Legends',
    role: 'Gold Laner',
    kd: '6.8',
    winRate: '72%',
    mvpCount: 8,
    avatar: '/player-3.png'
  }
];

export function MVP() {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="bg-gradient-to-b from-stone-50 via-white to-stone-50 dark:from-background dark:via-background dark:to-background" />

      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center items-center gap-2 mb-4">
            <Star className="w-10 h-10 text-purple-500 fill-purple-500" />
            <Star className="w-12 h-12 text-amber-500 fill-amber-500" />
            <Star className="w-10 h-10 text-purple-500 fill-purple-500" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-2">
            MVP <span className="text-purple-500">SPOTLIGHT</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Pemain terbaik yang menunjukkan performa luar biasa
          </p>
        </div>

        {/* MVP Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {mvpPlayers.map((player, index) => (
            <Card
              key={player.name}
              className="relative overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800 hover:border-purple-500/50 transition-all group"
            >
              {/* MVP Badge */}
              {index === 0 && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />
              )}

              <CardContent className="p-6">
                {/* Player Avatar & Info */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Gamepad2 className="w-8 h-8 text-white" />
                    </div>
                    {index === 0 && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                        <Trophy className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {player.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{player.team}</p>
                    <Badge className="mt-1 bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                      {player.role}
                    </Badge>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 sm:p-4 text-center">
                    <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">K/D</p>
                    <p className="font-bold text-gray-900 dark:text-white">{player.kd}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 sm:p-4 text-center">
                    <Trophy className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">Win Rate</p>
                    <p className="font-bold text-gray-900 dark:text-white">{player.winRate}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 sm:p-4 text-center">
                    <Star className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">MVP</p>
                    <p className="font-bold text-gray-900 dark:text-white">{player.mvpCount}</p>
                  </div>
                </div>

                {/* Game Badge */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                    {player.game}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
