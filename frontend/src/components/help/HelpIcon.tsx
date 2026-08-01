import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { IconButton } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useState, type ReactElement } from 'react';
import { useTranslation } from '../../i18n';
import { HelpDialog } from './HelpDialog';
import { AppTooltip } from '../AppTooltip';

interface HelpIconProps {
  buttonSx?: SxProps<Theme>;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Renders the global help icon and opens the shared help dialog.
 *
 * @remarks
 * Intended for the persistent application header so users always have access to the same help entry point.
 *
 * @param props - Component properties.
 * @param props.buttonSx - Optional styling for the icon button.
 * @param props.size - Optional button size.
 * @returns JSX element rendering the help icon and dialog.
 */
export function HelpIcon({ buttonSx, size = 'small' }: HelpIconProps): ReactElement {
  const { t } = useTranslation('help');
  const [open, setOpen] = useState(false);

  const handleOpen = (): void => {
    setOpen(true);
  };

  const handleClose = (): void => {
    setOpen(false);
  };

  return (
    <>
      <AppTooltip title={t('showTooltip')}>
        <IconButton aria-label={t('showTooltip')} onClick={handleOpen} size={size} sx={buttonSx}>
          <HelpOutlineIcon fontSize={size === 'small' ? 'small' : 'inherit'} />
        </IconButton>
      </AppTooltip>
      <HelpDialog open={open} onClose={handleClose} />
    </>
  );
}
