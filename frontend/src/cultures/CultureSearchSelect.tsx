import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import LocalFloristOutlinedIcon from '@mui/icons-material/LocalFloristOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import { useTranslation } from 'react-i18next';
import type { SxProps, Theme } from '@mui/material/styles';
import type { Key, ReactNode, Ref } from 'react';
import { SearchableSelect } from '../components/inputs/SearchableSelect';
import type { SearchableSelectOption } from '../components/inputs/SearchableSelect';
import { buildCultureSearchGrouping, getCultureSearchVarietyLabel } from './cultureSearchOptions';
import {
  cultureSearchGroupSx,
  cultureSearchHeaderHintSx,
  cultureSearchHeaderIconSx,
  cultureSearchHeaderNameSx,
  cultureSearchHeaderOptionSx,
  cultureSearchVarietyIconSx,
  cultureSearchVarietyNameSx,
  cultureSearchVarietyOptionSx,
} from './cultureSearchSelectStyles';
import type { Culture } from '../api/types';

interface CultureSearchSelectProps {
  options: SearchableSelectOption<Culture>[];
  value: SearchableSelectOption<Culture> | null;
  onChange: (value: SearchableSelectOption<Culture> | null) => void;
  label?: string;
  placeholder?: string;
  noOptionsText?: string;
  textFieldSx?: SxProps<Theme>;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  endAdornment?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * The "Kultur suchen" dropdown: one group per Kultur, its general entry as the
 * group header and its matching Sorten indented below it.
 *
 * The header is an option like any other rather than a plain group label, so
 * arrow-key navigation walks headers and Sorten in one sequence and Enter on a
 * header selects the general Kultur — the same thing clicking it does. The
 * group is always rendered, even for a Kultur with a single Sorte or with none,
 * so a hit on a variety name never shows up as a row detached from its Kultur.
 */
export function CultureSearchSelect({
  options,
  value,
  onChange,
  label,
  placeholder,
  noOptionsText,
  textFieldSx,
  inputValue,
  onInputChange,
  endAdornment,
  inputRef,
}: CultureSearchSelectProps) {
  const { t } = useTranslation('cultures');
  const grouping = useMemo(() => buildCultureSearchGrouping(options), [options]);
  const generalCropLabel = t('hierarchy.generalCrop');

  return (
    <SearchableSelect<Culture>
      options={grouping.options}
      value={value}
      onChange={onChange}
      label={label}
      placeholder={placeholder}
      noOptionsText={noOptionsText}
      textFieldSx={textFieldSx}
      inputValue={inputValue}
      onInputChange={onInputChange}
      endAdornment={endAdornment}
      inputRef={inputRef}
      // The page's own filters already produced this list; filtering it again
      // by the typed text here would drop the group headers a variety hit
      // needs for context.
      filterOptions={(currentOptions) => currentOptions}
      groupBy={(option) => grouping.groupKeyByOptionValue.get(option.value) ?? ''}
      renderGroup={(params) => {
        const group = grouping.groups.get(params.group);
        return (
          <li key={params.key} role="presentation">
            <Box
              component="ul"
              role="group"
              aria-label={group?.label}
              sx={cultureSearchGroupSx}
            >
              {group && group.headerOptionValue === null ? (
                <Box component="li" role="presentation" sx={cultureSearchHeaderOptionSx}>
                  <LocalFloristOutlinedIcon fontSize="small" sx={cultureSearchHeaderIconSx} />
                  <Typography component="span" sx={cultureSearchHeaderNameSx}>
                    {group.label}
                  </Typography>
                </Box>
              ) : null}
              {params.children}
            </Box>
          </li>
        );
      }}
      renderOption={(props, option) => {
        const groupKey = grouping.groupKeyByOptionValue.get(option.value);
        const group = groupKey === undefined ? undefined : grouping.groups.get(groupKey);
        const isGroupHeader = group?.headerOptionValue === option.value;
        // MUI puts the list key in the render props; spreading it into JSX
        // would warn, so it is applied as the element key instead.
        const { key: optionKey, ...liProps } = props;
        const rowKey = (optionKey as Key | undefined) ?? option.value;

        if (isGroupHeader) {
          return (
            <Box
              component="li"
              {...liProps}
              key={rowKey}
              aria-label={`${group.label} – ${generalCropLabel}`}
              sx={cultureSearchHeaderOptionSx}
            >
              <LocalFloristOutlinedIcon fontSize="small" sx={cultureSearchHeaderIconSx} />
              <Typography component="span" sx={cultureSearchHeaderNameSx}>
                {group.label}
              </Typography>
              <Typography component="span" variant="caption" sx={cultureSearchHeaderHintSx}>
                {generalCropLabel}
              </Typography>
            </Box>
          );
        }

        return (
          <Box
            component="li"
            {...liProps}
            key={rowKey}
            // The row shows the Sorte alone, so the full "Kultur – Sorte" text
            // stays the accessible name.
            aria-label={option.label}
            sx={cultureSearchVarietyOptionSx}
          >
            <LocalOfferOutlinedIcon fontSize="small" sx={cultureSearchVarietyIconSx} />
            <Typography component="span" sx={cultureSearchVarietyNameSx}>
              {getCultureSearchVarietyLabel(option, option.label)}
            </Typography>
          </Box>
        );
      }}
    />
  );
}
