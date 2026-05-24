'use client';

import { useState } from 'react';
import { Camera, Play, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const galleryItems = [
  {
    type: 'image',
    src: '/gallery-1.jpg',
    title: 'Season 3 Finals',
    category: 'Tournament'
  },
  {
    type: 'video',
    src: '/gallery-2.jpg',
    title: 'MVP Interview',
    category: 'Interview'
  },
  {
    type: 'image',
    src: '/gallery-3.jpg',
    title: 'Team RRQ Victory',
    category: 'Moment'
  },
  {
    type: 'image',
    src: '/gallery-4.jpg',
    title: 'Award Ceremony',
    category: 'Tournament'
  },
  {
    type: 'video',
    src: '/gallery-5.jpg',
    title: 'Best Plays Compilation',
    category: 'Highlight'
  },
  {
    type: 'image',
    src: '/gallery-6.jpg',
    title: 'Community Meetup',
    category: 'Event'
  }
];

export function Gallery() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
  };

  const closeLightbox = () => {
    setSelectedIndex(null);
  };

  const goToPrevious = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + galleryItems.length) % galleryItems.length);
    }
  };

  const goToNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % galleryItems.length);
    }
  };

  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="bg-gradient-to-b from-stone-50 via-white to-stone-50 dark:from-background dark:via-background dark:to-background" />

      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <Camera className="w-12 h-12 mx-auto mb-4 text-purple-500" />
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-2">
            GALLERY <span className="text-purple-500">MOMENTS</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Momen-momen terbaik dari turnamen dan event kami
          </p>
        </div>

        {/* Gallery Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {galleryItems.map((item, index) => (
            <Card
              key={index}
              className="group relative overflow-hidden bg-card border-border hover:border-purple-500/50 cursor-pointer transition-all"
              onClick={() => openLightbox(index)}
            >
              {/* Placeholder Image */}
              <div className="aspect-video bg-gradient-to-br from-muted to-card flex items-center justify-center">
                <Camera className="w-12 h-12 text-muted-foreground" />
              </div>

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <Badge className="mb-2 bg-purple-500/20 text-purple-400 border-purple-500/30">
                    {item.category}
                  </Badge>
                  <h3 className="text-white font-bold">{item.title}</h3>
                </div>
              </div>

              {/* Video Indicator */}
              {item.type === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-6 h-6 text-white fill-white" />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={closeLightbox}
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <button
            className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <div
            className="max-w-4xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-video bg-card rounded-lg flex items-center justify-center">
              <Camera className="w-20 h-20 text-muted-foreground" />
            </div>
            <div className="mt-4 text-center">
              <Badge className="mb-2 bg-purple-500/20 text-purple-400 border-purple-500/30">
                {galleryItems[selectedIndex].category}
              </Badge>
              <h3 className="text-xl font-bold text-white">
                {galleryItems[selectedIndex].title}
              </h3>
            </div>
          </div>

          <button
            className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>
      )}
    </section>
  );
}
