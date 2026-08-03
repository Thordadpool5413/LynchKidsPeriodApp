import React from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="en"><head><meta charSet="utf-8" /><meta httpEquiv="X-UA-Compatible" content="IE=edge" /><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" /><meta name="theme-color" content="#E7F3E1" /><meta name="description" content="AvaCado is a private, kid-friendly Glitter tracker, journal, learning garden, and grown-up support tool." /><meta property="og:title" content="AvaCado — grow through every Glitter" /><meta property="og:description" content="Private Glitter tracking, learning, and support for pre-teens and their grown-ups." /><meta property="og:image" content="/assets/brand/avacado-garden-hero.png" /><meta name="twitter:card" content="summary_large_image" /><ScrollViewStyleReset /></head><body>{children}</body></html>;
}
