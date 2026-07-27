import { Box, Container, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import LegalLinks from '../../components/legal/LegalLinks';
import { publicAssetUrl } from '../../utils/publicAssetUrl';
import { authLegalLinkSx } from './authPageStyles';

type AuthPageShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  legalLinksDense?: boolean;
};

export default function AuthPageShell({ title, subtitle, children, legalLinksDense = false }: AuthPageShellProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#f5f7f1',
        backgroundImage: `linear-gradient(rgba(245, 247, 241, 0.88), rgba(245, 247, 241, 0.9)), url(${publicAssetUrl('/landing/hero-field.webp')})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: { xs: 'scroll', md: 'fixed' },
      }}
    >
      <Container
        maxWidth="lg"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { xs: 'flex-start', md: 'center' },
          px: { xs: 2, sm: 3 },
          py: { xs: 3, sm: 5, md: 7 },
        }}
      >
        <Stack spacing={{ xs: 2.5, md: 3.5 }} alignItems="center">
          <Stack direction="row" spacing={1.4} alignItems="center" justifyContent="center">
            <Box
              component="img"
              src={publicAssetUrl('/favicon.png')}
              alt=""
              aria-hidden
              sx={{ width: { xs: 40, md: 48 }, height: 'auto', opacity: 0.95 }}
            />
            <Typography
              variant="h2"
              component="div"
              sx={{
                fontSize: { xs: '1.9rem', md: '2.5rem' },
                fontWeight: 600,
                lineHeight: 1.1,
              }}
            >
              OpenFarmPlanner
            </Typography>
          </Stack>

          <Paper
            elevation={0}
            sx={{
              width: '100%',
              maxWidth: 560,
              borderRadius: { xs: 3, md: 4 },
              border: '1px solid rgba(46, 125, 50, 0.12)',
              boxShadow: '0 16px 44px rgba(28, 42, 30, 0.11)',
              bgcolor: '#fff',
              p: { xs: 2.5, sm: 4, md: 4.5 },
            }}
          >
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '1.85rem', md: '2.15rem' },
                lineHeight: 1.18,
                mb: 1,
              }}
            >
              {title}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: '1rem', lineHeight: 1.55 }}>
              {subtitle}
            </Typography>
            <Box sx={{ mt: { xs: 2.75, sm: 3.25 } }}>{children}</Box>
          </Paper>

          <LegalLinks
            dense={legalLinksDense}
            sx={{
              justifyContent: 'center',
              textShadow: '0 1px 2px rgba(255, 255, 255, 0.9)',
            }}
            linkSx={{
              ...authLegalLinkSx,
              fontWeight: 500,
            }}
          />
        </Stack>
      </Container>
    </Box>
  );
}
