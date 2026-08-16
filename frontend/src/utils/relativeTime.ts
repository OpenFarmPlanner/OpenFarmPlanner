/**
 * "vor 2 Tagen" / "2 days ago" from a timestamp.
 *
 * Built on `Intl.RelativeTimeFormat` rather than on translated strings on
 * purpose: the wording, the plural rules and the "vor" vs. "ago" word order
 * all differ per language, and the platform already knows them for every
 * locale the app supports.
 */

const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: 60 * 60 * 24 * 365 },
  { unit: 'month', seconds: 60 * 60 * 24 * 30 },
  { unit: 'week', seconds: 60 * 60 * 24 * 7 },
  { unit: 'day', seconds: 60 * 60 * 24 },
  { unit: 'hour', seconds: 60 * 60 },
  { unit: 'minute', seconds: 60 },
];

export function formatRelativeTime(
  timestamp: string | Date,
  language: string,
  now: Date = new Date(),
): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const elapsedSeconds = (date.getTime() - now.getTime()) / 1000;
  for (const { unit, seconds } of UNITS) {
    if (Math.abs(elapsedSeconds) >= seconds) {
      // `numeric: 'always'` keeps the count visible ("vor 2 Tagen"); 'auto'
      // would collapse it into words like "vorgestern", which stops being
      // readable exactly where a list mixes several ages.
      return new Intl.RelativeTimeFormat(language, { numeric: 'always' }).format(
        Math.round(elapsedSeconds / seconds),
        unit,
      );
    }
  }
  // Under a minute the count carries no information, so "jetzt" beats
  // "vor 0 Sekunden" — that is what 'auto' produces for second = 0.
  return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(0, 'second');
}
