import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type TouchEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  Link,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { bedAPI, cultureAPI, fieldAPI, locationAPI, plantingPlanAPI, seedDemandAPI } from '../api/api';
import type { SeedDemand } from '../api/types';
import { useTranslation } from '../i18n';
import { ContextMenuActionItem } from '../components/contextMenu/ContextMenuActionItem';
import { ContextMenuIndicator } from '../components/contextMenu/ContextMenuIndicator';
import { contextMenuActionsOverlaySx } from '../components/contextMenu/contextMenuIndicatorStyles';
import { CustomContextMenu } from '../components/contextMenu/CustomContextMenu';
import { useRowContextMenuState } from '../components/contextMenu/useRowContextMenuState';
import { ROW_LONG_PRESS_MS, useLongPressTimer } from '../components/contextMenu/useLongPressTimer';
import { useCommandContextTag } from '../commands/useCommandContext';
import PageContainer from '../components/layout/PageContainer';
import PageSurface from '../components/layout/PageSurface';
import TableSurface from '../components/layout/TableSurface';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import EmptyStateCard from '../components/project/EmptyStateCard';
import { ContextMenuHint, FullCellTooltip, TableCopyMenuItems, useContextMenuHint } from '../components/data-grid';
import { handleContextMenuKeyboardNavigation } from '../components/data-grid/contextMenuFocus';
import { getFirstMissingProjectSetupStep, getTranslatedProjectSetupActions } from './requirementFlow';
import { closestContextMenuElement, shouldOpenCustomContextMenu, suppressNativeContextMenu } from '../utils/contextMenu';
import { TypeaheadSelect as Select } from '../components/inputs/TypeaheadSelect';
import {
  getPackageBlockerTooltip,
  getPackageCellState,
  getRequiredAmountDiagnostic,
  hasPackageCellTooltip,
} from './seedDemandDiagnostics';
import {
  formatPackageSelection,
  formatRequiredSeedAmount,
  formatUnit,
} from './seedDemandFormat';

export default function SeedDemandPage() {
  useCommandContextTag('seedDemand');
  const { t } = useTranslation(['cultures', 'common']);
  const navigate = useNavigate();
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  const [rows, setRows] = useState<SeedDemand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cultureCount, setCultureCount] = useState(0);
  const [planCount, setPlanCount] = useState(0);
  const [hasCulturesWithSeedData, setHasCulturesWithSeedData] = useState(false);
  const [locationCount, setLocationCount] = useState(0);
  const [fieldCount, setFieldCount] = useState(0);
  const [bedCount, setBedCount] = useState(0);
  const hasPlans = planCount > 0;
  const hasSeedData = hasCulturesWithSeedData;
  const canCalculateSeedDemand = locationCount > 0 && fieldCount > 0 && bedCount > 0 && cultureCount > 0 && hasPlans && hasSeedData;
  const {
    showContextMenuHint,
    closeContextMenuHint,
    markContextMenuHintUsed,
    showTouchContextMenuHint,
    closeTouchContextMenuHint,
    markTouchContextMenuHintUsed,
  } = useContextMenuHint({
    contextKey: 'seedDemand',
    enabled: !shouldShowProjectRequiredState && canCalculateSeedDemand,
    isLoading,
    hasRows: rows.length > 0,
  });
  const rowLongPressTimer = useLongPressTimer(ROW_LONG_PRESS_MS);
  const firstMissingSetupStep = getFirstMissingProjectSetupStep({
    hasFields: fieldCount > 0,
    hasBeds: bedCount > 0,
    hasCultures: cultureCount > 0,
    hasPlans,
  });
  const missingRequirement = useMemo(() => {
    if (firstMissingSetupStep === 'fields') {
      return {
        title: t('seedDemand.progressive.fields.title'),
        description: t('seedDemand.progressive.fields.description'),
        actions: getTranslatedProjectSetupActions(firstMissingSetupStep, t),
      };
    }
    if (firstMissingSetupStep === 'beds') {
      return {
        title: t('seedDemand.progressive.beds.title'),
        description: t('seedDemand.progressive.beds.description'),
        actions: getTranslatedProjectSetupActions(firstMissingSetupStep, t),
      };
    }
    if (firstMissingSetupStep === 'cultures') {
      return {
        title: t('seedDemand.progressive.cultures.title'),
        description: t('seedDemand.progressive.cultures.description'),
        actions: getTranslatedProjectSetupActions(firstMissingSetupStep, t),
      };
    }
    if (firstMissingSetupStep === 'plans') {
      return {
        title: t('seedDemand.progressive.plans.title'),
        description: t('seedDemand.progressive.plans.description'),
        actions: getTranslatedProjectSetupActions(firstMissingSetupStep, t),
      };
    }
    if (!hasSeedData) {
      return {
        title: t('seedDemand.progressive.seedData.title'),
        description: (
          <>
            <Typography variant="body2">{t('seedDemand.progressive.seedData.description')}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {t('seedDemand.progressive.seedData.hint')}
            </Typography>
          </>
        ),
        actions: [{ label: t('seedDemand.progressive.seedData.action'), to: '/app/cultures' }],
      };
    }
    return null;
  }, [firstMissingSetupStep, hasSeedData, t]);

  const loadRows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await seedDemandAPI.list();
      setRows(response.data.results ?? []);
      const [culturesResponse, plansResponse, locationsResponse, fieldsResponse, bedsResponse] = await Promise.all([
        cultureAPI.list(),
        plantingPlanAPI.list(),
        locationAPI.list(),
        fieldAPI.list(),
        bedAPI.list(),
      ]);
      const cultures = culturesResponse.data.results;
      setCultureCount(cultures.length);
      setPlanCount(plansResponse.data.results.length);
      setLocationCount(locationsResponse.data.results.length);
      setFieldCount(fieldsResponse.data.results.length);
      setBedCount(bedsResponse.data.results.length);
      setHasCulturesWithSeedData(cultures.some((culture) => (
        culture.seed_rate_value !== null
        || culture.seed_rate_direct_value !== null
        || culture.seed_rate_pre_cultivation_value !== null
      )));
    } catch {
      setError(t('seedDemand.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupplierChange = async (cultureId: number, supplierId: number | null) => {
    setIsLoading(true);
    setError(null);
    try {
      await seedDemandAPI.saveSupplierSelection(cultureId, supplierId);
      await loadRows();
    } catch {
      setError(t('seedDemand.saveError'));
      setIsLoading(false);
    }
  };

  const getCultureLabel = useCallback((row: SeedDemand): string => (
    row.variety ? `${row.culture_name} (${row.variety})` : row.culture_name
  ), []);

  const getSupplierLabel = useCallback((row: SeedDemand): string => {
    const supplierOptions = row.supplier_options ?? [];
    if (supplierOptions.length === 0) {
      return t('seedDemand.noSupplierAvailable');
    }
    const selectedSupplier = supplierOptions.find((option) => option.supplier_id === row.selected_supplier_id);
    if (selectedSupplier) {
      return selectedSupplier.supplier_name;
    }
    if (supplierOptions.length > 1) {
      return t('seedDemand.selectSupplier');
    }
    return supplierOptions[0]?.supplier_name ?? row.supplier ?? '';
  }, [t]);

  const getRequiredAmountLabel = useCallback((row: SeedDemand): string => {
    const diagnostic = getRequiredAmountDiagnostic(row, t);
    if (diagnostic) {
      return diagnostic.displayText;
    }
    if (row.required_amount_value === null) {
      return t('seedDemand.requiredAmountUnavailable', {
        reason: t('seedDemand.calculationBlockers.missingData'),
      });
    }
    return `${formatRequiredSeedAmount(row.required_amount_value)} ${formatUnit('g', t)}`;
  }, [t]);

  const renderRequiredAmountCell = useCallback((row: SeedDemand) => {
    const diagnostic = getRequiredAmountDiagnostic(row, t);
    if (!diagnostic) {
      return <Typography variant="body2">{getRequiredAmountLabel(row)}</Typography>;
    }

    return (
      <FullCellTooltip
        title={diagnostic.tooltipText}
        describeChild
        focusable
        triggerSx={{ px: 2, justifyContent: 'flex-end' }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          noWrap
          sx={{ minWidth: 0, maxWidth: '100%' }}
        >
          {diagnostic.displayText}
        </Typography>
      </FullCellTooltip>
    );
  }, [getRequiredAmountLabel, t]);

  const getPackageLabel = useCallback((row: SeedDemand): string => {
    switch (getPackageCellState(row)) {
      case 'computed':
        return formatPackageSelection(row, t);
      case 'chooseSupplier':
      case 'unavailableRequirement':
        return '—';
      case 'notConfigured':
        return t('seedDemand.noPackagesAvailable');
      case 'calculationError':
      default:
        return t('seedDemand.noPackageCalculationPossible');
    }
  }, [t]);

  const renderPackageCell = useCallback((row: SeedDemand) => {
    const editHref = `/app/cultures?cultureId=${row.culture_id}&action=edit`;
    const state = getPackageCellState(row);
    const tooltip = getPackageBlockerTooltip(row, t);

    switch (state) {
      case 'computed':
        return <Typography variant="body2">{formatPackageSelection(row, t)}</Typography>;
      case 'chooseSupplier':
        return (
          <FullCellTooltip title={tooltip} describeChild focusable triggerSx={{ px: 2 }}>
            <Typography variant="body2" color="text.secondary">—</Typography>
          </FullCellTooltip>
        );
      case 'unavailableRequirement':
        return (
          <FullCellTooltip title={tooltip} describeChild focusable triggerSx={{ px: 2 }}>
            <Typography variant="body2" color="text.secondary">—</Typography>
          </FullCellTooltip>
        );
      case 'notConfigured':
        return (
          <FullCellTooltip title={tooltip} describeChild triggerSx={{ px: 2 }}>
            <Link
              component={RouterLink}
              to={editHref}
              underline="hover"
              variant="body2"
              color="textSecondary"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              <Inventory2OutlinedIcon fontSize="inherit" />
              {t('seedDemand.noPackagesAvailable')}
            </Link>
          </FullCellTooltip>
        );
      case 'calculationError':
      default:
        return (
          <FullCellTooltip title={tooltip} describeChild focusable triggerSx={{ px: 2 }}>
            <Typography
              variant="body2"
              color="warning.main"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              <WarningAmberOutlinedIcon fontSize="inherit" />
              {t('seedDemand.noPackageCalculationPossible')}
            </Typography>
          </FullCellTooltip>
        );
    }
  }, [t]);

  const getRowClipboardValues = useCallback((row: SeedDemand): string[] => [
    getCultureLabel(row),
    getSupplierLabel(row),
    getRequiredAmountLabel(row),
    getPackageLabel(row),
  ], [getCultureLabel, getPackageLabel, getRequiredAmountLabel, getSupplierLabel]);

  const getTableClipboardRows = useCallback((): string[][] => [
    [
      t('seedDemand.columns.culture'),
      t('seedDemand.columns.supplier'),
      t('seedDemand.columns.requiredAmount'),
      t('seedDemand.columns.packages'),
    ],
    ...rows.map(getRowClipboardValues),
  ], [getRowClipboardValues, rows, t]);

  const isSeedDemandContextMenuTarget = useCallback((target: EventTarget | null): boolean => (
    shouldOpenCustomContextMenu(target) &&
    closestContextMenuElement(target, 'tr[data-seed-demand-culture-id]') !== null
  ), []);
  const {
    state: contextMenuState,
    listRef: contextMenuListRef,
    open: openContextMenuState,
    close: closeContextMenu,
  } = useRowContextMenuState<SeedDemand>({ isContextMenuTarget: isSeedDemandContextMenuTarget });

  const openContextMenu = useCallback((
    event: MouseEvent<HTMLTableRowElement>,
    row: SeedDemand,
  ): void => {
    if (!isSeedDemandContextMenuTarget(event.target)) {
      return;
    }
    suppressNativeContextMenu(event);
    markContextMenuHintUsed();
    openContextMenuState(row, event.clientX + 2, event.clientY - 6, event.currentTarget);
  }, [isSeedDemandContextMenuTarget, markContextMenuHintUsed, openContextMenuState]);

  const handleRowTouchStart = useCallback((
    event: TouchEvent<HTMLTableRowElement>,
    row: SeedDemand,
  ): void => {
    if (event.touches.length !== 1 || !isSeedDemandContextMenuTarget(event.target)) {
      return;
    }
    const touch = event.touches[0];
    const originElement = event.currentTarget;
    rowLongPressTimer.start(() => {
      markTouchContextMenuHintUsed();
      openContextMenuState(row, touch.clientX + 2, touch.clientY - 6, originElement);
    });
  }, [isSeedDemandContextMenuTarget, markTouchContextMenuHintUsed, openContextMenuState, rowLongPressTimer]);

  const handleRowTouchMove = useCallback((): void => {
    rowLongPressTimer.clear();
  }, [rowLongPressTimer]);

  // Suppresses the trailing click after a long press fired, so it doesn't
  // also run whatever tap behavior the row's interactive contents have
  // (culture link, supplier select) right on top of the context menu the
  // long press just opened.
  const handleRowTouchEnd = useCallback((event: TouchEvent<HTMLTableRowElement>): void => {
    rowLongPressTimer.endTouch(event);
  }, [rowLongPressTimer]);

  const openKeyboardContextMenu = useCallback((
    event: KeyboardEvent<HTMLTableRowElement>,
    row: SeedDemand,
  ): void => {
    const shouldOpenContextMenu = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
    if (!shouldOpenContextMenu) {
      return;
    }

    suppressNativeContextMenu(event);
    markContextMenuHintUsed();
    const rowRect = event.currentTarget.getBoundingClientRect();
    openContextMenuState(
      row,
      rowRect.left + Math.min(240, rowRect.width),
      rowRect.top + 12,
      event.currentTarget,
    );
  }, [markContextMenuHintUsed, openContextMenuState]);

  const openInlineActionMenu = useCallback((event: MouseEvent<HTMLButtonElement>, row: SeedDemand): void => {
    event.preventDefault();
    event.stopPropagation();
    markContextMenuHintUsed();
    const rect = event.currentTarget.getBoundingClientRect();
    openContextMenuState(row, rect.right - 8, rect.top + 12, event.currentTarget);
  }, [markContextMenuHintUsed, openContextMenuState]);

  const openCulture = useCallback((row: SeedDemand): void => {
    navigate(`/app/cultures?cultureId=${row.culture_id}`);
  }, [navigate]);

  const editCulture = useCallback((row: SeedDemand): void => {
    navigate(`/app/cultures?cultureId=${row.culture_id}&action=edit`);
  }, [navigate]);

  const handleContextMenuOpenCulture = useCallback((): void => {
    if (!contextMenuState) {
      return;
    }
    const { key: row } = contextMenuState;
    closeContextMenu();
    openCulture(row);
  }, [closeContextMenu, contextMenuState, openCulture]);

  const handleContextMenuEditCulture = useCallback((): void => {
    if (!contextMenuState) {
      return;
    }
    const { key: row } = contextMenuState;
    closeContextMenu();
    editCulture(row);
  }, [closeContextMenu, contextMenuState, editCulture]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      setRows([]);
      setIsLoading(false);
      setError(null);
      setHasCulturesWithSeedData(false);
      setFieldCount(0);
      return;
    }
    void loadRows();
  }, [shouldShowProjectRequiredState]);

  if (shouldShowProjectRequiredState && missingProjectReason) {
    return (
      <PageContainer variant="standardCenteredPage">
        <PageSurface variant="contentFit">
          <ProjectRequiredState reason={missingProjectReason} />
        </PageSurface>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="standardCenteredPage">
      <PageSurface variant="contentFit">

        {isLoading && <CircularProgress />}
        {error && <Alert severity="error">{error}</Alert>}

        {!isLoading && !error && !canCalculateSeedDemand && (
          <EmptyStateCard
            title={missingRequirement?.title ?? t('seedDemand.emptyStates.requirementsTitle')}
            description={missingRequirement?.description ?? t('seedDemand.emptyStates.requirementsDescription')}
            actions={missingRequirement?.actions ?? []}
          />
        )}

        {!isLoading && !error && canCalculateSeedDemand && showContextMenuHint ? (
          <ContextMenuHint
            variant="desktop"
            message={t('common:messages.contextMenuTableHint')}
            onClose={closeContextMenuHint}
            sx={{ mb: 1.25 }}
          />
        ) : null}

        {!isLoading && !error && canCalculateSeedDemand && showTouchContextMenuHint ? (
          <ContextMenuHint
            variant="touch"
            message={t('common:messages.contextMenuTableHintTouch')}
            onClose={closeTouchContextMenuHint}
            sx={{ mb: 1.25 }}
          />
        ) : null}

        {!isLoading && !error && canCalculateSeedDemand && (
          <TableSurface sizingMode="contentFit">
          <TableContainer>
            <Table
              sx={{
                '& .MuiTableCell-root': { py: 1 },
              }}
            >
            <TableHead>
              <TableRow>
                <TableCell>{t('seedDemand.columns.culture')}</TableCell>
                <TableCell>{t('seedDemand.columns.supplier')}</TableCell>
                <TableCell align="right" sx={{ width: 240, maxWidth: 240 }}>
                  {t('seedDemand.columns.requiredAmount')}
                </TableCell>
                <TableCell>{t('seedDemand.columns.packages')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const supplierOptions = row.supplier_options ?? [];
                const supplierCount = supplierOptions.length;
                const supplierOptionValues = new Set(supplierOptions.map((option) => String(option.supplier_id)));
                const selectedSupplierValue = row.selected_supplier_id !== null && row.selected_supplier_id !== undefined
                  ? String(row.selected_supplier_id)
                  : '';
                const selectValue = supplierOptionValues.has(selectedSupplierValue) ? selectedSupplierValue : '';
                const singleSupplierOption = supplierCount === 1 ? supplierOptions[0] : null;
                const singleSupplierValue = singleSupplierOption ? String(singleSupplierOption.supplier_id) : '';

                return (
                  <TableRow
                    key={row.culture_id}
                    data-seed-demand-culture-id={row.culture_id}
                    hover
                    tabIndex={0}
                    onContextMenu={(event) => openContextMenu(event, row)}
                    onKeyDown={(event) => openKeyboardContextMenu(event, row)}
                    onTouchStart={(event) => handleRowTouchStart(event, row)}
                    onTouchMove={handleRowTouchMove}
                    onTouchEnd={handleRowTouchEnd}
                    onTouchCancel={handleRowTouchMove}
                    sx={{
                      WebkitTouchCallout: 'none',
                    }}
                  >
                    <TableCell sx={{ maxWidth: { xs: 180, sm: 240 } }}>
                      <Box
                        sx={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          minWidth: 0,
                          width: '100%',
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            display: 'block',
                            flex: '1 1 auto',
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Link component={RouterLink} to={`/app/cultures?cultureId=${row.culture_id}`} underline="hover">
                            {getCultureLabel(row)}
                          </Link>
                        </Box>
                        <Box
                          className="seed-demand-row-actions"
                          sx={contextMenuActionsOverlaySx('tr:hover &', 'tr:focus-within &')}
                        >
                          <ContextMenuIndicator
                            label={t('common:actions.actions')}
                            onClick={(event) => openInlineActionMenu(event, row)}
                          />
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {supplierCount > 1 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <FormControl size="small" sx={{ minWidth: 220 }}>
                            <Select
                              fullWidth
                              value={selectValue}
                              sx={{
                                '& .MuiSelect-select': { py: 0.75 },
                              }}
                              onChange={(event) => {
                                const selectedValue = String(event.target.value ?? '');
                                void handleSupplierChange(
                                  row.culture_id,
                                  selectedValue ? Number(selectedValue) : null,
                                );
                              }}
                              displayEmpty
                            >
                              {selectValue === '' ? <MenuItem value="">{t('seedDemand.selectSupplier')}</MenuItem> : null}
                              {supplierOptions.map((option) => (
                                <MenuItem key={option.supplier_id} value={String(option.supplier_id)}>
                                  {option.supplier_name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      ) : supplierCount === 1 && singleSupplierOption ? (
                        <FormControl size="small" sx={{ minWidth: 220 }}>
                          <Select
                            fullWidth
                            value={singleSupplierValue}
                            disabled
                            sx={{
                              '& .MuiSelect-select': { py: 0.75 },
                            }}
                          >
                            <MenuItem value={singleSupplierValue}>
                              {singleSupplierOption.supplier_name}
                            </MenuItem>
                          </Select>
                        </FormControl>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {t('seedDemand.noSupplierAvailable')}
                          </Typography>
                          <Link component={RouterLink} to={`/app/cultures?cultureId=${row.culture_id}&action=edit`} underline="hover" variant="caption">
                            {t('seedDemand.editCultureAction')}
                          </Link>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={getRequiredAmountDiagnostic(row, t)
                        ? { position: 'relative', width: 240, maxWidth: 240 }
                        : { width: 240, maxWidth: 240 }}
                    >
                      {renderRequiredAmountCell(row)}
                    </TableCell>
                    <TableCell sx={hasPackageCellTooltip(row) ? { position: 'relative' } : undefined}>
                      {renderPackageCell(row)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            </Table>
            {rows.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <EmptyStateCard
                  title={t('seedDemand.emptyStates.noResultsTitle')}
                  description={t('seedDemand.emptyStates.noResultsDescription')}
                />
              </Box>
            ) : null}
          </TableContainer>
          </TableSurface>
        )}
      </PageSurface>

      <CustomContextMenu
        open={contextMenuState !== null}
        onClose={closeContextMenu}
        autoFocus
        disableAutoFocusItem={false}
        listRef={contextMenuListRef}
        onListKeyDown={(event: KeyboardEvent<HTMLUListElement>) => handleContextMenuKeyboardNavigation(event, closeContextMenu)}
        onKeyDown={(event) => handleContextMenuKeyboardNavigation(event, closeContextMenu)}
        mouseX={contextMenuState?.mouseX}
        mouseY={contextMenuState?.mouseY}
      >
        <ContextMenuActionItem
          label={t('seedDemand.contextMenu.openCulture')}
          icon={<OpenInNewIcon fontSize="small" />}
          onClick={handleContextMenuOpenCulture}
        />
        <ContextMenuActionItem
          label={t('seedDemand.contextMenu.editCulture')}
          icon={<EditIcon fontSize="small" />}
          onClick={handleContextMenuEditCulture}
        />
        <TableCopyMenuItems
          rowValues={contextMenuState ? getRowClipboardValues(contextMenuState.key) : null}
          tableRows={getTableClipboardRows()}
          copyRowLabel={t('common:actions.copyRow')}
          copyTableLabel={t('common:actions.copyTable')}
          rowCopiedMessage={t('common:messages.rowCopied')}
          tableCopiedMessage={t('common:messages.tableCopied')}
          copyErrorMessage={t('common:messages.copyError')}
          includeDivider
          onClose={closeContextMenu}
        />
      </CustomContextMenu>
    </PageContainer>
  );
}
