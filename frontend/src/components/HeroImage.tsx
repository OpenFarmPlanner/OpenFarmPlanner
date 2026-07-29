import { Box, styled } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useState } from 'react';
import { publicAssetUrl } from '../utils/publicAssetUrl';

// A plain styled <img>, not MUI's Box, because Box intercepts `width`/
// `height` props as CSS style shorthand rather than forwarding them as HTML
// attributes — which would silently drop the intrinsic-size hints this
// component relies on to reserve layout space.
const StyledImg = styled('img')({});

// Intrinsic size of the checked-in hero-field.webp/-960.webp pair — kept in
// sync manually since the files aren't processed by Vite's image pipeline.
// Reserving these via width/height attributes prevents layout shift while
// the image loads.
const HERO_IMAGE_WIDTH = 1920;
const HERO_IMAGE_HEIGHT = 616;

const HERO_IMAGE_SRC = publicAssetUrl('/landing/hero-field.webp');
const HERO_IMAGE_SRC_SET = [
  `${publicAssetUrl('/landing/hero-field-960.webp')} 960w`,
  `${HERO_IMAGE_SRC} 1920w`,
].join(', ');

interface HeroImageProps {
  /** Accessible description of the image. Pass "" for purely decorative use. */
  alt: string;
  /** Additional/overriding sx merged onto the absolutely-positioned <img>. */
  sx?: SxProps<Theme>;
  /** Optional overlay (e.g. a readability gradient) rendered above the image. */
  overlaySx?: SxProps<Theme>;
}

/**
 * Full-bleed hero background image used on the landing page and auth pages.
 * Renders a real <img> (not a CSS background-image) so the browser can
 * discover and prioritize it as early as possible, and fades it in once
 * loaded to avoid a jarring pop-in on slower connections.
 */
export default function HeroImage({ alt, sx, overlaySx }: HeroImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <StyledImg
        src={HERO_IMAGE_SRC}
        srcSet={HERO_IMAGE_SRC_SET}
        sizes="100vw"
        alt={alt}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        width={HERO_IMAGE_WIDTH}
        height={HERO_IMAGE_HEIGHT}
        onLoad={() => setLoaded(true)}
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.4s ease-out',
          ...sx,
        }}
      />
      {overlaySx ? <Box aria-hidden sx={{ position: 'absolute', inset: 0, ...overlaySx }} /> : null}
    </>
  );
}
