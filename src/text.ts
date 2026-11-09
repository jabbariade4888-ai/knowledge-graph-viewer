export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character] ?? character)
}

export function shortText(value: string, limit = 180): string {
  const flat = value.replace(/\s+/g, ' ').trim()
  if (flat.length <= limit) return flat
  return `${flat.slice(0, limit - 1).trimEnd()}…`
}
