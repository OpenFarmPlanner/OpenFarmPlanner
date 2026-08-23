import type { i18n as I18nInstance } from 'i18next';

/** `de-DE` unless the resolved UI language is anything other than German. */
export function resolveSeasonDateLocale(i18nInstance: I18nInstance): string {
  return i18nInstance.resolvedLanguage === 'de' ? 'de-DE' : 'en-US';
}

export function formatSeasonDate(isoDate: string, locale: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(locale);
}

export function formatSeasonPeriod(startDate: string, endDate: string, locale: string): string {
  return `${formatSeasonDate(startDate, locale)} – ${formatSeasonDate(endDate, locale)}`;
}

/** Mirrors `Season.computed_label` on the backend (see `farm/models/seasons.py`). */
export function computeSeasonLabel(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const isCalendarYear = (
    start.getMonth() === 0 && start.getDate() === 1
    && end.getMonth() === 11 && end.getDate() === 31
    && start.getFullYear() === end.getFullYear()
  );
  if (isCalendarYear) {
    return String(start.getFullYear());
  }
  const startYear = String(start.getFullYear()).slice(-2);
  const endYear = String(end.getFullYear()).slice(-2);
  return `${startYear}/${endYear}`;
}
