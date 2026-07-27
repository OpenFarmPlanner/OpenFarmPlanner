// Identity helpers for detecting duplicate cultures by name + variety.
// Normalization collapses whitespace and lowercases so that superficial
// differences (extra spaces, casing) do not create distinct identities.

// NUL separator avoids collisions between differently split name/variety pairs
// (e.g. name "a b" + variety "c" vs. name "a" + variety "b c").
const CULTURE_IDENTITY_SEPARATOR = String.fromCharCode(0);

export const normalizeCultureIdentityValue = (value: string | undefined | null): string | null => {
  if (!value) {
    return null;
  }
  const normalized = value.split(/\s+/).filter(Boolean).join(' ').toLowerCase();
  return normalized || null;
};

export const buildCultureIdentityKey = (
  name: string | undefined | null,
  variety: string | undefined | null,
): string | null => {
  const normalizedName = normalizeCultureIdentityValue(name);
  const normalizedVariety = normalizeCultureIdentityValue(variety);
  if (!normalizedName || !normalizedVariety) {
    return null;
  }
  return `${normalizedName}${CULTURE_IDENTITY_SEPARATOR}${normalizedVariety}`;
};
