'use client';

import { Sparkles, Trophy, MessageCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function CTA() {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="bg-gradient-to-b from-stone-50 via-white to-stone-50 dark:from-background dark:via-background dark:to-background" />

      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="relative overflow-hidden bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 border-cyan-500/30">
          {/* Decorative Elements */}
          <div className="absolute inset-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
          </div>

          <CardContent className="relative p-8 sm:p-12 text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-6 text-amber-500" />

            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white mb-4">
              Ready to Compete?
            </h2>

            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
              Bergabung dengan ribuan pemain lainnya dan tunjukkan skill gaming-mu di platform
              turnamen esports profesional kami! Jadilah bagian dari komunitas gaming Indonesia.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold px-8"
              >
                <Trophy className="w-5 h-5 mr-2" />
                Join Tournament
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-green-500/50 text-green-500 hover:bg-green-500/10 px-8"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Register via WhatsApp
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-6 mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-500">50+</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tournaments</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-500">1.2K+</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Players</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-500">Rp 100M+</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Prize Pool</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">24/7</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Support</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
