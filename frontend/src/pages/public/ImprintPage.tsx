import { Container, Stack, Typography } from '@mui/material';
import { useTranslation } from '../../i18n';
import PublicPageLanguageBar from '../../i18n/PublicPageLanguageBar';

const imprintSections = [
  'provider',
  'contact',
  'responsiblePerson',
] as const;

export default function ImprintPage() {
  const { t } = useTranslation('home');

  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
      <Stack spacing={3}>
        <PublicPageLanguageBar />
        <Typography variant="h3" component="h1">
          {t('legal.imprint.title')}
        </Typography>

        {imprintSections.map((sectionKey) => (
          <Stack key={sectionKey} spacing={0.5}>
            <Typography variant="h6">{t(`legal.imprint.sections.${sectionKey}.title`)}</Typography>
            <Typography color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
              {t(`legal.imprint.sections.${sectionKey}.content`)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Container>
  );
}
