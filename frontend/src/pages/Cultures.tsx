/**
 * Cultures (Kulturen) page component.
 * 
 * Displays crop culture details with searchable dropdown.
 * Includes create and edit functionality for cultures.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Cultures page component
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router';
import { useTranslation } from '../i18n';
import PageContainer from '../components/layout/PageContainer';
import { bedAPI, cultureAPI, fieldAPI, type Culture } from '../api/api';
import type { CultureHistoryEntry } from '../api/types';
import { CultureDetail } from '../cultures/CultureDetail';
import { CultureForm, type FirstVarietyDraft } from '../cultures/CultureForm';
import { PublicCultureLibraryDialog } from '../crops/components/PublicCultureLibraryDialog';
import {
  Box,
  type SxProps,
  type Theme,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useCommandContextTag, useRegisterCommands, useRegisterCreateActions } from '../commands/useCommandContext';
import {
  type SnackbarState,
} from './culturesPageUtils';
import { createCulturesCommandSpecs } from './culturesCommandSpecs';
import { buildCultureSavePayload } from './culturesSaveUtils';
import { type HistoryScope } from './culturesHistoryUtils';
import { useSelectedCultureSync } from './useSelectedCultureSync';
import { useAuth } from '../auth/useAuth';
import { usePublicCultureLibrary } from './usePublicCultureLibrary';
import { useCultureDelete } from './useCultureDelete';
import { useCultureImportExport } from './useCultureImportExport';
import { CulturesImportDialog } from './CulturesImportDialog';
import { CulturesImportStartDialog } from './CulturesImportStartDialog';
import { CulturesExportDialog } from './CulturesExportDialog';
import { CulturesPublishingWizardDialog } from './CulturesPublishingWizardDialog';
import { CulturesHistoryDialog } from './CulturesHistoryDialog';
import { AlertSnackbar } from '../components/feedback/AlertSnackbar';
import { ConfirmationDialog } from '../components/feedback/ConfirmationDialog';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import EmptyStateCard from '../components/project/EmptyStateCard';
import { getFirstMissingCultivationPlanRequirement, getTranslatedProjectSetupAction } from './requirementFlow';
import type { RootLayoutOutletContext, TopbarContextAction } from '../navigation/topbarTypes';
import { useTopbarContextActions } from '../hooks/useTopbarContextActions';
import {
  DeleteUndoSnackbar,
} from '../components/data-grid';
import { getCultureDisplayName } from '../cultures/cultureDisplay';
import { buildVarietyInheritanceBaseline } from '../cultures/varietyValueSource';

// Stable identity so the memos downstream do not see a new array on every
// render while no project is selected.
const EMPTY_CULTURES: Culture[] = [];

const PLANTING_PLAN_REQUIREMENT_EMPTY_STATE_CONTAINER_SX: SxProps<Theme> = {
  backgroundColor: 'rgba(76, 175, 80, 0.06)',
  borderLeft: '3px solid',
  borderLeftColor: 'success.main',
  py: 1.25,
  px: 1.5,
};

const PLANTING_PLAN_REQUIREMENT_EMPTY_STATE_TITLE_SX: SxProps<Theme> = {
  fontWeight: 500,
};

function Cultures() {
  const { t } = useTranslation(['cultures', 'common']);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const outletContext = useOutletContext<RootLayoutOutletContext | null>();
  const setTopbarContextActions = outletContext?.setTopbarContextActions;
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  const { selectedCultureId, updateSelectedCultureId } = useSelectedCultureSync();
  const fallbackHistoryActorLabel = user?.display_label || user?.display_name || user?.email || undefined;

  const [loadedCultures, setCultures] = useState<Culture[]>([]);
  const [isFetchingCultures, setIsCulturesLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCulture, setEditingCulture] = useState<Culture | undefined>(undefined);
  const [cultureFormKind, setCultureFormKind] = useState<'crop' | 'variety'>('crop');
  const [initialFormDraft, setInitialFormDraft] = useState<Partial<Culture> | undefined>(undefined);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'success' });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<CultureHistoryEntry[]>([]);
  const [historyScope, setHistoryScope] = useState<HistoryScope>('culture');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);
  const [hasFieldsLoaded, setHasFields] = useState(false);
  const [hasBedsLoaded, setHasBeds] = useState(false);

  // Without a project nothing is fetched, so the page reports an empty,
  // settled state. Derived during render rather than pushed into state from
  // the load effect below — that reset is what react-hooks/set-state-in-effect
  // flags, and deriving also avoids the extra render pass it caused.
  const cultures = shouldShowProjectRequiredState ? EMPTY_CULTURES : loadedCultures;
  const isCulturesLoading = shouldShowProjectRequiredState ? false : isFetchingCultures;
  const hasFields = shouldShowProjectRequiredState ? false : hasFieldsLoaded;
  const hasBeds = shouldShowProjectRequiredState ? false : hasBedsLoaded;

  const selectedCulture = cultures.find((culture) => culture.id === selectedCultureId);

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const {
    deleteDialogCulture,
    setDeleteDialogCulture,
    pendingCultureDeletions,
    handleDelete,
    handleDeleteConfirm,
    undoPendingCultureDeletion,
    closePendingCultureDeletionSnackbar,
  } = useCultureDelete({
    cultures,
    setCultures,
    selectedCultureId,
    updateSelectedCultureId,
    showSnackbar,
  });

  const replaceSavedCulture = useCallback((savedCulture: Culture): void => {
    setCultures((currentCultures) => {
      const savedCultureId = savedCulture.id;
      if (savedCultureId === undefined) {
        return currentCultures;
      }

      const cultureExists = currentCultures.some((culture) => culture.id === savedCultureId);
      if (!cultureExists) {
        return [...currentCultures, savedCulture];
      }

      return currentCultures.map((culture) => (
        culture.id === savedCultureId ? savedCulture : culture
      ));
    });
  }, []);

  const fetchCultures = useCallback(async (preservedCulture?: Culture) => {
    setIsCulturesLoading(true);
    try {
      const response = await cultureAPI.list();
      const fetchedCultures = response.data.results;
      if (!preservedCulture?.id) {
        setCultures(fetchedCultures);
        return;
      }

      const preservedCultureId = preservedCulture.id;
      const fetchedCultureIds = new Set(fetchedCultures.map((culture) => culture.id));
      const nextCultures = fetchedCultures.map((culture) => (
        culture.id === preservedCultureId
          ? { ...culture, ...preservedCulture }
          : culture
      ));
      setCultures(
        fetchedCultureIds.has(preservedCultureId)
          ? nextCultures
          : [...nextCultures, preservedCulture],
      );
    } catch (error) {
      console.error('Error fetching cultures:', error);
      showSnackbar(t('messages.fetchError'), 'error');
    } finally {
      setIsCulturesLoading(false);
    }
  }, [showSnackbar, t]);

  const {
    importDialogOpen,
    importStartDialogOpen,
    exportDialogOpen,
    importState,
    hasImportableEntries,
    confirmUpdates,
    setConfirmUpdates,
    handleImportFileTrigger,
    handleImportFileSelected,
    handleExportCurrentCulture,
    handleExportAllCultures,
    handleOpenExportDialog,
    handleExport,
    handleImportStart,
    handleImportDialogClose,
    setImportStartDialogOpen,
    setExportDialogOpen,
  } = useCultureImportExport({
    selectedCulture,
    fetchCultures,
    showSnackbar,
  });

  const onPublicLibraryImportSuccess = useCallback(async (cultureId: number) => {
    await fetchCultures();
    updateSelectedCultureId(cultureId, 'internal');
  }, [fetchCultures, updateSelectedCultureId]);

  const onClearFormForLibrary = useCallback(() => {
    setShowForm(false);
    setEditingCulture(undefined);
  }, []);

  const {
    publicLibraryOpen,
    setPublicLibraryOpen,
    publicLibraryLoading,
    publicLibraryError,
    publicCultures,
    publicLibraryImportingId,
    publicLibraryInitialSelectedId,
    publicLibraryInitialQuery,
    publishingCultureId,
    isUpdatingOwnPublicCulture,
    fetchPublicCultures,
    handleOpenPublicLibrary,
    handleImportPublicCulture,
    handlePublishCurrentCulture,
  } = usePublicCultureLibrary({
    shouldShowProjectRequiredState,
    selectedCulture,
    onImportSuccess: onPublicLibraryImportSuccess,
    onPublicCultureStatusChange: fetchCultures,
    onClearForm: onClearFormForLibrary,
    showSnackbar,
  });

  const [publishWizardOpen, setPublishWizardOpen] = useState(false);

  const handleRequestPublishCulture = useCallback(() => {
    setPublishWizardOpen(true);
  }, []);

  const handlePublishingWizardPublish = useCallback((data: {
    acceptedPublicLibraryTerms: boolean;
    cropSpeciesId?: number;
    originalLanguageCode: string;
    publicCultureId?: number | null;
    publishAsGeneral?: boolean;
  }) => {
    setPublishWizardOpen(false);
    void handlePublishCurrentCulture(data.acceptedPublicLibraryTerms, {
      cropSpeciesId: data.cropSpeciesId,
      originalLanguageCode: data.originalLanguageCode,
      publicCultureId: data.publicCultureId,
      publishAsGeneral: data.publishAsGeneral,
    });
  }, [handlePublishCurrentCulture]);

  // Fetch cultures on mount
  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      return;
    }
    fetchCultures();
  }, [fetchCultures, shouldShowProjectRequiredState]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      return;
    }
    const fetchPlanRequirements = async (): Promise<void> => {
      try {
        const [fieldsResponse, bedsResponse] = await Promise.all([
          fieldAPI.list(),
          bedAPI.list(),
        ]);
        setHasFields(fieldsResponse.data.results.length > 0);
        setHasBeds(bedsResponse.data.results.length > 0);
      } catch {
        setHasFields(false);
        setHasBeds(false);
      }
    };
    void fetchPlanRequirements();
  }, [shouldShowProjectRequiredState]);


  useEffect(() => {
    if (cultures.length === 0) {
      return;
    }

    if (selectedCultureId === undefined && !showForm) {
      const [firstCulture] = cultures;
      if (firstCulture?.id !== undefined) {
        updateSelectedCultureId(firstCulture.id, 'internal');
      }
      return;
    }

    if (selectedCultureId !== undefined && !cultures.some((culture) => culture.id === selectedCultureId)) {
      updateSelectedCultureId(undefined, 'internal');
    }
  }, [cultures, selectedCultureId, showForm, updateSelectedCultureId]);

  const handleCultureSelect = (culture: Culture | null) => {
    updateSelectedCultureId(culture?.id, 'internal');
  };

  // Regular culture selection (sidebar browsing, filters, etc.) replaces the
  // current history entry via useSelectedCultureSync — deliberately, so
  // clicking through many cultures in the sidebar doesn't turn "back" into
  // stepping through each one. Clicking a row in the Varieties comparison
  // table is a more deliberate "go to this variety's page" action, so it
  // should behave like normal navigation: pushing a new history entry means
  // the back button returns to the crop page you navigated from.
  const handleVarietyRowNavigate = useCallback((culture: Culture) => {
    updateSelectedCultureId(culture.id, 'internal', 'push');
  }, [updateSelectedCultureId]);

  const handleAddNew = useCallback(() => {
    setEditingCulture(undefined);
    setCultureFormKind('crop');
    setInitialFormDraft(undefined);
    setShowForm(true);
  }, []);

  const handleAddVariety = useCallback((speciesCulture: Culture) => {
    setEditingCulture(undefined);
    setCultureFormKind('variety');
    setInitialFormDraft({
      ...buildVarietyInheritanceBaseline(speciesCulture),
      crop_species: speciesCulture.crop_species ?? null,
      name: speciesCulture.name,
      variety: '',
    });
    setShowForm(true);
  }, []);

  useEffect(() => {
    if (shouldShowProjectRequiredState || showForm) {
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('create') !== 'true') {
      return;
    }

    handleAddNew();
    searchParams.delete('create');
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [handleAddNew, location.pathname, location.search, navigate, shouldShowProjectRequiredState, showForm]);

  const handleEdit = useCallback((culture: Culture) => {
    setEditingCulture(culture);
    setCultureFormKind((culture.variety || '').trim() ? 'variety' : 'crop');
    setInitialFormDraft(undefined);
    setShowForm(true);
  }, []);

  useEffect(() => {
    if (shouldShowProjectRequiredState || showForm || !selectedCulture) {
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('action') !== 'edit' || searchParams.get('cultureId') !== String(selectedCulture.id)) {
      return;
    }

    handleEdit(selectedCulture);
    searchParams.delete('action');
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [handleEdit, location.pathname, location.search, navigate, selectedCulture, shouldShowProjectRequiredState, showForm]);

  const handleOpenHistory = async () => {
    if (!selectedCulture?.id) {
      return;
    }
    const response = await cultureAPI.history(selectedCulture.id);
    if (response.data.length === 0) {
      showSnackbar(t('history.emptyState.title'), 'info');
      return;
    }
    setHistoryItems(response.data);
    setHistoryScope('culture');
    setHistoryOpen(true);
  };

  const handleRestoreVersion = async (historyId: number) => {
    try {
      if (historyScope === 'project') {
        await cultureAPI.projectRestore(historyId);
      } else if (historyScope === 'global') {
        await cultureAPI.globalRestore(historyId);
      } else {
        if (!selectedCulture?.id) return;
        await cultureAPI.restore(selectedCulture.id, historyId);
      }
      await fetchCultures();
      setHistoryOpen(false);
      showSnackbar(t('messages.restoreSuccess'), 'success');
    } catch {
      showSnackbar(t('messages.restoreError'), 'error');
    }
  };


  const handleSave = async (culture: Culture, firstVariety?: FirstVarietyDraft) => {
    try {
      const savePayload = buildCultureSavePayload(culture);

      let savedCulture: Culture;
      if (editingCulture) {
        const response = await cultureAPI.update(editingCulture.id!, savePayload as Culture);
        savedCulture = response.data;
        showSnackbar(t('messages.updateSuccess'), 'success');
      } else {
        const response = await cultureAPI.create(savePayload as Culture);
        savedCulture = response.data;
        // Auto-select the newly created culture
        updateSelectedCultureId(savedCulture.id, 'internal');

        if (firstVariety) {
          try {
            // Without a library draft the variety inherits the crop's own
            // values; with one it carries the library values and the same
            // source linking an import would produce.
            const varietyPayload = buildCultureSavePayload({
              ...culture,
              ...(firstVariety.draft ?? {}),
              id: undefined,
              name: culture.name,
              crop_species: savedCulture.crop_species ?? culture.crop_species,
              variety: firstVariety.name,
            });
            await cultureAPI.create(varietyPayload as Culture);
            showSnackbar(t('messages.createWithVarietySuccess'), 'success');
          } catch (varietyError) {
            console.error('Error creating initial variety:', varietyError);
            showSnackbar(t('messages.createVarietyPartialError'), 'error');
          }
        } else {
          showSnackbar(t('messages.createSuccess'), 'success');
        }
      }
      replaceSavedCulture(savedCulture);
      setShowForm(false);
      setEditingCulture(undefined);
      setInitialFormDraft(undefined);
      void fetchCultures(savedCulture);
    } catch (error) {
      console.error('Error saving culture:', error);
      throw error; // Re-throw to prevent form from closing
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCulture(undefined);
    setInitialFormDraft(undefined);
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const handleCreatePlantingPlan = useCallback(() => {
    if (selectedCultureId) {
      navigate(`/app/planting-plans?cultureId=${selectedCultureId}`);
    }
  }, [navigate, selectedCultureId]);

  const firstMissingPlanRequirement = getFirstMissingCultivationPlanRequirement({
    hasFields,
    hasBeds,
    hasCultures: cultures.length > 0,
  });
  const firstMissingPlanAction = firstMissingPlanRequirement
    ? getTranslatedProjectSetupAction(firstMissingPlanRequirement, t)
    : null;
  const canCreatePlantingPlan = Boolean(selectedCulture) && firstMissingPlanRequirement === null;
  const planRequirementEmptyState = firstMissingPlanRequirement === 'fields'
    ? {
      title: t('buttons.createPlantingPlanMissingFieldsTitle'),
      description: t('buttons.createPlantingPlanDisabled.fields'),
    }
    : firstMissingPlanRequirement === 'beds'
      ? {
        title: t('buttons.createPlantingPlanMissingBedsTitle'),
        description: t('buttons.createPlantingPlanDisabled.beds'),
      }
      : null;
  useCommandContextTag('cultures');

  const goToRelativeCulture = useCallback((direction: 'next' | 'previous') => {
    if (!selectedCultureId || cultures.length === 0) {
      return;
    }

    const currentIndex = cultures.findIndex((culture) => culture.id === selectedCultureId);
    if (currentIndex === -1) {
      return;
    }

    const delta = direction === 'next' ? 1 : -1;
    const nextIndex = (currentIndex + delta + cultures.length) % cultures.length;
    updateSelectedCultureId(cultures[nextIndex]?.id, 'internal');
  }, [cultures, selectedCultureId, updateSelectedCultureId]);

  const contextActions = useMemo<TopbarContextAction[]>(() => ([
    {
      id: 'cultures-open-library',
      label: t('library.openButton'),
      ariaLabel: t('library.openButton'),
      onClick: () => {
        void handleOpenPublicLibrary();
      },
    },
    {
      id: 'cultures-import',
      label: t('import.menuLabel'),
      ariaLabel: t('import.menuLabel'),
      onClick: handleImportFileTrigger,
      shortcutHint: 'Alt+I',
    },
    {
      id: 'cultures-export',
      label: t('export.menuLabel'),
      ariaLabel: t('export.menuLabel'),
      onClick: handleOpenExportDialog,
      shortcutHint: 'Alt+X',
    },
  ]), [handleImportFileTrigger, handleOpenExportDialog, handleOpenPublicLibrary, t]);

  useTopbarContextActions(setTopbarContextActions, contextActions);

  const createActions = useMemo(() => [
    {
      id: 'create-culture',
      label: t('cultures:buttons.addNew'),
      shortcut: 'Alt+Shift+N',
      handler: handleAddNew,
    },
  ], [handleAddNew, t]);

  useRegisterCreateActions('cultures-page', createActions);

  // `focusSearch` reads searchInputRef.current in its body, and the rule cannot
  // see into the imported spec factory to know the callback is only stored, not
  // invoked, so it assumes the ref could be read during render. The ref is only
  // ever touched when the command runs.
  // eslint-disable-next-line react-hooks/refs
  const commandSpecs = useMemo(() => createCulturesCommandSpecs({
    t,
    cultures,
    focusSearch,
    goToRelativeCulture,
    handleCreatePlantingPlan,
    handleDelete,
    handleEdit,
    handleExportAllCultures,
    handleExportCurrentCulture,
    handleImportFileTrigger,
    selectedCulture,
    selectedCultureId,
  }), [
    cultures,
    focusSearch,
    goToRelativeCulture,
    handleCreatePlantingPlan,
    handleDelete,
    handleEdit,
    handleExportAllCultures,
    handleExportCurrentCulture,
    handleImportFileTrigger,
    selectedCulture,
    selectedCultureId,
    t,
  ]);

  useRegisterCommands('cultures-page', commandSpecs);




  if (shouldShowProjectRequiredState && missingProjectReason) {
    return (
      <PageContainer variant="xwide">
        <ProjectRequiredState reason={missingProjectReason} />
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="xwide">

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <CultureDetail
          cultures={cultures}
          isLoading={isCulturesLoading}
          selectedCultureId={selectedCultureId}
          onCultureSelect={handleCultureSelect}
          onNavigateToVariety={handleVarietyRowNavigate}
          searchInputRef={searchInputRef}
          onCreateCulture={handleAddNew}
          onOpenPublicLibrary={() => {
            void handleOpenPublicLibrary();
          }}
          onEditCulture={handleEdit}
          onAddVariety={handleAddVariety}
          onCreatePlan={handleCreatePlantingPlan}
          onOpenHistory={handleOpenHistory}
          onPublishCulture={handleRequestPublishCulture}
          onPublicUpdateApplied={() => {
            void fetchCultures();
          }}
          onDeleteCulture={handleDelete}
          canCreatePlan={canCreatePlantingPlan}
          isPublishingCulture={Boolean(selectedCulture && publishingCultureId === selectedCulture.id)}
          publishActionLabel={publishingCultureId === selectedCulture?.id
            ? (isUpdatingOwnPublicCulture ? t('library.updating') : t('library.publishing'))
            : (isUpdatingOwnPublicCulture
              ? t('library.updateButton')
              : t('library.publishButton'))}
        />
      </Box>
      {cultures.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {planRequirementEmptyState ? (
            <EmptyStateCard
              title={planRequirementEmptyState.title}
              description={planRequirementEmptyState.description}
              actions={firstMissingPlanAction ? [firstMissingPlanAction] : []}
              containerSx={PLANTING_PLAN_REQUIREMENT_EMPTY_STATE_CONTAINER_SX}
              titleSx={PLANTING_PLAN_REQUIREMENT_EMPTY_STATE_TITLE_SX}
            />
          ) : null}
        </Box>
      )}

      <PublicCultureLibraryDialog
        open={publicLibraryOpen}
        loading={publicLibraryLoading}
        error={publicLibraryError}
        cultures={publicCultures}
        importingId={publicLibraryImportingId}
        initialSelectedId={publicLibraryInitialSelectedId}
        initialQuery={publicLibraryInitialQuery}
        onClose={() => setPublicLibraryOpen(false)}
        onSearch={(query) => {
          void fetchPublicCultures(query);
        }}
        onImport={(culture) => {
          void handleImportPublicCulture(culture);
        }}
      />

      <ConfirmationDialog
        open={Boolean(deleteDialogCulture)}
        fullWidth
        title={t('deleteDialog.title')}
        message={t('deleteDialog.confirmation', { name: deleteDialogCulture ? getCultureDisplayName(deleteDialogCulture) : '' })}
        cancelLabel={t('common:actions.cancel')}
        confirmLabel={t('buttons.delete')}
        onCancel={() => setDeleteDialogCulture(null)}
        onConfirm={handleDeleteConfirm}
        titleSx={{ pb: 1 }}
        contentSx={{ pt: 1 }}
        messageTypographyProps={{ variant: 'body1', color: 'text.secondary' }}
        actionsSx={{ px: 3, pb: 2.5, pt: 1 }}
        cancelButtonProps={{ variant: 'outlined' }}
        confirmButtonProps={{ color: 'error', variant: 'contained' }}
      />

      <CulturesPublishingWizardDialog
        open={publishWizardOpen}
        culture={selectedCulture}
        termsAlreadyAccepted={Boolean(user?.public_library_terms_accepted)}
        publishing={Boolean(selectedCulture && publishingCultureId === selectedCulture.id)}
        onClose={() => setPublishWizardOpen(false)}
        onPublish={handlePublishingWizardPublish}
      />

      {showForm ? (
        <CultureForm
          culture={editingCulture}
          cultures={cultures}
          onSave={handleSave}
          onCancel={handleCancel}
          onSwitchToAddVariety={handleAddVariety}
          formKind={cultureFormKind}
          initialDraft={initialFormDraft}
        />
      ) : null}

      <CulturesImportStartDialog
        open={importStartDialogOpen}
        onClose={() => setImportStartDialogOpen(false)}
        onFileSelected={(file) => void handleImportFileSelected(file)}
        t={t}
      />

      <CulturesImportDialog
        open={importDialogOpen}
        importState={importState}
        hasImportableEntries={hasImportableEntries}
        confirmUpdates={confirmUpdates}
        onConfirmUpdatesChange={setConfirmUpdates}
        onClose={handleImportDialogClose}
        onImportStart={() => void handleImportStart()}
        t={t}
      />

      <CulturesExportDialog
        open={exportDialogOpen}
        hasCurrentCulture={Boolean(selectedCulture)}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
        t={t}
      />

      {/* Snackbar for notifications */}

      <CulturesHistoryDialog
        open={historyOpen}
        scope={historyScope}
        items={historyItems}
        isMobile={isMobile}
        fallbackActorLabel={fallbackHistoryActorLabel}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestoreVersion}
        t={t}
      />



      <AlertSnackbar
        open={snackbar.open}
        autoHideDuration={4200}
        onClose={handleCloseSnackbar}
        message={snackbar.message}
        severity={snackbar.severity}
        variant="filled"
        snackbarSx={{
          '& .MuiAlert-root': {
            borderRadius: 2,
            boxShadow: '0 6px 20px rgba(15, 23, 42, 0.12)',
          },
        }}
        alertSx={{
          width: '100%',
          alignItems: 'center',
          fontWeight: 500,
        }}
      />
      {pendingCultureDeletions.map((deletion, index) => (
        <DeleteUndoSnackbar
          key={deletion.id}
          open={deletion.visible}
          message={t('messages.deleted')}
          undoLabel={t('common:actions.undo')}
          offsetIndex={index}
          testId="culture-delete-snackbar"
          onClose={() => closePendingCultureDeletionSnackbar(deletion.id)}
          onUndo={() => undoPendingCultureDeletion(deletion.id)}
        />
      ))}
    </PageContainer>
  );
}
export default Cultures;
