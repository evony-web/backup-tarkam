'use client';

import { Trophy, Mail, Phone, MapPin, MessageCircle, Instagram, Youtube, Twitch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function IDTFooter() {
  return (
    <footer className="relative bg-stone-900 dark:bg-background border-t border-amber-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Premium top divider glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-px bg-gradient-to-r from-transparent via-idm-gold/30 to-transparent" />

        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">IDOL META</h3>
                <p className="text-xs text-amber-400">FAN MADE EDITION</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Platform turnamen esports profesional untuk komunitas gaming Indonesia.
            </p>
            <div className="flex gap-3">
              <a
                href="#"
                className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-green-500/20 flex items-center justify-center transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-gray-400 hover:text-green-400" />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-pink-500/20 flex items-center justify-center transition-colors"
              >
                <Instagram className="w-4 h-4 text-gray-400 hover:text-pink-400" />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-red-500/20 flex items-center justify-center transition-colors"
              >
                <Youtube className="w-4 h-4 text-gray-400 hover:text-red-400" />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-purple-500/20 flex items-center justify-center transition-colors"
              >
                <Twitch className="w-4 h-4 text-gray-400 hover:text-purple-400" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-sm text-white mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {['Home', 'Tournaments', 'Leaderboard', 'Gallery', 'About Us'].map((link) => (
                <li key={link}>
                  <a
                    href="#"
                    className="text-gray-400 hover:text-amber-400 transition-colors text-sm"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Divisions */}
          <div>
            <h4 className="font-bold text-sm text-white mb-4">Divisions</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="#"
                  className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm"
                >
                  MALE Division
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-purple-400 hover:text-purple-300 transition-colors text-sm"
                >
                  FEMALE Division
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-amber-400 hover:text-amber-300 transition-colors text-sm"
                >
                  MIX Division
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-sm text-white mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-gray-400 text-sm">
                <Mail className="w-4 h-4 text-amber-400" />
                contact@idolmeta.id
              </li>
              <li className="flex items-center gap-2 text-gray-400 text-sm">
                <Phone className="w-4 h-4 text-amber-400" />
                +62 812-3456-7890
              </li>
              <li className="flex items-start gap-2 text-gray-400 text-sm">
                <MapPin className="w-4 h-4 text-amber-400 mt-0.5" />
                Jakarta, Indonesia
              </li>
            </ul>

            {/* Newsletter */}
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">Newsletter:</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Email"
                  className="bg-gray-800 border-gray-700 text-white text-sm"
                />
                <Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-4">
                  Join
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            © 2024 IDOL META Fan Made Edition. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-gray-500 hover:text-gray-400 text-sm transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-gray-500 hover:text-gray-400 text-sm transition-colors">
              Terms of Service
            </a>
            <a href="#" className="text-gray-500 hover:text-gray-400 text-sm transition-colors">
              Rules
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
