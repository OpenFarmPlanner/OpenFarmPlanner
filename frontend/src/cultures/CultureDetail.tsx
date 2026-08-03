/**
 * Culture Detail component with searchable dropdown and detailed crop information view.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
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
import { buildCropHierarchy, findSpeciesCulture, getCropSpeciesKey } from './cropHierarchy';
import { flattenTreeRows } from '../components/hierarchy/utils/treeRows';
import { useExpandedState } from '../components/hierarchy/hooks/useExpandedState';
import { CultureSeedDetails, type CultureSeedRateRow, type ValueSource } from './CultureSeedDetails';

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
  onDeleteCulture?: (culture: Culture) => void;
  canCreatePlan?: boolean;
  isPublishingCulture?: boolean;
  publishActionLabel?: string;
  searchInputRef?: Ref<HTMLInputElement>;
}

const isEmptyCropValue = (value: unknown): boolean => (
  value === null
  || value === undefined
  || value === ''
  || (Array.isArray(value) && value.length === 0)
);

import {
  CULTURE_FILTERS_STORAGE_KEY,
  formatDistance,
  formatNumber,
  formatPackageSizes,
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
  onDeleteCulture,
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
  const [selectedSpeciesViewKey, setSelectedSpeciesViewKey] = useState<string | null>(null);
  const {
    expandedRows: expandedCropRows,
    toggleExpand: toggleCropRow,
    ensureExpanded: ensureCropRowExpanded,
  } = useExpandedState('projectCropLibrary');
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
  const cropChevronButtonSx = {
    width: 30,
    height: 30,
    minWidth: 30,
    p: 0,
    mr: 0.5,
    mt: -0.375,
    color: 'text.primary',
    opacity: 0.72,
    flexShrink: 0,
    '&:hover': {
      opacity: 1,
      bgcolor: 'rgba(37, 111, 42, 0.08)',
    },
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

  const cropHierarchyItems = useMemo(
    () => buildCropHierarchy(filteredCultures),
    [filteredCultures],
  );

  const visibleCropRows = useMemo(
    () => flattenTreeRows(cropHierarchyItems, { expandedIds: expandedCropRows }),
    [cropHierarchyItems, expandedCropRows],
  );

  const selectableCropRows = useMemo(
    () => visibleCropRows.map((row) => row.node).filter((item) => item.culture?.id !== undefined),
    [visibleCropRows],
  );

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
  const selectedCultureSpeciesKey = selectedCulture ? getCropSpeciesKey(selectedCulture) : null;
  const isSelectedSpeciesEntry = Boolean(selectedCulture && !(selectedCulture.variety || '').trim());
  const isSpeciesView = Boolean(
    selectedCulture
    && (
      isSelectedSpeciesEntry
      || (selectedSpeciesViewKey !== null && selectedSpeciesViewKey === selectedCultureSpeciesKey)
    ),
  );

  useEffect(() => {
    if (!selectedCulture?.variety || isSpeciesView || !selectedCultureSpeciesKey) {
      return;
    }
    ensureCropRowExpanded(`species:${selectedCultureSpeciesKey}`);
  }, [ensureCropRowExpanded, isSpeciesView, selectedCulture, selectedCultureSpeciesKey]);

  const selectedCropRowId = selectedCulture
    ? (isSpeciesView && selectedCultureSpeciesKey ? `species:${selectedCultureSpeciesKey}` : `culture:${selectedCulture.id}`)
    : null;

  const cultureListNavigation = useCultureListKeyboardNavigation({
    items: selectableCropRows,
    selectedId: selectedCropRowId,
    getId: (item) => item.id,
    onSelect: (item) => {
      if (item.culture) {
        setSelectedSpeciesViewKey(item.kind === 'species' ? item.speciesKey : null);
        onCultureSelect(item.culture);
      }
    },
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

  const selectedSpeciesCulture = useMemo(
    () => findSpeciesCulture(selectedCulture, cultures),
    [cultures, selectedCulture],
  );

  const getCropValueSource = useCallback((
    field: keyof Culture,
  ): ValueSource | null => {
    if (isSpeciesView || !selectedCulture?.variety || !selectedSpeciesCulture) {
      return null;
    }
    const ownValue = selectedCulture[field];
    if (isEmptyCropValue(ownValue)) {
      return 'fromCrop';
    }
    return 'ownValue';
  }, [isSpeciesView, selectedCulture, selectedSpeciesCulture]);

  const getCropValue = useCallback(<TValue,>(
    field: keyof Culture,
    value: TValue,
  ): TValue => {
    if (
      selectedCulture?.variety
      && !isSpeciesView
      && selectedSpeciesCulture
      && isEmptyCropValue(value)
    ) {
      return selectedSpeciesCulture[field] as TValue;
    }
    return value;
  }, [isSpeciesView, selectedCulture?.variety, selectedSpeciesCulture]);

  const renderValueSource = (field: keyof Culture) => {
    const source = getCropValueSource(field);
    if (!source) {
      return null;
    }
    return (
      <Chip
        size="small"
        variant="outlined"
        label={source === 'fromCrop' ? t('hierarchy.fromCrop') : t('hierarchy.ownValue')}
        sx={{ mt: 0.75 }}
      />
    );
  };
  
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
          getCropValue('cultivation_types', selectedCulture.cultivation_types) && getCropValue('cultivation_types', selectedCulture.cultivation_types)?.length
            ? getCropValue('cultivation_types', selectedCulture.cultivation_types) ?? []
            : (getCropValue('cultivation_type', selectedCulture.cultivation_type) ? [getCropValue('cultivation_type', selectedCulture.cultivation_type)] : [])
        ).filter((item): item is 'direct_sowing' | 'pre_cultivation' => (
          item === 'direct_sowing' || item === 'pre_cultivation'
        ))
        : []
    ),
    [getCropValue, selectedCulture]
  );
  const seedRateRows = useMemo<CultureSeedRateRow[]>(() => {
    if (!selectedCulture) {
      return [];
    }
    const isDirectActive = activeCultivationTypes.includes('direct_sowing');
    const isPreCultivationActive = activeCultivationTypes.includes('pre_cultivation');
    const directValue = getCropValue('seed_rate_direct_value', selectedCulture.seed_rate_direct_value);
    const directUnit = getCropValue('seed_rate_direct_unit', selectedCulture.seed_rate_direct_unit);
    const preCultivationValue = getCropValue('seed_rate_pre_cultivation_value', selectedCulture.seed_rate_pre_cultivation_value);
    const preCultivationUnit = getCropValue('seed_rate_pre_cultivation_unit', selectedCulture.seed_rate_pre_cultivation_unit);

    const rows: CultureSeedRateRow[] = [];
    if (
      isDirectActive
      && directValue !== null
      && directValue !== undefined
      && directUnit
    ) {
      rows.push({
        method: 'direct_sowing',
        value: directValue,
        unit: directUnit,
        safety: getCropValue('sowing_calculation_safety_percent_direct', selectedCulture.sowing_calculation_safety_percent_direct) ?? null,
        valueSource: getCropValueSource('seed_rate_direct_value') ?? getCropValueSource('seed_rate_direct_unit'),
        safetySource: getCropValueSource('sowing_calculation_safety_percent_direct'),
      });
    }
    if (
      isPreCultivationActive
      && preCultivationValue !== null
      && preCultivationValue !== undefined
      && preCultivationUnit
    ) {
      rows.push({
        method: 'pre_cultivation',
        value: preCultivationValue,
        unit: preCultivationUnit,
        safety: getCropValue('sowing_calculation_safety_percent_pre_cultivation', selectedCulture.sowing_calculation_safety_percent_pre_cultivation) ?? null,
        valueSource: getCropValueSource('seed_rate_pre_cultivation_value') ?? getCropValueSource('seed_rate_pre_cultivation_unit'),
        safetySource: getCropValueSource('sowing_calculation_safety_percent_pre_cultivation'),
      });
    }

    if (rows.length > 0) {
      return rows;
    }

    const seedRateByCultivation = getCropValue('seed_rate_by_cultivation', selectedCulture.seed_rate_by_cultivation);
    if (seedRateByCultivation && Object.keys(seedRateByCultivation).length > 0) {
      return Object.entries(seedRateByCultivation)
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
          valueSource: getCropValueSource('seed_rate_by_cultivation'),
          safetySource: null,
        } satisfies CultureSeedRateRow));
    }

    const generalSeedRateValue = getCropValue('seed_rate_value', selectedCulture.seed_rate_value);
    const generalSeedRateUnit = getCropValue('seed_rate_unit', selectedCulture.seed_rate_unit);
    if (
      activeCultivationTypes.length > 0
      && generalSeedRateValue !== null
      && generalSeedRateValue !== undefined
      && generalSeedRateUnit
    ) {
      return [{
        method: activeCultivationTypes.includes('direct_sowing') ? 'direct_sowing' : 'pre_cultivation',
        value: generalSeedRateValue,
        unit: generalSeedRateUnit,
        safety: getCropValue('sowing_calculation_safety_percent', selectedCulture.sowing_calculation_safety_percent) ?? null,
        valueSource: getCropValueSource('seed_rate_value') ?? getCropValueSource('seed_rate_unit'),
        safetySource: getCropValueSource('sowing_calculation_safety_percent'),
      }];
    }

    return [];
  }, [activeCultivationTypes, getCropValue, getCropValueSource, selectedCulture]);

  const selectorControl = cultures.length > 0 ? (
      <Box sx={{ width: '100%', p: 1.25, borderBottom: '1px solid #e5e7eb', bgcolor: '#fcfdfc' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <SearchableSelect
              options={cultureOptions}
              value={selectedOption}
              onChange={(option) => {
                setSelectedSpeciesViewKey(option?.data && !(option.data.variety || '').trim() ? getCropSpeciesKey(option.data) : null);
                onCultureSelect(option?.data ?? null);
              }}
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
              {visibleCropRows.map(({ node, depth, hasChildren }) => {
                const culture = node.culture;
                const cultivationValues = culture?.cultivation_types && culture.cultivation_types.length > 0
                  ? culture.cultivation_types
                  : (culture?.cultivation_type ? [culture.cultivation_type] : []);
                const cultivationLabel = cultivationValues.includes('direct_sowing') && cultivationValues.includes('pre_cultivation')
                  ? t('filters.both')
                  : cultivationValues.includes('direct_sowing')
                    ? t('filters.directSowing')
                    : cultivationValues.includes('pre_cultivation')
                      ? t('filters.preCultivation')
                      : '';
                const secondaryParts = node.kind === 'species'
                  ? [
                    culture?.crop_family,
                    node.varietyCount > 0 ? t('hierarchy.varietyCount', { count: node.varietyCount }) : '',
                  ]
                  : isTabletLayout
                    ? []
                    : [cultivationLabel, culture?.seed_supplier].filter(Boolean);
                const secondary = secondaryParts.filter(Boolean).join(' • ');
                const itemProps = culture?.id !== undefined ? cultureListNavigation.getItemProps(node) : {};
                const isRowSelected = Boolean(
                  culture?.id !== undefined
                  && selectedCulture?.id === culture.id
                  && (node.kind === 'species' ? isSpeciesView : !isSpeciesView),
                );

                return (
                  <ListItemButton
                    key={node.id}
                    {...itemProps}
                    role={culture ? 'option' : 'presentation'}
                    aria-label={node.kind === 'species' ? node.label : undefined}
                    aria-selected={culture ? isRowSelected : undefined}
                    selected={isRowSelected}
                    disabled={!culture}
                    onClick={() => {
                      if (culture) {
                        cultureListNavigation.selectItem(node);
                      }
                    }}
                    onDoubleClick={(event) => {
                      if (!hasChildren) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      toggleCropRow(node.id);
                    }}
                    sx={{
                      borderRadius: 1.5,
                      pl: `calc(${0.875 + depth * 0.85}rem)`,
                      pr: { xs: 0.875, lg: 1 },
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
                    {hasChildren ? (
                      <IconButton
                        size="small"
                        aria-label={expandedCropRows.has(node.id) ? t('hierarchy.collapseCrop') : t('hierarchy.expandCrop')}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleCropRow(node.id);
                        }}
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        sx={cropChevronButtonSx}
                      >
                        {expandedCropRows.has(node.id) ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                      </IconButton>
                    ) : (
                      <Box component="span" sx={{ width: 24, flexShrink: 0 }} />
                    )}
                    <ListItemText
                      primary={node.kind === 'species' ? node.label : node.label}
                      primaryTypographyProps={{
                        fontSize: { xs: '0.9rem', lg: '0.95rem' },
                        fontWeight: node.kind === 'species' ? 700 : 500,
                        lineHeight: 1.25,
                      }}
                      secondary={secondary || (node.kind === 'species' ? culture?.crop_family : undefined)}
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
                      {!isSpeciesView && selectedCulture.variety ? (
                        <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                            {t('hierarchy.varietyLabel')}
                          </Typography>
                          <Typography variant="body2" color="text.primary" sx={{ fontWeight: 600 }}>
                            {selectedCulture.variety}
                          </Typography>
                        </Stack>
                      ) : null}
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
                {getCropValue('crop_family', selectedCulture.crop_family) && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('form.cropFamily')}
                    </Typography>
                    <Typography variant="body1">
                      {getCropValue('crop_family', selectedCulture.crop_family)}
                    </Typography>
                    {renderValueSource('crop_family')}
                  </Box>
                )}
                {getCropValue('nutrient_demand', selectedCulture.nutrient_demand) && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('form.nutrientDemand')}
                    </Typography>
                    <Typography variant="body1">
                      {getCropValue('nutrient_demand', selectedCulture.nutrient_demand) === 'low'
                        ? t('form.nutrientDemandLow')
                        : getCropValue('nutrient_demand', selectedCulture.nutrient_demand) === 'medium'
                          ? t('form.nutrientDemandMedium')
                          : t('form.nutrientDemandHigh')}
                    </Typography>
                    {renderValueSource('nutrient_demand')}
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
                    {renderValueSource('cultivation_types') ?? renderValueSource('cultivation_type')}
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
                    {formatNumber(getCropValue('growth_duration_days', selectedCulture.growth_duration_days), t, locale)} {t('detail.units.days')}
                  </Typography>
                  {renderValueSource('growth_duration_days')}
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('form.harvestDurationDays')}
                  </Typography>
                  <Typography variant="body1">
                    {formatNumber(getCropValue('harvest_duration_days', selectedCulture.harvest_duration_days), t, locale)} {t('detail.units.days')}
                  </Typography>
                  {renderValueSource('harvest_duration_days')}
                </Box>
                {getCropValue('propagation_duration_days', selectedCulture.propagation_duration_days) && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('form.propagationDurationDays')}
                    </Typography>
                    <Typography variant="body1">
                      {formatNumber(getCropValue('propagation_duration_days', selectedCulture.propagation_duration_days), t, locale)} {t('detail.units.days')}
                    </Typography>
                    {renderValueSource('propagation_duration_days')}
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
                {getCropValue('distance_within_row_cm', selectedCulture.distance_within_row_cm) !== null && getCropValue('distance_within_row_cm', selectedCulture.distance_within_row_cm) !== undefined && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('detail.fields.distanceWithinRow')}
                    </Typography>
                    <Typography variant="body1">
                      {formatDistance(getCropValue('distance_within_row_cm', selectedCulture.distance_within_row_cm), t, locale)} {t('detail.units.centimeters')}
                    </Typography>
                    {renderValueSource('distance_within_row_cm')}
                  </Box>
                )}
                {getCropValue('row_spacing_cm', selectedCulture.row_spacing_cm) !== null && getCropValue('row_spacing_cm', selectedCulture.row_spacing_cm) !== undefined && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('detail.fields.rowSpacing')}
                    </Typography>
                    <Typography variant="body1">
                      {formatDistance(getCropValue('row_spacing_cm', selectedCulture.row_spacing_cm), t, locale)} {t('detail.units.centimeters')}
                    </Typography>
                    {renderValueSource('row_spacing_cm')}
                  </Box>
                )}
                {getCropValue('sowing_depth_cm', selectedCulture.sowing_depth_cm) !== null && getCropValue('sowing_depth_cm', selectedCulture.sowing_depth_cm) !== undefined && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('detail.fields.sowingDepth')}
                    </Typography>
                    <Typography variant="body1">
                      {formatDistance(getCropValue('sowing_depth_cm', selectedCulture.sowing_depth_cm), t, locale, 1)} {t('detail.units.centimeters')}
                    </Typography>
                    {renderValueSource('sowing_depth_cm')}
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
              <CultureSeedDetails
                activeCultivationTypes={activeCultivationTypes}
                seedRateRows={seedRateRows}
                sowingSafetyPercent={getCropValue('sowing_calculation_safety_percent', selectedCulture.sowing_calculation_safety_percent)}
                sowingSafetySource={getCropValueSource('sowing_calculation_safety_percent')}
                seedingRequirement={getCropValue('seeding_requirement', selectedCulture.seeding_requirement)}
                seedingRequirementSource={getCropValueSource('seeding_requirement')}
                seedingRequirementType={getCropValue('seeding_requirement_type', selectedCulture.seeding_requirement_type)}
                seedingRequirementTypeSource={getCropValueSource('seeding_requirement_type')}
                thousandKernelWeightG={getCropValue('thousand_kernel_weight_g', selectedCulture.thousand_kernel_weight_g)}
                thousandKernelWeightSource={getCropValueSource('thousand_kernel_weight_g')}
                emptyValueLabel={t('noData')}
                locale={locale}
                t={t}
              />
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
                {getCropValue('harvest_method', selectedCulture.harvest_method) && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('form.yieldUnit')}
                    </Typography>
                    <Typography variant="body1">
                      {getCropValue('harvest_method', selectedCulture.harvest_method) === 'per_plant' ? t('form.yieldUnitPerPlant') : t('form.yieldUnitPerSqm')}
                    </Typography>
                    {renderValueSource('harvest_method')}
                  </Box>
                )}
                {getCropValue('expected_yield', selectedCulture.expected_yield) && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('form.expectedYield')}
                    </Typography>
                    <Typography variant="body1">
                      {formatNumber(getCropValue('expected_yield', selectedCulture.expected_yield), t, locale)} {t('detail.units.kilograms')}
                    </Typography>
                    {renderValueSource('expected_yield')}
                  </Box>
                )}
                {getCropValue('allow_deviation_delivery_weeks', selectedCulture.allow_deviation_delivery_weeks) && (
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
                    {renderValueSource('allow_deviation_delivery_weeks')}
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
          selectedSpeciesViewKey={selectedSpeciesViewKey}
          onSelect={(culture, itemKind, speciesKey) => {
            setSelectedSpeciesViewKey(itemKind === 'species' ? speciesKey : null);
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
