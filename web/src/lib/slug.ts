export function slugify(input: string): string {
  if (!input) return ''
  // Normalize, remove diacritics, lowercase, trim
  const base = input
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

  // Replace non-alphanumeric with hyphens, collapse repeats, trim hyphens
  return base
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function unslugify(slug: string): string {
  if (!slug) return ''
  try {
    const s = decodeURIComponent(slug)
    return s.replace(/-/g, ' ').trim()
  } catch {
    return slug.replace(/-/g, ' ').trim()
  }
}
