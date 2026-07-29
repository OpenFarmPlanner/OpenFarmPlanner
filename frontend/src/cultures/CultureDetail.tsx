/**
 * Culture Detail component with searchable dropdown and detailed crop information view.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Ref } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import { useSearchParams } from 'react-router';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from '../i18n';
import { CultureFiltersPopover } from './CultureFiltersPopover';
import { CultureMobileSelectorDialog } from './CultureMobileSelectorDialog';
import { CultureHeaderActionsMenu } from './CultureHeaderActionsMenu';
import { CultureTitleSelectorButton } from './CultureTitleSelectorButton';
import TuneIcon from '@mui/icons-material/Tune';
import EditIcon from '@mui/icons-material/Edit';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import {
  Badge,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  Chip,
  Divider,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Button,
  IconButton,
} from '@mui/material';
import type { Culture } from '../api/api';
import { SearchableSelect } from '../components/inputs/SearchableSelect';
import type { SearchableSelectOption } from '../components/inputs/SearchableSelect';
import { UI_LABEL_SEPARATOR } from '../utils/uiLabelSeparator';
import EmptyStateCard from '../components/project/EmptyStateCard';
import { stripCitationMarkers } from '../components/data-grid/markdown';
import { useCultureListKeyboardNavigation } from './useCultureListKeyboardNavigation';
import { DetailPageActions } from '../components/layout/DetailPageActions';
import { resolveLocaleFromLanguage } from '../utils/numberLocalization';
import { getCultureDisplayName } from './cultureDisplay';

interface CultureDetailProps {
  cultures: Culture[];
  isLoading?: boolean;
  selectedCultureId?: number;
  onCultureSelect: (culture: Culture | null) => void;
  onCreateCulture?: () => void;
  onOpenPublicLibrary?: () => void;
  onEditCulture?: (culture: Culture) => void;
  onCreatePlan?: () => void;
  onOpenHistory?: () => void;
  onPublishCulture?: () => void;
  onWithdrawPublicCulture?: (culture: Culture) => void;
  onRemovePublicCulture?: (culture: Culture) => void;
  onDeleteCulture?: (culture: Culture) => void;
  canModeratePublicCulture?: boolean;
  canCreatePlan?: boolean;
  isPublishingCulture?: boolean;
  publishActionLabel?: string;
  searchInputRef?: Ref<HTMLInputElement>;
}

import {
  CULTURE_FILTERS_STORAGE_KEY,
  formatDistance,
  formatNumber,
  formatPackageSizes,
  formatSeedRateNumber,
  formatSeedUnitLabel,
  getSowingMonths,
  type PersistedCultureFilters,
} from './cultureDetailFormatters';


export function CultureDetail({
  cultures,
  isLoading = false,
  selectedCultureId,
  onCultureSelect,
  onCreateCulture,
  onOpenPublicLibrary,
  onEditCulture,
  onCreatePlan,
  onOpenHistory,
  onPublishCulture,
  onWithdrawPublicCulture,
  onRemovePublicCulture,
  onDeleteCulture,
  canModeratePublicCulture = false,
  canCreatePlan = true,
  isPublishingCulture = false,
  publishActionLabel,
  searchInputRef,
}: CultureDetailProps) {
  const { t, i18n } = useTranslation('cultures');
  const locale = resolveLocaleFromLanguage(i18n.resolvedLanguage ?? i18n.language);
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isTabletLayout = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const isMobileLayout = useMediaQuery(theme.breakpoints.down('sm'));
  const isMobileLandscapeLayout = useMediaQuery(
    `${theme.breakpoints.between('sm', 'md')} and (orientation: landscape) and (max-height: 560px)`,
  );
  const useUnifiedMobileLayout = isMobileLayout || isMobileLandscapeLayout;
  const supplierIdFromQuery = searchParams.get('supplierId') ?? '';
  
  // Initialize filters from sessionStorage
  const initializeFilters = (): PersistedCultureFilters => {
    const raw = window.sessionStorage.getItem(CULTURE_FILTERS_STORAGE_KEY);
    if (!raw) {
      return {
        searchQuery: '',
        selectedFamilyFilter: '',
        selectedCultivationFilter: '',
        selectedNutrientFilter: '',
        selectedSupplierFilter: supplierIdFromQuery,
        growthDaysMin: '',
        growthDaysMax: '',
        yieldMin: '',
        yieldMax: '',
        selectedSowingMonths: [],
      };
    }
    try {
      const parsed = JSON.parse(raw) as PersistedCultureFilters;
      return {
        searchQuery: parsed.searchQuery ?? '',
        selectedFamilyFilter: parsed.selectedFamilyFilter ?? '',
        selectedCultivationFilter: parsed.selectedCultivationFilter ?? '',
        selectedNutrientFilter: parsed.selectedNutrientFilter ?? '',
        selectedSupplierFilter: supplierIdFromQuery || parsed.selectedSupplierFilter || '',
        growthDaysMin: parsed.growthDaysMin ?? '',
        growthDaysMax: parsed.growthDaysMax ?? '',
        yieldMin: parsed.yieldMin ?? '',
        yieldMax: parsed.yieldMax ?? '',
        selectedSowingMonths: Array.isArray(parsed.selectedSowingMonths) ? parsed.selectedSowingMonths : [],
      };
    } catch {
      window.sessionStorage.removeItem(CULTURE_FILTERS_STORAGE_KEY);
      return {
        searchQuery: '',
        selectedFamilyFilter: '',
        selectedCultivationFilter: '',
        selectedNutrientFilter: '',
        selectedSupplierFilter: supplierIdFromQuery,
        growthDaysMin: '',
        growthDaysMax: '',
        yieldMin: '',
        yieldMax: '',
        selectedSowingMonths: [],
      };
    }
  };

  const [filters, setFilters] = useState<PersistedCultureFilters>(initializeFilters);
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [headerMenuAnchorEl, setHeaderMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [mobileSelectorOpen, setMobileSelectorOpen] = useState(false);
  const isFilterPopoverOpen = Boolean(filterAnchorEl);
  const detailSectionGridSx = {
    display: 'grid',
    gridTemplateColumns: {
      xs: '1fr',
      sm: 'repeat(2, minmax(180px, 1fr))',
      lg: 'repeat(3, minmax(180px, 1fr))',
    },
    gap: 2,
    justifyContent: 'start',
  } as const;

  const activeFilterCount = useMemo(
    () => {
      const filterValues = [
        filters.selectedFamilyFilter,
        filters.selectedCultivationFilter,
        filters.selectedNutrientFilter,
        filters.selectedSupplierFilter,
        filters.growthDaysMin,
        filters.growthDaysMax,
        filters.yieldMin,
        filters.yieldMax,
        filters.selectedSowingMonths.length > 0 ? 'months' : '',
      ];
      return filterValues.filter((v) => typeof v === 'string' && v.length > 0).length;
    },
    [filters],
  );

  const familyOptions = useMemo(
    () => Array.from(new Set(
      cultures
        .map((culture) => culture.crop_family?.trim())
        .filter((entry): entry is string => Boolean(entry))
    )).sort((left, right) => left.localeCompare(right, 'de')),
    [cultures]
  );

  const supplierOptions = useMemo(
    () => {
      const suppliersById = new Map<string, string>();

      cultures.forEach((culture) => {
        if (culture.supplier?.id !== undefined) {
          suppliersById.set(String(culture.supplier.id), culture.supplier.name);
        }

        culture.supplier_data?.forEach((supplierRow) => {
          const supplierId = supplierRow.supplier_id ?? supplierRow.supplier?.id;
          const supplierName = supplierRow.supplier?.name ?? supplierRow.supplier_name;
          if (typeof supplierId === 'number' && supplierName) {
            suppliersById.set(String(supplierId), supplierName);
          }
        });
      });

      const options = Array.from(suppliersById.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name, 'de'));

      if (
        filters.selectedSupplierFilter
        && !options.some((option) => option.id === filters.selectedSupplierFilter)
      ) {
        return [
          ...options,
          {
            id: filters.selectedSupplierFilter,
            name: t('filters.unknownSupplier', { id: filters.selectedSupplierFilter }),
          },
        ];
      }

      return options;
    },
    [cultures, filters.selectedSupplierFilter, t],
  );

  // Helper functions to update individual filter fields
  const updateFilter = <K extends keyof PersistedCultureFilters>(
    key: K,
    value: PersistedCultureFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short' }),
    [locale],
  );

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => ({
      value: index + 1,
      label: monthFormatter.format(new Date(2026, index, 1)),
    })),
    [monthFormatter],
  );

  // Persist filters to sessionStorage whenever they change
  useEffect(() => {
    window.sessionStorage.setItem(CULTURE_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    const supplierIdFromQuery = searchParams.get('supplierId');
    if (!supplierIdFromQuery) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFilters((prev) => (
        prev.selectedSupplierFilter === supplierIdFromQuery
          ? prev
          : {
            ...prev,
            selectedSupplierFilter: supplierIdFromQuery,
          }
      ));

      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete('supplierId');
      setSearchParams(nextSearchParams, { replace: true });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [searchParams, setSearchParams]);

  const filteredCultures = useMemo(() => {
    const parsedGrowthDaysMin = filters.growthDaysMin ? Number(filters.growthDaysMin) : null;
    const parsedGrowthDaysMax = filters.growthDaysMax ? Number(filters.growthDaysMax) : null;
    const parsedYieldMin = filters.yieldMin ? Number(filters.yieldMin) : null;
    const parsedYieldMax = filters.yieldMax ? Number(filters.yieldMax) : null;

    const normalizedQuery = filters.searchQuery.trim().toLowerCase();
    const selectedSupplierId = filters.selectedSupplierFilter ? Number(filters.selectedSupplierFilter) : null;
    return cultures.filter((culture) => {
      const displayName = getCultureDisplayName(culture);
      const cultureName = displayName.toLowerCase();
      const storedCultureName = culture.name?.toLowerCase() ?? '';
      const nameMatches = normalizedQuery.length === 0
        || cultureName.includes(normalizedQuery)
        || storedCultureName.includes(normalizedQuery);
      const familyMatches = filters.selectedFamilyFilter.length === 0 || culture.crop_family === filters.selectedFamilyFilter;
      const cultivationValues = culture.cultivation_types && culture.cultivation_types.length > 0
        ? culture.cultivation_types
        : (culture.cultivation_type ? [culture.cultivation_type] : []);
      const cultivationMatches = (
        filters.selectedCultivationFilter.length === 0
        || (filters.selectedCultivationFilter === 'both'
          ? cultivationValues.includes('direct_sowing') && cultivationValues.includes('pre_cultivation')
          : cultivationValues.includes(filters.selectedCultivationFilter as 'direct_sowing' | 'pre_cultivation'))
      );
      const growthValue = typeof culture.growth_duration_days === 'number' ? culture.growth_duration_days : null;
      const growthMatches = (
        (parsedGrowthDaysMin === null || (growthValue !== null && growthValue >= parsedGrowthDaysMin))
        && (parsedGrowthDaysMax === null || (growthValue !== null && growthValue <= parsedGrowthDaysMax))
      );
      const nutrientMatches = filters.selectedNutrientFilter.length === 0 || culture.nutrient_demand === filters.selectedNutrientFilter;
      const yieldValue = typeof culture.expected_yield === 'number' ? culture.expected_yield : null;
      const yieldMatches = (
        (parsedYieldMin === null || (yieldValue !== null && yieldValue >= parsedYieldMin))
        && (parsedYieldMax === null || (yieldValue !== null && yieldValue <= parsedYieldMax))
      );
      const sowingMonths = getSowingMonths(culture);
      const sowingMatches = filters.selectedSowingMonths.length === 0
        || filters.selectedSowingMonths.some((month) => sowingMonths.includes(month));
      const supplierIds = [
        culture.supplier?.id,
        culture.selected_seed_demand_supplier,
        ...(culture.supplier_data ?? []).map((supplierRow) => supplierRow.supplier_id ?? supplierRow.supplier?.id),
      ];
      const supplierMatches = selectedSupplierId === null
        || supplierIds.some((supplierId) => supplierId === selectedSupplierId);

      return nameMatches
        && familyMatches
        && cultivationMatches
        && growthMatches
        && nutrientMatches
        && yieldMatches
        && sowingMatches
        && supplierMatches;
    });
  }, [
    cultures,
    filters,
  ]);

  useEffect(() => {
    if (isLoading || cultures.length === 0) {
      return;
    }

    const selectedCultureExists = selectedCultureId !== undefined
      && cultures.some((culture) => culture.id === selectedCultureId);
    if (selectedCultureExists) {
      return;
    }

    const [firstFilteredCulture] = filteredCultures;
    onCultureSelect(firstFilteredCulture ?? null);
  }, [cultures, filteredCultures, isLoading, onCultureSelect, selectedCultureId]);

  const cultureOptions: SearchableSelectOption<Culture>[] = useMemo(
    () => {
      const optionCultures = [...filteredCultures];

      return optionCultures
        .filter((culture) => culture.id !== undefined)
        .map((culture) => ({
        value: culture.id!,
        label: `${getCultureDisplayName(culture)}${culture.variety ? `${UI_LABEL_SEPARATOR}${culture.variety}` : ''}${culture.seed_supplier ? ` | ${culture.seed_supplier}` : ''}`,
        data: culture,
      }));
    },
    [filteredCultures]
  );

  const selectedCulture = useMemo(
    () => cultures.find((culture) => culture.id === selectedCultureId) ?? null,
    [cultures, selectedCultureId],
  );

  const cultureListNavigation = useCultureListKeyboardNavigation({
    items: filteredCultures,
    selectedId: selectedCultureId,
    getId: (culture) => culture.id,
    onSelect: onCultureSelect,
  });

  const selectedOption = useMemo(
    () => (
      selectedCulture?.id === undefined
        ? null
        : {
          value: selectedCulture.id,
          label: `${getCultureDisplayName(selectedCulture)}${selectedCulture.variety ? `${UI_LABEL_SEPARATOR}${selectedCulture.variety}` : ''}${selectedCulture.seed_supplier ? ` | ${selectedCulture.seed_supplier}` : ''}`,
          data: selectedCulture,
        }
    ),
    [selectedCulture],
  );
  
  const supplierRows = useMemo(
    () => selectedCulture?.supplier_data ?? [],
    [selectedCulture?.supplier_data],
  );

  const orderedSupplierRows = useMemo(() => {
    if (supplierRows.length <= 1) {
      return supplierRows;
    }

    const preferredSupplierId = selectedCulture?.supplier?.id ?? selectedCulture?.selected_seed_demand_supplier ?? null;
    if (typeof preferredSupplierId !== 'number') {
      return supplierRows;
    }

    const preferredIndex = supplierRows.findIndex((row) => (row.supplier?.id ?? row.supplier_id ?? null) === preferredSupplierId);
    if (preferredIndex <= 0) {
      return supplierRows;
    }

    return [supplierRows[preferredIndex], ...supplierRows.filter((_row, index) => index !== preferredIndex)];
  }, [selectedCulture?.selected_seed_demand_supplier, selectedCulture?.supplier?.id, supplierRows]);
  const hasMultipleSupplierRows = supplierRows.length > 1;
  const activeCultivationTypes = useMemo(
    () => (
      selectedCulture
        ? (
          selectedCulture.cultivation_types && selectedCulture.cultivation_types.length > 0
            ? selectedCulture.cultivation_types
            : (selectedCulture.cultivation_type ? [selectedCulture.cultivation_type] : [])
        ).filter((item): item is 'direct_sowing' | 'pre_cultivation' => (
          item === 'direct_sowing' || item === 'pre_cultivation'
        ))
        : []
    ),
    [selectedCulture]
  );
  const seedRateRows = useMemo(() => {
    if (!selectedCulture) {
      return [];
    }
    const isDirectActive = activeCultivationTypes.includes('direct_sowing');
    const isPreCultivationActive = activeCultivationTypes.includes('pre_cultivation');

    const rows: Array<{ method: 'direct_sowing' | 'pre_cultivation'; value: number; unit: string; safety: number | null }> = [];
    if (
      isDirectActive
      && selectedCulture.seed_rate_direct_value !== null
      && selectedCulture.seed_rate_direct_value !== undefined
      && selectedCulture.seed_rate_direct_unit
    ) {
      rows.push({
        method: 'direct_sowing',
        value: selectedCulture.seed_rate_direct_value,
        unit: selectedCulture.seed_rate_direct_unit,
        safety: selectedCulture.sowing_calculation_safety_percent_direct ?? null,
      });
    }
    if (
      isPreCultivationActive
      && selectedCulture.seed_rate_pre_cultivation_value !== null
      && selectedCulture.seed_rate_pre_cultivation_value !== undefined
      && selectedCulture.seed_rate_pre_cultivation_unit
    ) {
      rows.push({
        method: 'pre_cultivation',
        value: selectedCulture.seed_rate_pre_cultivation_value,
        unit: selectedCulture.seed_rate_pre_cultivation_unit,
        safety: selectedCulture.sowing_calculation_safety_percent_pre_cultivation ?? null,
      });
    }

    if (rows.length > 0) {
      return rows;
    }

    if (selectedCulture.seed_rate_by_cultivation && Object.keys(selectedCulture.seed_rate_by_cultivation).length > 0) {
      return Object.entries(selectedCulture.seed_rate_by_cultivation)
        .filter(([method, payload]) => (
          activeCultivationTypes.includes(method as 'direct_sowing' | 'pre_cultivation')
          && (
          (method === 'direct_sowing' || method === 'pre_cultivation')
          && payload
          && typeof payload.value === 'number'
          && typeof payload.unit === 'string'
          )
        ))
        .map(([method, payload]) => ({
          method: method as 'direct_sowing' | 'pre_cultivation',
          value: payload.value,
          unit: payload.unit,
          safety: null,
        }));
    }

    if (
      activeCultivationTypes.length > 0
      && selectedCulture.seed_rate_value !== null
      && selectedCulture.seed_rate_value !== undefined
      && selectedCulture.seed_rate_unit
    ) {
      return [{
        method: activeCultivationTypes.includes('direct_sowing') ? 'direct_sowing' : 'pre_cultivation',
        value: selectedCulture.seed_rate_value,
        unit: selectedCulture.seed_rate_unit,
        safety: selectedCulture.sowing_calculation_safety_percent ?? null,
      }];
    }

    return [];
  }, [activeCultivationTypes, selectedCulture]);

  const selectorControl = cultures.length > 0 ? (
      <Box sx={{ width: '100%', p: 1.25, borderBottom: '1px solid #e5e7eb', bgcolor: '#fcfdfc' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <SearchableSelect
              options={cultureOptions}
              value={selectedOption}
              onChange={(option) => onCultureSelect(option?.data ?? null)}
              label={t('searchPlaceholder')}
              placeholder={t('searchInputPlaceholderEnhanced')}
              noOptionsText={t('noOptionsEnhanced')}
              inputRef={searchInputRef}
              textFieldSx={{
                width: '100%',
              }}
              inputValue={filters.searchQuery}
              onInputChange={(value) => updateFilter('searchQuery', value)}
              endAdornment={(
                <IconButton
                  size="small"
                  onClick={(event) => setFilterAnchorEl(event.currentTarget)}
                  aria-expanded={isFilterPopoverOpen}
                  aria-haspopup="dialog"
                  aria-controls={isFilterPopoverOpen ? 'culture-filters-popover' : undefined}
                  aria-label={t('filters.openAdvanced')}
                  sx={{ bgcolor: activeFilterCount > 0 ? 'action.selected' : 'transparent' }}
                >
                  <Badge color="primary" badgeContent={activeFilterCount > 0 ? activeFilterCount : null}>
                    <TuneIcon fontSize="small" />
                  </Badge>
                </IconButton>
              )}
            />
          </Box>
        </Stack>

        <CultureFiltersPopover
          anchorEl={filterAnchorEl}
          onClose={() => setFilterAnchorEl(null)}
          filters={filters}
          onFilterChange={updateFilter}
          familyOptions={familyOptions}
          supplierOptions={supplierOptions}
          monthOptions={monthOptions}
          onReset={() => {
            setFilters({
              searchQuery: '',
              selectedFamilyFilter: '',
              selectedCultivationFilter: '',
              selectedNutrientFilter: '',
              selectedSupplierFilter: '',
              growthDaysMin: '',
              growthDaysMax: '',
              yieldMin: '',
              yieldMax: '',
              selectedSowingMonths: [],
            });
            setFilterAnchorEl(null);
          }}
        />
      </Box>
  ) : null;

  return (
    <Box sx={{ width: '100%' }}>

      {/* Detail View */}
      {!isLoading && cultures.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: useUnifiedMobileLayout
              ? 'minmax(0, 1fr)'
              : {
                xs: '1fr',
                md: '230px minmax(0, 1fr)',
                lg: '300px minmax(0, 1fr)',
                xl: '330px minmax(0, 1fr)',
              },
            gap: { xs: 1.25, lg: 1.1, xl: 1.25 },
            alignItems: 'start',
          }}
        >
          {!useUnifiedMobileLayout ? (<Card
            sx={{
              width: '100%',
              flexShrink: 0,
              maxHeight: { md: 'calc(100vh - 210px)' },
              overflow: 'hidden',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
              borderRadius: 2,
            }}
          >
            {selectorControl}
            <List
              dense
              role="listbox"
              aria-label={t('title')}
              sx={{
                py: { xs: 0.5, lg: 0.75 },
                px: { xs: 0.5, lg: 0.75 },
                overflowY: 'auto',
                maxHeight: { sm: 'calc(100vh - 290px)' },
              }}
            >
              {filteredCultures.map((culture) => {
                const cultivationValues = culture.cultivation_types && culture.cultivation_types.length > 0
                  ? culture.cultivation_types
                  : (culture.cultivation_type ? [culture.cultivation_type] : []);
                const cultivationLabel = cultivationValues.includes('direct_sowing') && cultivationValues.includes('pre_cultivation')
                  ? t('filters.both')
                  : cultivationValues.includes('direct_sowing')
                    ? t('filters.directSowing')
                    : cultivationValues.includes('pre_cultivation')
                      ? t('filters.preCultivation')
                      : '';
                const secondaryParts = isTabletLayout
                  ? [culture.variety]
                  : [culture.variety, cultivationLabel, culture.seed_supplier].filter(Boolean);
                const secondary = secondaryParts.filter(Boolean).join(' • ');

                return (
                  <ListItemButton
                    key={culture.id}
                    {...cultureListNavigation.getItemProps(culture)}
                    selected={selectedCulture?.id === culture.id}
                    onClick={() => cultureListNavigation.selectItem(culture)}
                    sx={{
                      borderRadius: 1.5,
                      px: { xs: 0.875, lg: 1 },
                      py: { xs: 0.5, lg: 0.75 },
                      mb: { xs: 0.375, lg: 0.5 },
                      alignItems: 'flex-start',
                      border: '1px solid transparent',
                      '&:hover': { bgcolor: '#f4f8f4', borderColor: '#d6e6d8' },
                      '&.Mui-selected': {
                        bgcolor: 'rgba(37, 111, 42, 0.12)',
                        borderColor: 'rgba(37, 111, 42, 0.32)',
                      },
                      '&.Mui-selected:hover': { bgcolor: 'rgba(37, 111, 42, 0.16)' },
                    }}
                  >
                    <ListItemText
                      primary={getCultureDisplayName(culture)}
                      primaryTypographyProps={{ fontSize: { xs: '0.9rem', lg: '0.95rem' }, fontWeight: 600, lineHeight: 1.25 }}
                      secondary={secondary || culture.crop_family || undefined}
                      secondaryTypographyProps={{ fontSize: { xs: '0.76rem', lg: '0.8rem' }, color: 'text.secondary', lineHeight: 1.25 }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Card>) : null}
          <Box sx={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
            {selectedCulture ? (
              <Card sx={{ width: '100%', maxWidth: useUnifiedMobileLayout ? '100%' : { sm: 920, lg: 980, xl: 1040 } }}>
                <CardContent sx={{ p: { xs: 1, sm: 2, lg: 2.5 } }}>
            {/* Header with crop name and badge */}
                  <Box sx={{ mb: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', flexWrap: { xs: 'nowrap', sm: 'wrap' }, gap: { xs: 1, sm: 2 }, mb: 0.75 }}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1.75 }}>
                    {selectedCulture.display_color ? (
                      <Box
                        sx={{
                          width: 4,
                          borderRadius: 1,
                          backgroundColor: selectedCulture.display_color,
                          opacity: 0.75,
                          my: 0.5,
                          alignSelf: 'stretch',
                          flexShrink: 0,
                        }}
                        aria-label={t('form.displayColorAria')}
                        title={selectedCulture.display_color}
                      />
                    ) : null}
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.25 }}>
                      {useUnifiedMobileLayout ? (
                        <CultureTitleSelectorButton
                          title={getCultureDisplayName(selectedCulture)}
                          ariaLabel={t('selectCulture')}
                          onClick={() => setMobileSelectorOpen(true)}
                        />
                      ) : (
                        <Typography component="h2" sx={{ fontSize: { xs: '1.25rem', sm: '2rem' }, lineHeight: 1.2, fontWeight: 600 }}>
                          {getCultureDisplayName(selectedCulture)}
                        </Typography>
                      )}
                      {selectedCulture.variety && (
                        <Typography variant="body2" color="text.secondary">
                          {selectedCulture.variety}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          color={selectedCulture.origin_type === 'imported' ? 'secondary' : 'default'}
                          label={selectedCulture.origin_type === 'imported' ? t('library.badges.imported') : t('library.badges.local')}
                        />
                        {selectedCulture.is_modified_from_source ? (
                          <Chip size="small" color="warning" label={t('library.badges.modified')} />
                        ) : null}
                      </Box>
                    </Box>
                  </Box>
                </Box>
                <DetailPageActions
                  compact={useUnifiedMobileLayout}
                  primaryActions={[
                    {
                      label: t('buttons.edit'),
                      icon: <EditIcon fontSize="small" />,
                      onClick: () => onEditCulture?.(selectedCulture),
                      disabled: !onEditCulture,
                    },
                    {
                      label: t('buttons.createPlantingPlan'),
                      icon: <AgricultureIcon fontSize="small" />,
                      onClick: () => onCreatePlan?.(),
                      disabled: !canCreatePlan || !onCreatePlan,
                      tooltip: canCreatePlan ? undefined : t('buttons.createPlantingPlanMissingBedsTooltip'),
                      variant: 'contained',
                    },
                  ]}
                  overflowLabel={t('buttons.moreActions')}
                  onOpenOverflow={(event) => setHeaderMenuAnchorEl(event.currentTarget)}
                />
              </Box>
              <CultureHeaderActionsMenu
                anchorEl={headerMenuAnchorEl}
                onClose={() => setHeaderMenuAnchorEl(null)}
                onOpenHistory={() => onOpenHistory?.()}
                onPublish={() => onPublishCulture?.()}
                isPublishing={isPublishingCulture}
                publishLabel={publishActionLabel ?? t('library.publishButton')}
                onWithdrawPublicCulture={() => onWithdrawPublicCulture?.(selectedCulture)}
                onRemovePublicCulture={() => onRemovePublicCulture?.(selectedCulture)}
                canWithdrawPublicCulture={Boolean(selectedCulture.owned_public_culture_id && onWithdrawPublicCulture)}
                canModeratePublicCulture={Boolean(selectedCulture.owned_public_culture_id && canModeratePublicCulture)}
                onDelete={() => onDeleteCulture?.(selectedCulture)}
                t={t}
              />
            </Box>

            <Divider sx={{ mb: 2.5 }} />

            {/* General Information Section */}
            <Box sx={{ mb: 3, p: { xs: 1.25, sm: 2 }, border: '1px solid #e5e7eb', borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                {t('detail.sections.general')}
              </Typography>
              <Box sx={detailSectionGridSx}>
                {selectedCulture.crop_family && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('form.cropFamily')}
                    </Typography>
                    <Typography variant="body1">
                      {selectedCulture.crop_family}
                    </Typography>
                  </Box>
                )}
                {selectedCulture.nutrient_demand && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('form.nutrientDemand')}
                    </Typography>
                    <Typography variant="body1">
                      {selectedCulture.nutrient_demand === 'low'
                        ? t('form.nutrientDemandLow')
                        : selectedCulture.nutrient_demand === 'medium'
                          ? t('form.nutrientDemandMedium')
                          : t('form.nutrientDemandHigh')}
                    </Typography>
                  </Box>
                )}
                {activeCultivationTypes.length > 0 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('form.cultivationType')}
                    </Typography>
                    <Typography variant="body1">
                      {activeCultivationTypes
                        .map((item) => (
                          item === 'pre_cultivation'
                            ? t('form.cultivationTypePreCultivation')
                            : t('form.cultivationTypeDirectSowing')
                        ))
                        .join(', ')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 2.5 }} />

            {/* Timing Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {t('form.sectionTiming')}
              </Typography>
              <Box sx={detailSectionGridSx}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('form.growthDurationDays')}
                  </Typography>
                  <Typography variant="body1">
                    {formatNumber(selectedCulture.growth_duration_days, t, locale)} {t('detail.units.days')}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('form.harvestDurationDays')}
                  </Typography>
                  <Typography variant="body1">
                    {formatNumber(selectedCulture.harvest_duration_days, t, locale)} {t('detail.units.days')}
                  </Typography>
                </Box>
                {selectedCulture.propagation_duration_days && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('form.propagationDurationDays')}
                    </Typography>
                    <Typography variant="body1">
                      {formatNumber(selectedCulture.propagation_duration_days, t, locale)} {t('detail.units.days')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 2.5 }} />

            {/* Spacing Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {t('detail.sections.spacing')}
              </Typography>
              <Box sx={detailSectionGridSx}>
                {selectedCulture.distance_within_row_cm !== null && selectedCulture.distance_within_row_cm !== undefined && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('detail.fields.distanceWithinRow')}
                    </Typography>
                    <Typography variant="body1">
                      {formatDistance(selectedCulture.distance_within_row_cm, t, locale)} {t('detail.units.centimeters')}
                    </Typography>
                  </Box>
                )}
                {selectedCulture.row_spacing_cm !== null && selectedCulture.row_spacing_cm !== undefined && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('detail.fields.rowSpacing')}
                    </Typography>
                    <Typography variant="body1">
                      {formatDistance(selectedCulture.row_spacing_cm, t, locale)} {t('detail.units.centimeters')}
                    </Typography>
                  </Box>
                )}
                {selectedCulture.sowing_depth_cm !== null && selectedCulture.sowing_depth_cm !== undefined && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('detail.fields.sowingDepth')}
                    </Typography>
                    <Typography variant="body1">
                      {formatDistance(selectedCulture.sowing_depth_cm, t, locale, 1)} {t('detail.units.centimeters')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 2.5 }} />

            {/* Seeding Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {t('detail.sections.seed')}
              </Typography>
              <Box sx={detailSectionGridSx}>
                {seedRateRows.length > 0 && activeCultivationTypes.length <= 1 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">{t('form.seedAmountLabel')}</Typography>
                    <Typography variant="body1">
                      {formatSeedRateNumber(seedRateRows[0].value, t, locale)} {formatSeedUnitLabel(seedRateRows[0].unit, t)}
                    </Typography>
                  </Box>
                )}
                {seedRateRows.length > 0 && activeCultivationTypes.length <= 1 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {t('detail.fields.seedSafetyMargin')}
                    </Typography>
                    <Typography variant="body1">
                      {seedRateRows[0].safety !== null ? `${formatNumber(seedRateRows[0].safety, t, locale)} ${t('detail.units.percent')}` : '-'}
                    </Typography>
                  </Box>
                )}
                {seedRateRows.length > 0 && activeCultivationTypes.length > 1 && (
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Typography variant="body2" color="text.secondary">{t('detail.fields.seedRateByCultivation')}</Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('detail.fields.method')}</TableCell>
                          <TableCell>{t('form.seedAmountLabel')}</TableCell>
                          <TableCell>{t('form.seedUnitLabel')}</TableCell>
                          <TableCell>{t('detail.fields.seedSafetyMarginPercent')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {seedRateRows.map((row) => (
                          <TableRow key={`${row.method}-${row.unit}-${row.value}`}>
                            <TableCell>{row.method === 'pre_cultivation' ? t('form.cultivationTypePreCultivation') : t('form.cultivationTypeDirectSowing')}</TableCell>
                            <TableCell>{formatSeedRateNumber(row.value, t, locale)}</TableCell>
                            <TableCell>{formatSeedUnitLabel(row.unit, t)}</TableCell>
                            <TableCell>{row.safety !== null ? `${formatNumber(row.safety, t, locale)} ${t('detail.units.percent')}` : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
                {seedRateRows.length === 0 && selectedCulture.sowing_calculation_safety_percent !== undefined && selectedCulture.sowing_calculation_safety_percent !== null && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('detail.fields.seedSafetyMargin')}
                    </Typography>
                    <Typography variant="body1">
                      {formatNumber(selectedCulture.sowing_calculation_safety_percent, t, locale)} {t('detail.units.percent')}
                    </Typography>
                  </Box>
                )}
                {selectedCulture.seeding_requirement !== undefined && selectedCulture.seeding_requirement !== null && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('detail.fields.seedingRequirement')}
                    </Typography>
                    <Typography variant="body1">
                      {formatSeedRateNumber(selectedCulture.seeding_requirement, t, locale)}
                      {selectedCulture.seeding_requirement_type === 'per_sqm'
                        ? ` ${t('detail.seedingRequirementTypes.perSqm')}`
                        : selectedCulture.seeding_requirement_type === 'per_plant'
                          ? ` ${t('detail.seedingRequirementTypes.perPlant')}`
                          : ''}
                    </Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('form.thousandKernelWeightLabel')}
                  </Typography>
                  <Typography variant="body1">
                    {selectedCulture.thousand_kernel_weight_g !== null && selectedCulture.thousand_kernel_weight_g !== undefined
                      ? `${formatNumber(selectedCulture.thousand_kernel_weight_g, t, locale)} ${t('detail.units.grams')}`
                      : t('noData')}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
                <Typography variant="subtitle1" component="h3" gutterBottom>
                  {hasMultipleSupplierRows ? t('form.supplierDataSectionTitle') : t('filters.supplier')}
                </Typography>
                {hasMultipleSupplierRows && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('form.supplierDataSectionDescription')}
                  </Typography>
                )}
                {orderedSupplierRows.length === 0 ? (
                  <Box sx={{ gridColumn: '1 / -1', display: 'inline-flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
                    <Typography variant="body2">{t('form.noSupplierDataRows')}</Typography>
                  </Box>
                ) : (
                  <Stack spacing={2} sx={{ gridColumn: '1 / -1' }}>
                    {orderedSupplierRows.map((row, index) => (
                      <Box key={row.id ?? `${row.supplier?.id ?? row.supplier_id ?? 'supplier'}-${index}`}>
                        {hasMultipleSupplierRows && index > 0 ? <Divider sx={{ mb: 2 }} /> : null}
                        <Stack spacing={1}>
                          <Typography variant="subtitle2">{row.supplier?.name || row.supplier_name || t('form.supplier')}</Typography>
                          {row.supplier_product_name ? (
                            <Box>
                              <Typography variant="body2" color="text.secondary">{t('form.supplierProductNameLabel')}</Typography>
                              <Typography variant="body1">{row.supplier_product_name}</Typography>
                            </Box>
                          ) : null}
                          {row.supplier_product_url && (
                            <Link href={row.supplier_product_url} target="_blank" rel="noopener noreferrer" underline="hover">
                              {row.supplier_product_url}
                            </Link>
                          )}
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {t('form.seedPackagesLabel')}
                            </Typography>
                            <Typography variant="body1">
                              {formatPackageSizes(row.packaging_sizes, t, locale)}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />
            {/* Harvest Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                {t('detail.sections.harvest')}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(auto-fit, minmax(180px, 260px))',
                  },
                  gap: 2,
                  justifyContent: 'start',
                }}
              >
                {selectedCulture.harvest_method && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('form.yieldUnit')}
                    </Typography>
                    <Typography variant="body1">
                      {selectedCulture.harvest_method === 'per_plant' ? t('form.yieldUnitPerPlant') : t('form.yieldUnitPerSqm')}
                    </Typography>
                  </Box>
                )}
                {selectedCulture.expected_yield && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('form.expectedYield')}
                    </Typography>
                    <Typography variant="body1">
                      {formatNumber(selectedCulture.expected_yield, t, locale)} {t('detail.units.kilograms')}
                    </Typography>
                  </Box>
                )}
                {selectedCulture.allow_deviation_delivery_weeks && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('detail.fields.allowDeviationDeliveryWeeks')}
                    </Typography>
                    <Chip
                      label={t('detail.boolean.yes')}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Notes Section */}
            <Box sx={{ p: { xs: 1.5, sm: 2.5 }, border: '1px solid #e5e7eb', borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                {t('detail.sections.notes')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: { xs: '100%', xl: 1180 } }}>
                {selectedCulture.notes && (
                  <Box>
                    <Box
                      sx={{
                        '& h3': { mt: 2, mb: 1, fontSize: '1.05rem' },
                        '& p': { mb: 1, maxWidth: '95ch' },
                        '& ul': { pl: 3, mb: 1 },
                        '& li': { mb: 0.5 },
                        '& a': { color: 'primary.main' },
                        '& em': { color: 'text.secondary' },
                      }}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ children, ...props }) => (
                            <Link target="_blank" rel="noreferrer" {...props}>
                              {children}
                            </Link>
                          ),
                        }}
                      >
                        {stripCitationMarkers(selectedCulture.notes)}
                      </ReactMarkdown>
                    </Box>
                  </Box>
                )}
              </Box>
                  </Box>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent>
                  {useUnifiedMobileLayout ? (
                    <Typography
                      component="button"
                      type="button"
                      onClick={() => setMobileSelectorOpen(true)}
                      sx={{ border: 'none', background: 'transparent', p: 0, m: 0, color: 'text.secondary', textAlign: 'left', cursor: 'pointer' }}
                    >
                      {t('selectCulture')} ▼
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('selectPrompt')}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            )}
          </Box>
        </Box>
      ) : null}


      {useUnifiedMobileLayout ? (
        <CultureMobileSelectorDialog
          open={mobileSelectorOpen}
          onClose={() => setMobileSelectorOpen(false)}
          selectorControl={selectorControl}
          cultures={filteredCultures}
          selectedCultureId={selectedCulture?.id}
          onSelect={(culture) => {
            onCultureSelect(culture);
            setMobileSelectorOpen(false);
          }}
          t={t}
        />
      ) : null}

      {/* Empty State */}
      {isLoading && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {t('messages.loadingCultures')}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {!isLoading && !selectedCulture && cultures.length === 0 && (
        <EmptyStateCard
          title={t('emptyOnboarding.title')}
          description={t('emptyOnboarding.description')}
          actions={[
            { label: t('emptyOnboarding.openLibraryAction'), onClick: onOpenPublicLibrary },
            { label: t('emptyOnboarding.createAction'), onClick: onCreateCulture },
          ]}
        />
      )}

      {!isLoading && !selectedCulture && cultures.length > 0 && filteredCultures.length === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" align="center" sx={{ mb: 1 }}>
              {t('emptySearch.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
              {t('emptySearch.description')}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setFilters({
                    searchQuery: '',
                    selectedFamilyFilter: '',
                    selectedCultivationFilter: '',
                    selectedNutrientFilter: '',
                    selectedSupplierFilter: '',
                    growthDaysMin: '',
                    growthDaysMax: '',
                    yieldMin: '',
                    yieldMax: '',
                    selectedSowingMonths: [],
                  });
                }}
              >
                {t('emptySearch.resetAction')}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
