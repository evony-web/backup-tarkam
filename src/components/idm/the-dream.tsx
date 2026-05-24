'use client';

import { Target, Trophy, Star, Rocket, Heart, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const seasonGoals = [
  {
    icon: Trophy,
    title: '100+ Tournaments',
    description: 'Menyelenggarakan lebih dari 100 turnamen esports profesional',
    progress: 65,
    color: 'from-cyan-500 to-blue-500'
  },
  {
    icon: Star,
    title: '5.000+ Players',
    description: 'Membangun komunitas pemain aktif yang solid',
    progress: 48,
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: Rocket,
    title: 'Rp 500M Prize Pool',
    description: 'Total hadiah yang dibagikan sepanjang season',
    progress: 35,
    color: 'from-amber-500 to-orange-500'
  },
  {
    icon: Heart,
    title: 'Community Events',
    description: 'Event komunitas dan gathering offline',
    progress: 80,
    color: 'from-pink-500 to-rose-500'
  }
];

export function TheDream() {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="bg-gradient-to-b from-stone-50 via-white to-stone-50 dark:from-background dark:via-background dark:to-background" />

      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <Target className="w-12 h-12 mx-auto mb-4 text-cyan-500" />
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-2">
            THE DREAM: <span className="text-cyan-500">SEASON GOALS</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Visi dan target kami untuk mengembangkan ekosistem esports Indonesia
          </p>
        </div>

        {/* Goals Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {seasonGoals.map((goal) => (
            <Card
              key={goal.title}
              className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800 hover:border-cyan-500/50 transition-all"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${goal.color} flex items-center justify-center flex-shrink-0`}>
                    <goal.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                      {goal.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {goal.description}
                    </p>
                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Progress</span>
                        <span>{goal.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${goal.color} rounded-full transition-all`}
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mission Statement */}
        <Card className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-500/30">
          <CardContent className="p-8 text-center">
            <Sparkles className="w-10 h-10 mx-auto mb-4 text-amber-500" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Our Mission
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Membangun platform esports yang inklusif, profesional, dan menyenangkan untuk semua
              pemain di Indonesia. Kami percaya bahwa setiap pemain berhak mendapat kesempatan
              untuk berkompetisi dan berkembang.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
