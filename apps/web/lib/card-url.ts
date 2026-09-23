export function cardTokenFromUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return /^\/card\/([A-Za-z0-9_-]{43})\/?$/.exec(url.pathname)?.[1] ?? null;
  } catch { return null; }
}
