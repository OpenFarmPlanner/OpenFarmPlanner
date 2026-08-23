import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box } from '@mui/material';
import { AppTooltip } from '../components/AppTooltip';

type Translator = (key: string, options?: Record<string, unknown>) => string;

/**
 * Label for the public-library publish checkbox, spelling out "CC BY-SA 4.0"
 * as a license (not a code) and explaining it via an inline info tooltip.
 * Shared between CulturesPublishConfirmDialog and CulturesPublishingWizardDialog.
 */
export function AcceptLicenseCheckboxLabel({ t }: { t: Translator }) {
  return (
    <>
      {t('library.publishConfirm.acceptLicensePrefix')}
      {t('library.publishConfirm.licenseName')}
      <AppTooltip title={t('library.publishConfirm.licenseTooltip')}>
        <Box
          component="span"
          tabIndex={0}
          sx={{ display: 'inline-flex', verticalAlign: 'middle', mx: 0.5, color: 'text.secondary', cursor: 'default' }}
        >
          <InfoOutlinedIcon fontSize="inherit" />
        </Box>
      </AppTooltip>
      {t('library.publishConfirm.acceptLicenseSuffix')}
    </>
  );
}
