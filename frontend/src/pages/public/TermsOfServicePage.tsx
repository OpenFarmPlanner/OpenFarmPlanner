import PrintIcon from '@mui/icons-material/Print';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { useTranslation } from '../../i18n';
import PublicPageLanguageBar from '../../i18n/PublicPageLanguageBar';

const termsSections = [
  'provider',
  'scope',
  'serviceAndCosts',
  'contractLanguage',
  'accounts',
  'userContent',
  'publicLibrary',
  'contributionLicense',
  'prohibitedContent',
  'copyright',
  'contentRemoval',
  'accountSuspension',
  'liability',
  'openSource',
  'futureFeatures',
  'changes',
] as const;

const termsSectionBulletKeys: Partial<Record<(typeof termsSections)[number], readonly string[]>> = {
  prohibitedContent: ['illegalContent', 'malware', 'abuse', 'misrepresentation'],
} as const;

export default function TermsOfServicePage() {
  const { t } = useTranslation('home');

  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
      <Stack spacing={3}>
        <PublicPageLanguageBar />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
          <Typography variant="h3" component="h1">
            {t('legal.terms.title')}
          </Typography>
          <Button
            type="button"
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
            sx={{ '@media print': { display: 'none' } }}
          >
            {t('legal.terms.print')}
          </Button>
        </Stack>

        {termsSections.map((sectionKey, index) => {
          const bulletKeys = termsSectionBulletKeys[sectionKey];
          return (
            <Stack key={sectionKey} spacing={1}>
              <Typography variant="h6">{`${index + 1}. ${t(`legal.terms.sections.${sectionKey}.title`)}`}</Typography>
              <Typography color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                {t(`legal.terms.sections.${sectionKey}.content`)}
              </Typography>
              {bulletKeys ? (
                <Box component="ul" sx={{ mt: 0, mb: 0, pl: 3, color: 'text.secondary' }}>
                  {bulletKeys.map((bulletKey) => (
                    <li key={bulletKey}>{t(`legal.terms.sections.${sectionKey}.bullets.${bulletKey}`)}</li>
                  ))}
                </Box>
              ) : null}
            </Stack>
          );
        })}

        <Typography color="text.secondary">{t('legal.terms.version')}</Typography>
      </Stack>
    </Container>
  );
}
