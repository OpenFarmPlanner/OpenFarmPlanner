import { Box, Button, CircularProgress } from '@mui/material';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import { useTranslation } from '../i18n';
import { AppTooltip } from '../components/AppTooltip';
import type { Crop } from '../api/types';
import type { PublicCropUpdateController } from './usePublicCropUpdate';
import { resolveCropLibraryAction } from './cropLibraryAction';

interface CropLibraryActionButtonProps {
  crop: Crop;
  controller: PublicCropUpdateController;
  /** Opens the publishing wizard (also the entry point for updating an owned entry). */
  onPublish: () => void;
  /** True while a publish/push request the wizard started is in flight. */
  isPublishing: boolean;
}

/**
 * The permanent public-library action in the crop detail badge row. See
 * `resolveCropLibraryAction` for the five states and their priority.
 */
export function CropLibraryActionButton({
  crop,
  controller,
  onPublish,
  isPublishing,
}: CropLibraryActionButtonProps) {
  const { t } = useTranslation('crops');
  const action = resolveCropLibraryAction(crop, controller);
  const loading = action.trigger === 'diff' ? controller.isLoading : isPublishing;
  const tooltip = action.tooltipKey ? t(`library.${action.tooltipKey}`) : '';
  const Icon = action.kind === 'pullUpdate' ? SyncOutlinedIcon : PublicOutlinedIcon;

  const handleClick = () => {
    if (action.trigger === 'publish') {
      onPublish();
    } else if (action.trigger === 'diff') {
      controller.openDiff();
    }
  };

  const button = (
    <Button
      size="small"
      variant="outlined"
      color={action.color}
      data-testid="crop-detail-publish-action"
      data-action-kind={action.kind}
      startIcon={loading
        ? <CircularProgress size={14} color="inherit" />
        : <Icon fontSize="small" />}
      disabled={action.disabled || loading}
      onClick={handleClick}
      // 1 line at its natural width where there is room; wraps (never overflows)
      // when the badge row gets too narrow for the long German labels.
      sx={{ py: 0.25, flexShrink: 0, maxWidth: '100%', whiteSpace: 'normal', lineHeight: 1.25 }}
    >
      {t(`library.${action.labelKey}`)}
    </Button>
  );

  if (!tooltip) {
    return button;
  }

  // A disabled <button> is not focusable, so the reason hangs off a focusable
  // wrapper that also carries it as an accessible name (hover + keyboard).
  return (
    <AppTooltip title={tooltip}>
      <Box
        component="span"
        tabIndex={0}
        aria-label={tooltip}
        sx={{
          display: 'inline-flex',
          flexShrink: 0,
          maxWidth: '100%',
          borderRadius: 1,
          '&:focus-visible': { outline: (theme) => `2px solid ${theme.palette.primary.main}` },
        }}
      >
        {button}
      </Box>
    </AppTooltip>
  );
}
