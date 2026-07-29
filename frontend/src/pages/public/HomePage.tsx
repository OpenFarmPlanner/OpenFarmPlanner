import GitHubIcon from '@mui/icons-material/GitHub';
import {
  Alert,
  Box,
  Button,
  Container,
  CircularProgress,
  Link,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Link as RouterLink } from 'react-router';
import { useTranslation } from '../../i18n';
import LegalLinks from '../../components/legal/LegalLinks';
import HeroImage from '../../components/HeroImage';
import { publicAssetUrl } from '../../utils/publicAssetUrl';
import { PublicLanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { useGuestDemoStart } from './useGuestDemoStart';

const PRODUCT_TOUR_ITEMS = [
  {
    key: 'areas',
    images: {
      de: publicAssetUrl('/landing/screenshots/demo-areas.webp'),
      en: publicAssetUrl('/landing/screenshots/demo-areas-en.webp'),
    },
  },
  {
    key: 'cultures',
    images: {
      de: publicAssetUrl('/landing/screenshots/demo-cultures.webp'),
      en: publicAssetUrl('/landing/screenshots/demo-cultures-en.webp'),
    },
  },
  {
    key: 'plantingPlans',
    images: {
      de: publicAssetUrl('/landing/screenshots/demo-planting-plans.webp'),
      en: publicAssetUrl('/landing/screenshots/demo-planting-plans-en.webp'),
    },
  },
  {
    key: 'calendar',
    images: {
      de: publicAssetUrl('/landing/screenshots/demo-calendar.webp'),
      en: publicAssetUrl('/landing/screenshots/demo-calendar-en.webp'),
    },
  },
  {
    key: 'yieldOverview',
    images: {
      de: publicAssetUrl('/landing/screenshots/demo-yield-overview.webp'),
      en: publicAssetUrl('/landing/screenshots/demo-yield-overview-en.webp'),
    },
  },
  {
    key: 'seedDemand',
    images: {
      de: publicAssetUrl('/landing/screenshots/demo-seed-demand.webp'),
      en: publicAssetUrl('/landing/screenshots/demo-seed-demand-en.webp'),
    },
  },
] as const;

type ProductTourKey = (typeof PRODUCT_TOUR_ITEMS)[number]['key'];

const HERO_TEXT_SHADOW = '0 1px 3px rgba(0,0,0,0.7), 0 2px 12px rgba(0,0,0,0.5)';

// Single glassmorphism card behind all hero content (heading, description,
// buttons, beta note, GitHub link) - one clearly-bounded, semi-transparent
// panel instead of separate backgrounds per line/element, so there's no risk
// of overlapping panels double-darkening the gaps between them.
const HERO_CARD_SX = {
  position: 'relative' as const,
  zIndex: 1,
  width: '100%',
  maxWidth: 640,
  mx: 'auto',
  px: { xs: 3, sm: 4, md: 4.5 },
  py: { xs: 3, sm: 3.5, md: 4 },
  borderRadius: { xs: 4, md: 6 },
  border: '1px solid rgba(255,255,255,0.28)',
  backgroundColor: 'rgba(8,24,14,0.5)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
};

/**
 * Public landing page with refined spacing and modern visual hierarchy.
 *
 * @returns Landing page UI.
 */
export default function HomePage() {
  const { t, i18n } = useTranslation('home');
  const {
    isStartingDemo,
    demoStartError,
    isDemoRetryBlocked,
    isDemoButtonDisabled,
    compactRetryTime,
    startDemo,
  } = useGuestDemoStart();
  const [activeTourKey, setActiveTourKey] = useState<ProductTourKey>('areas');
  const activeTourItem = PRODUCT_TOUR_ITEMS.find((item) => item.key === activeTourKey) ?? PRODUCT_TOUR_ITEMS[0];
  const screenshotLanguage = (i18n.resolvedLanguage ?? i18n.language ?? 'de').split('-')[0] === 'en' ? 'en' : 'de';
  const activeTourImage = activeTourItem.images[screenshotLanguage];

  const handleTourChange = (_event: SyntheticEvent, value: ProductTourKey): void => {
    setActiveTourKey(value);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box component="main" sx={{ flex: 1 }}>
        <Container maxWidth="lg" sx={{ width: '100%', pt: { xs: 1.5, md: 2 }, pb: { xs: 2.5, md: 3 } }}>
          <Stack
            component="header"
            direction="row"
            spacing={{ xs: 0.75, sm: 2 }}
            alignItems="center"
            justifyContent="space-between"
            sx={{ minHeight: 48 }}
          >
            <Stack
              direction="row"
              spacing={{ xs: 0.75, sm: 1.4 }}
              alignItems="center"
              sx={{ minWidth: 0, flex: '1 1 auto' }}
            >
              <Box
                component="img"
                src={publicAssetUrl('/favicon.png')}
                alt=""
                aria-hidden
                sx={{
                  width: { xs: 32, sm: 40, md: 48 },
                  height: 'auto',
                  flexShrink: 0,
                  opacity: 0.95,
                }}
              />
              <Typography
                variant="h2"
                component="h1"
                sx={{
                  minWidth: 0,
                  fontSize: { xs: '1.1rem', sm: '1.9rem', md: '2.5rem' },
                  fontWeight: 600,
                  lineHeight: 1.1,
                  overflowWrap: 'normal',
                }}
              >
                {t('landing.title')}
              </Typography>
            </Stack>
            <Box sx={{ flex: '0 0 auto' }}>
              <PublicLanguageSwitcher dense />
            </Box>
          </Stack>
        </Container>

        <Box
          component="section"
          sx={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            px: 2,
            py: { xs: 4, md: 5 },
            overflow: 'hidden',
            bgcolor: '#0d1f12',
          }}
        >
          <HeroImage alt={t('landing.heroImageAlt')} />
          <Box sx={HERO_CARD_SX}>
            <Stack spacing={{ xs: 2, md: 2.2 }} alignItems="center">
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 500,
                  lineHeight: 1.35,
                  color: '#fff',
                  textShadow: HERO_TEXT_SHADOW,
                }}
              >
                {t('landing.subtitle')}
              </Typography>
              <Typography
                sx={{
                  maxWidth: 560,
                  fontSize: { xs: '0.98rem', md: '1rem' },
                  lineHeight: 1.65,
                  color: 'rgba(255,255,255,0.94)',
                  textShadow: HERO_TEXT_SHADOW,
                }}
              >
                {t('landing.description')}
              </Typography>

              <Stack spacing={1.15} alignItems="center" sx={{ width: '100%', pt: 0.3 }}>
                <Stack
                  direction="row"
                  spacing={{ xs: 1, sm: 1.2 }}
                  alignItems="center"
                  justifyContent="center"
                  sx={{ width: '100%', flexWrap: 'nowrap' }}
                >
                  <Button
                    component={RouterLink}
                    to="/register"
                    variant="contained"
                    size="large"
                    sx={{
                      minHeight: 46,
                      borderRadius: 2,
                      px: { xs: 2, sm: 3.2 },
                      whiteSpace: 'nowrap',
                      boxShadow: (theme) => theme.shadows[3],
                      transition: 'transform 160ms ease, box-shadow 160ms ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: (theme) => theme.shadows[5],
                      },
                    }}
                  >
                    {t('landing.actions.register')}
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/login"
                    variant="outlined"
                    size="large"
                    sx={{
                      minHeight: 46,
                      borderRadius: 2,
                      px: { xs: 2, sm: 3.2 },
                      color: 'primary.main',
                      borderColor: '#fff',
                      bgcolor: '#fff',
                      whiteSpace: 'nowrap',
                      boxShadow: (theme) => theme.shadows[2],
                      transition: 'transform 160ms ease, color 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        color: 'primary.dark',
                        borderColor: '#fff',
                        bgcolor: 'rgba(255,255,255,0.92)',
                        boxShadow: (theme) => theme.shadows[4],
                      },
                    }}
                  >
                    {t('landing.actions.openApp')}
                  </Button>
                </Stack>
                <Button
                  variant="text"
                  disabled={isDemoButtonDisabled}
                  onClick={() => {
                    void startDemo();
                  }}
                  sx={{
                    minHeight: 34,
                    px: 1.2,
                    py: 0.4,
                    borderRadius: 1,
                    color: 'rgba(255,255,255,0.94)',
                    fontSize: { xs: '0.9rem', sm: '0.94rem' },
                    fontWeight: 600,
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                    textShadow: HERO_TEXT_SHADOW,
                    whiteSpace: 'nowrap',
                    '&:hover, &:focus-visible': {
                      color: '#fff',
                      bgcolor: 'rgba(255,255,255,0.1)',
                      textDecoration: 'underline',
                    },
                    '&.Mui-disabled': {
                      color: 'rgba(255,255,255,0.58)',
                    },
                  }}
                >
                  {isStartingDemo ? (
                    <Stack component="span" direction="row" spacing={0.8} alignItems="center">
                      <CircularProgress color="inherit" size={14} />
                      <span>{t('landing.actions.startingDemo')}</span>
                    </Stack>
                  ) : isDemoRetryBlocked ? (
                    t('landing.actions.demoAvailableIn', {
                      time: compactRetryTime,
                    })
                  ) : (
                    t('landing.actions.demoWithoutRegistration')
                  )}
                </Button>
              </Stack>
              {demoStartError ? (
                <Alert
                  severity="error"
                  sx={{
                    width: '100%',
                    maxWidth: 520,
                    minHeight: 48,
                    textAlign: 'left',
                    color: 'error.dark',
                    bgcolor: 'rgba(255,255,255,0.96)',
                    border: '1px solid',
                    borderColor: 'error.light',
                    '& .MuiAlert-icon': {
                      color: 'error.main',
                    },
                  }}
                >
                  {demoStartError}
                </Alert>
              ) : null}

              <Stack spacing={0.7} alignItems="center" textAlign="center" sx={{ pt: { xs: 0.3, md: 0.5 } }}>
                <Typography sx={{ lineHeight: 1.45, color: '#fff', textShadow: HERO_TEXT_SHADOW }}>
                  {t('statusNote')}
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: '0.84rem', md: '0.9rem' },
                    lineHeight: 1.4,
                    color: 'rgba(255,255,255,0.92)',
                    textShadow: HERO_TEXT_SHADOW,
                  }}
                >
                  {t('statusOpenSource.text')}
                </Typography>
                <Link
                  href={t('statusOpenSource.githubUrl')}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="none"
                  color="primary"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.55,
                    px: 1.1,
                    py: 0.5,
                    mt: 0.3,
                    borderRadius: 1,
                    border: 2,
                    borderColor: 'primary.main',
                    bgcolor: '#fff',
                    cursor: 'pointer',
                    fontSize: { xs: '0.86rem', md: '0.92rem' },
                    fontWeight: 600,
                    lineHeight: 1.4,
                    boxShadow: (theme) => theme.shadows[1],
                    transition: 'color 180ms ease, border-color 180ms ease, background-color 180ms ease',
                    '&:hover': {
                      color: 'primary.dark',
                      borderColor: 'primary.dark',
                      bgcolor: '#fff',
                    },
                  }}
                >
                  <GitHubIcon sx={{ fontSize: { xs: '0.95rem', md: '1rem' }, flexShrink: 0 }} />
                  {t('statusOpenSource.linkLabel')}
                </Link>
              </Stack>
            </Stack>
          </Box>
        </Box>

        <Container maxWidth="xl" sx={{ width: '100%', py: { xs: 5, md: 7 } }}>
          <Stack spacing={{ xs: 5.5, md: 7 }} alignItems="center">
            <Box
              component="section"
              aria-labelledby="product-tour-title"
              sx={{ width: '100%' }}
            >
              <Stack spacing={{ xs: 2.5, md: 3.5 }}>
                <Stack spacing={1.25} alignItems="center" textAlign="center">
                  <Typography
                    id="product-tour-title"
                    variant="h4"
                    component="h2"
                    sx={{
                      fontSize: { xs: '1.8rem', md: '2.125rem' },
                      fontWeight: 600,
                      lineHeight: 1.18,
                    }}
                  >
                    {t('productTour.title')}
                  </Typography>
                  <Typography color="text.secondary" sx={{ maxWidth: 720, lineHeight: 1.6 }}>
                    {t('productTour.description')}
                  </Typography>
                </Stack>

                <Box>
                  <Tabs
                    value={activeTourKey}
                    onChange={handleTourChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    aria-label={t('productTour.tabsLabel')}
                    sx={{
                      minHeight: 44,
                      borderBottom: 1,
                      borderColor: 'divider',
                      '& .MuiTab-root': {
                        minHeight: 44,
                        px: { xs: 1.25, sm: 2 },
                        textTransform: 'none',
                        fontWeight: 600,
                      },
                      '& .MuiTabs-indicator': {
                        transition: 'none',
                      },
                    }}
                  >
                    {PRODUCT_TOUR_ITEMS.map((item) => (
                      <Tab
                        key={item.key}
                        label={t(`productTour.items.${item.key}.tab`)}
                        value={item.key}
                      />
                    ))}
                  </Tabs>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' },
                      gap: { xs: 2, md: 4 },
                      alignItems: 'center',
                      pt: { xs: 2, md: 3 },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          minWidth: 0,
                          width: '100%',
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 2,
                          overflow: 'hidden',
                          bgcolor: 'background.paper',
                          boxShadow: (theme) => theme.shadows[2],
                        }}
                      >
                        <Box
                          component="img"
                          src={activeTourImage}
                          alt={t(`productTour.items.${activeTourItem.key}.alt`)}
                          loading="eager"
                          decoding="async"
                          width={1280}
                          height={800}
                          sx={{
                            display: 'block',
                            width: '100%',
                            height: 'auto',
                          }}
                        />
                      </Box>
                    </Box>

                    <Stack
                      spacing={1}
                      sx={{
                        minWidth: 0,
                        width: '100%',
                        alignSelf: { xs: 'start', md: 'center' },
                      }}
                    >
                      <Typography variant="h5" component="h3" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                        {t(`productTour.items.${activeTourItem.key}.title`)}
                      </Typography>
                      <Typography color="text.secondary" sx={{ lineHeight: 1.65 }}>
                        {t(`productTour.items.${activeTourItem.key}.description`)}
                      </Typography>
                    </Stack>
                  </Box>
                </Box>
              </Stack>
            </Box>
          </Stack>
        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: { xs: 2.5, md: 2.75 }, bgcolor: 'background.paper' }}>
        <Container maxWidth="md">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1.25, sm: 3 }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <LegalLinks />
            <Link href={`mailto:${t('footer.contactEmail')}`} underline="hover" color="text.secondary" sx={{ fontSize: '0.92rem' }}>
              {t('footer.contactLabel', { email: t('footer.contactEmail') })}
            </Link>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
