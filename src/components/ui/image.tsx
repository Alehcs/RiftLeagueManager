'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { fallbackAvatarDataUri, fallbackLogoDataUri } from '@/services/assets';

// <img> that swaps to a generated fallback tile if the real URL fails/missing.
function SmartImg({
  src,
  fallback,
  alt,
  className,
}: {
  src: string | null | undefined;
  fallback: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const url = !src || failed ? fallback : src;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
      loading="lazy"
    />
  );
}

const SIZES = { xs: 'h-6 w-6', sm: 'h-8 w-8', md: 'h-11 w-11', lg: 'h-16 w-16', xl: 'h-24 w-24' };

export function TeamLogo({
  name,
  shortName,
  src,
  color,
  size = 'md',
  shape = 'square',
  className,
}: {
  name: string;
  shortName?: string;
  src?: string | null;
  color?: string | null; // brand color used by the generated fallback tile
  size?: keyof typeof SIZES;
  shape?: 'square' | 'circle';
  className?: string;
}) {
  return (
    <SmartImg
      src={src}
      fallback={fallbackLogoDataUri(name, shortName, color)}
      alt={`${name} logo`}
      className={cn('shrink-0 bg-bg-soft', shape === 'circle' ? 'rounded-full' : 'rounded-lg', SIZES[size], className)}
    />
  );
}

export function PlayerAvatar({
  name,
  src,
  seed,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  seed?: string | null; // stable seed for the generated avatar's color variety
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <SmartImg
      src={src}
      fallback={fallbackAvatarDataUri(name, seed)}
      alt={`${name} avatar`}
      className={cn('shrink-0 rounded-full bg-bg-soft', SIZES[size], className)}
    />
  );
}
