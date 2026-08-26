export function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function includesAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

export function isAdvisoryRequest(normalized) {
  return /посовет|что лучше|какую комнат|подбер[еи]|разместиться|хотим размест/.test(
    normalized
  );
}

export function isComplexRequest(normalized) {
  if (!normalized) return false;
  if (normalized.length > 140) return true;
  return isAdvisoryRequest(normalized);
}
