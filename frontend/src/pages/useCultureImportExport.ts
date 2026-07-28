import { useState, useCallback, type ChangeEvent } from 'react';
import { cultureAPI, type Culture } from '../api/api';
import { useTranslation } from '../i18n';
import {
  buildAllCulturesExport,
  buildAllCulturesFilename,
  buildSingleCultureExport,
  buildSingleCultureFilename,
  downloadJsonFile,
} from '../cultures/exportUtils';
import { exportCulturesToSpreadsheet, buildSpreadsheetFilename, type SpreadsheetExportFormat } from '../cultures/spreadsheetExport';
import { parseSpreadsheetFile } from '../cultures/spreadsheetImport';
import { buildImportSuccessMessage, mapImportErrors } from './culturesPageUtils';
import { analyzeCultureImportJson, readFileAsText } from './culturesImportUtils';
import { useCultureImportState } from './useCultureImportState';

export type ExportFormat = SpreadsheetExportFormat | 'json';
export type ExportScope = 'current' | 'all';

interface UseCultureImportExportConfig {
  selectedCulture: Culture | undefined;
  fetchCultures: () => Promise<void>;
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info') => void;
}

export function useCultureImportExport({
  selectedCulture,
  fetchCultures,
  showSnackbar,
}: UseCultureImportExportConfig) {
  const { t } = useTranslation(['cultures', 'common']);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importStartDialogOpen, setImportStartDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [confirmUpdates, setConfirmUpdates] = useState(false);

  const {
    state: importState,
    hasImportableEntries,
    reset: resetImportState,
    setErrorState: setImportErrorState,
    setPreviewReadyState,
    setUploading: setImportUploading,
    setPartialFailure: setImportPartialFailure,
    setSuccessState: setImportSuccessState,
  } = useCultureImportState();

  const handleImportFileTrigger = useCallback(() => {
    resetImportState();
    setImportStartDialogOpen(true);
  }, [resetImportState]);

  const handleImportFileSelected = useCallback(async (file: File) => {
    setImportStartDialogOpen(false);
    resetImportState();

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isSpreadsheet = ['xlsx', 'ods', 'csv'].includes(ext);

    if (isSpreadsheet) {
      try {
        const { entries, skippedRows, warnings } = await parseSpreadsheetFile(file);

        if (entries.length === 0) {
          const warningText = warnings.length > 0 ? warnings.join(' ') : t('import.errors.noValidEntries');
          setImportErrorState({ error: warningText, previewCount: skippedRows, validCount: 0, invalidEntries: [] });
          setImportDialogOpen(true);
          return;
        }

        setImportUploading();
        try {
          const response = await cultureAPI.importPreview(entries);
          const invalidEntries: string[] = [];
          if (skippedRows > 0) invalidEntries.push(t('import.skippedRows', { count: skippedRows }));
          warnings.forEach((w) => invalidEntries.push(w));
          setPreviewReadyState({
            previewCount: entries.length + skippedRows,
            validCount: entries.length,
            invalidEntries,
            payload: entries,
            previewResults: response.data.results,
          });
          setImportDialogOpen(true);
        } catch (error) {
          console.error('Error calling preview endpoint:', error);
          setImportErrorState({ error: t('import.errors.network') });
          setImportDialogOpen(true);
        }
      } catch (error) {
        console.error('Error parsing spreadsheet file:', error);
        setImportErrorState({ error: t('import.errors.parse') });
        setImportDialogOpen(true);
      }
      return;
    }

    if (ext === 'json') {
      try {
        const jsonString = await readFileAsText(file);
        const importAnalysis = analyzeCultureImportJson(jsonString, t);

        if (importAnalysis.status === 'error') {
          setImportErrorState({
            error: t(importAnalysis.errorKey),
            previewCount: importAnalysis.originalCount,
            validCount: 0,
            invalidEntries: importAnalysis.invalidEntries,
          });
          setImportDialogOpen(true);
          return;
        }

        setImportUploading();
        try {
          const response = await cultureAPI.importPreview(importAnalysis.validEntries);
          setPreviewReadyState({
            previewCount: importAnalysis.originalCount,
            validCount: importAnalysis.validEntries.length,
            invalidEntries: importAnalysis.invalidEntries,
            payload: importAnalysis.validEntries,
            previewResults: response.data.results,
          });
          setImportDialogOpen(true);
        } catch (error) {
          console.error('Error calling preview endpoint:', error);
          setImportErrorState({ error: t('import.errors.network') });
          setImportDialogOpen(true);
        }
      } catch (error) {
        console.error('Error reading JSON file:', error);
        setImportErrorState({ error: t('import.errors.parse') });
        setImportDialogOpen(true);
      }
      return;
    }

    setImportErrorState({ error: t('import.errors.unsupportedFormat') });
    setImportDialogOpen(true);
  }, [resetImportState, t, setImportErrorState, setImportUploading, setPreviewReadyState]);

  const handleOpenExportDialog = useCallback(() => {
    setExportDialogOpen(true);
  }, []);

  // Called by the command palette (expects separate current/all handlers)
  const handleExportCurrentCulture = handleOpenExportDialog;
  const handleExportAllCultures = handleOpenExportDialog;

  const handleExport = useCallback(async (scope: ExportScope, format: ExportFormat) => {
    try {
      if (format === 'json') {
        if (scope === 'current' && selectedCulture) {
          const exportPayload = buildSingleCultureExport(selectedCulture);
          const filename = buildSingleCultureFilename(selectedCulture);
          downloadJsonFile(exportPayload, filename);
        } else {
          const { results: allCultures } = await cultureAPI.listAll();
          const exportPayload = buildAllCulturesExport(allCultures);
          const filename = buildAllCulturesFilename();
          downloadJsonFile(exportPayload, filename);
        }
      } else {
        const culturesToExport: Culture[] = scope === 'current' && selectedCulture
          ? [selectedCulture]
          : (await cultureAPI.listAll()).results;
        const filename = buildSpreadsheetFilename(format, scope === 'current' ? 'single' : 'all', selectedCulture ?? undefined);
        exportCulturesToSpreadsheet(culturesToExport, format, filename, t);
      }
      showSnackbar(t('export.success'), 'success');
    } catch (error) {
      console.error('Error exporting cultures:', error);
      showSnackbar(t('messages.fetchError'), 'error');
    }
  }, [selectedCulture, showSnackbar, t]);

  const handleImportStart = async () => {
    if (!hasImportableEntries || importState.status === 'uploading') return;

    setImportUploading();

    try {
      const response = await cultureAPI.importApply({
        items: importState.payload,
        confirm_updates: confirmUpdates,
      });

      const { created_count, updated_count, skipped_count, errors } = response.data;

      if (errors.length > 0) {
        setImportPartialFailure({
          failedEntries: mapImportErrors(errors, importState.payload),
          error: t('import.errors.someFailures', { failed: errors.length }),
        });
        return;
      }

      const successMessage = buildImportSuccessMessage(created_count, updated_count, skipped_count, t);
      setImportSuccessState(successMessage || t('import.success'));
      await fetchCultures();
    } catch (error) {
      console.error('Error importing cultures:', error);
      setImportErrorState({ error: t('import.errors.network') });
    }
  };

  const handleImportDialogClose = () => {
    setImportDialogOpen(false);
  };

  // Legacy: kept for compatibility with hidden <input> path (unused when dialogs are active)
  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await handleImportFileSelected(file);
  };

  return {
    importDialogOpen,
    importStartDialogOpen,
    exportDialogOpen,
    confirmUpdates,
    setConfirmUpdates,
    importState,
    hasImportableEntries,
    handleImportFileTrigger,
    handleImportFileSelected,
    handleImportFileChange,
    handleOpenExportDialog,
    handleExportCurrentCulture,
    handleExportAllCultures,
    handleExport,
    handleImportStart,
    handleImportDialogClose,
    setImportStartDialogOpen,
    setExportDialogOpen,
  };
}
