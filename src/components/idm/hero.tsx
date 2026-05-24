'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Trophy, Users, Zap, ChevronDown } from 'lucide-react';

export function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: 'IDOL META',
      subtitle: 'FAN MADE EDITION',
      description: 'Platform Turnamen Esports Profesional untuk Komunitas Gaming Indonesia',
      image: ''
    },
    {
      title: 'WEEKLY TOURNAMENT',
      subtitle: 'SEASON 2024',
      description: 'Bergabung dan tunjukkan skill gaming terbaikmu!',
      image: ''
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        {slides[currentSlide].image ? (
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
            style={{
              backgroundImage: `url(${slides[currentSlide].image})`,
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900" />
        )}
        {/* Dark overlay for both themes - ensures text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-900/70 via-stone-900/60 to-stone-900/80 dark:from-background dark:via-background/90 dark:to-background" />
        {/* Gold haze effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Division Badges */}
        <div className="flex justify-center gap-3 mb-6">
          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 px-4 py-1">
            MALE DIVISION
          </Badge>
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 px-4 py-1">
            FEMALE DIVISION
          </Badge>
        </div>

        {/* Main Title */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black mb-4">
          <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-lg">
            {slides[currentSlide].title}
          </span>
        </h1>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-amber-400 mb-6">
          {slides[currentSlide].subtitle}
        </h2>
        <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-8">
          {slides[currentSlide].description}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <Button
            size="lg"
            className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold px-8 py-6 rounded-2xl shadow-lg shadow-cyan-500/25"
          >
            <Play className="w-5 h-5 mr-2" />
            Join Tournament
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 px-8 py-6 rounded-2xl"
          >
            <Trophy className="w-5 h-5 mr-2" />
            View Schedule
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {[
            { icon: Trophy, value: '50+', label: 'Tournaments', color: 'text-amber-400' },
            { icon: Users, value: '1.2K+', label: 'Players', color: 'text-cyan-400' },
            { icon: Zap, value: 'Rp 100M+', label: 'Prize Pool', color: 'text-green-400' },
            { icon: Trophy, value: '24/7', label: 'Support', color: 'text-purple-400' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <stat.icon className={`w-8 h-8 mx-auto mb-2 ${stat.color}`} />
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Slide Indicators */}
        <div className="flex justify-center gap-2 mt-12">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentSlide
                  ? 'bg-amber-400 w-8'
                  : 'bg-gray-500 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown className="w-8 h-8 text-amber-400" />
      </div>
    </section>
  );
}
