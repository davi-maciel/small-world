export function normalizeName(rawName: string): {
  displayName: string;
  searchKey: string;
  slug: string;
} {
  // Trim and collapse whitespace
  const cleaned = rawName.trim().replace(/\s+/g, " ");

  // NFC normalization for display name (preserves diacritics)
  const displayName = cleaned.normalize("NFC");

  // NFD + strip combining marks for searchKey/slug
  const stripped = cleaned
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const searchKey = stripped.toLowerCase();

  const slug = searchKey
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-");

  return { displayName, searchKey, slug };
}
