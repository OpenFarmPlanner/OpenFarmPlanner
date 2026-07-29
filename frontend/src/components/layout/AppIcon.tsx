import { Box, type SxProps, type Theme } from '@mui/material';

import { publicAssetUrl } from '../../utils/publicAssetUrl';

type ResponsiveSize = number | string | Record<string, number | string>;

interface AppIconProps {
  alt?: string;
  decorative?: boolean;
  size?: ResponsiveSize;
  sx?: SxProps<Theme>;
}

export default function AppIcon({
  alt = 'OpenFarmPlanner',
  decorative = false,
  size = 32,
  sx,
}: AppIconProps) {
  const sxOverrides = Array.isArray(sx) ? sx : sx ? [sx] : [];

  return (
    <Box
      component="img"
      src={publicAssetUrl('/favicon.png')}
      alt={decorative ? '' : alt}
      aria-hidden={decorative || undefined}
      sx={[
        {
          display: 'block',
          width: size,
          height: 'auto',
          flexShrink: 0,
          objectFit: 'contain',
        },
        ...sxOverrides,
      ]}
    />
  );
}
