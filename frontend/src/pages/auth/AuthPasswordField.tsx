import { InputAdornment, TextField } from '@mui/material';
import PasswordVisibilityToggle from '../../components/inputs/PasswordVisibilityToggle';
import { authTextFieldSx } from './authPageStyles';

interface AuthPasswordFieldProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  isVisible: boolean;
  onToggleVisibility: () => void;
  showLabel: string;
  hideLabel: string;
  disabled?: boolean;
  /** Set for the new-password fields; the login field deliberately has none. */
  autoComplete?: string;
}

/**
 * Password input used across the auth pages: the shared field styling plus the
 * show/hide toggle in the end adornment.
 */
export function AuthPasswordField({
  label,
  value,
  onValueChange,
  isVisible,
  onToggleVisibility,
  showLabel,
  hideLabel,
  disabled = false,
  autoComplete,
}: AuthPasswordFieldProps) {
  return (
    <TextField
      label={label}
      type={isVisible ? 'text' : 'password'}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      required
      disabled={disabled}
      fullWidth
      sx={authTextFieldSx}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <PasswordVisibilityToggle
                isVisible={isVisible}
                showLabel={showLabel}
                hideLabel={hideLabel}
                onToggle={onToggleVisibility}
                disabled={disabled}
              />
            </InputAdornment>
          ),
        },
        ...(autoComplete ? { htmlInput: { autoComplete } } : {}),
      }}
    />
  );
}
