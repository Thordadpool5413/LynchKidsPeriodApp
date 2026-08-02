import React from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="en"><head><meta charSet="utf-8" /><meta httpEquiv="X-UA-Compatible" content="IE=edge" /><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" /><meta name="theme-color" content="#D9F5EE" /><meta name="description" content="Glitter is a private, kid-friendly period tracker, journal, learning garden, and grown-up support tool." /><meta property="og:title" content="Glitter — grow with confidence" /><meta property="og:description" content="Private period tracking, learning, and support for pre-teens and their grown-ups." /><meta property="og:image" content="/assets/illustrations/glitter-garden-hero.png" /><meta name="twitter:card" content="summary_large_image" /><ScrollViewStyleReset /></head><body>{children}</body></html>;
}
