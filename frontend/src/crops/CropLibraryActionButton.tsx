import { Box, Button, Chip, CircularProgress } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
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
 * The permanent public-library control in the crop detail badge row. See
 * `resolveCropLibraryAction`: four states render a button (publish / pull /
 * push), and the "nothing to do" state renders a plain "Aktuell" status chip.
 * Every state carries a tooltip, shown on hover and on keyboard focus.
 */
export function CropLibraryActionButton({
  crop,
  controller,
  onPublish,
  isPublishing,
}: CropLibraryActionButtonProps) {
  const { t } = useTranslation('crops');
  const action = resolveCropLibraryAction(crop, controller);
  const label = t(`library.${action.labelKey}`);
  const tooltip = action.tooltipKey ? t(`library.${action.tooltipKey}`) : '';

  if (action.kind === 'upToDate') {
    return (
      <AppTooltip title={tooltip}>
        <Box component="span" tabIndex={0} aria-label={tooltip} sx={{ display: 'inline-flex' }}>
          <Chip
            size="small"
            variant="outlined"
            color="info"
            icon={<SyncOutlinedIcon fontSize="small" />}
            label={label}
            data-testid="crop-detail-library-status"
          />
        </Box>
      </AppTooltip>
    );
  }

  const loading = action.trigger === 'diff' ? controller.isLoading : isPublishing;
  // Direction of the sync: down = pull from the library, up = publish/push to it.
  const Icon = action.kind === 'pullUpdate' ? ArrowDownwardIcon : ArrowUpwardIcon;

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
      // Compact next to the header's "Bearbeiten" / "Anbauplan hinzufügen":
      // the theme's default 24px side padding is too wide here, so tighten the
      // sides to one 8px step and drop the label a touch. Height is unchanged.
      // 1 line at its natural width where there is room; wraps (never overflows)
      // when the badge row gets too narrow for the long German labels.
      sx={{
        px: 1,
        py: 0.25,
        fontSize: '0.75rem',
        flexShrink: 0,
        maxWidth: '100%',
        whiteSpace: 'normal',
        lineHeight: 1.25,
      }}
    >
      {label}
    </Button>
  );

  // A disabled <button> is not focusable, so its tooltip hangs off a focusable
  // wrapper that also carries it as an accessible name (hover + keyboard). An
  // enabled button is focusable itself and needs no extra wrapper.
  //
  // `describeChild` keeps the button's visible label as its accessible name;
  // without it MUI turns the tooltip text into an `aria-label` that shadows the
  // label. The tooltip stays available as an `aria-describedby` description.
  if (action.disabled) {
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

  return <AppTooltip title={tooltip} describeChild>{button}</AppTooltip>;
}
