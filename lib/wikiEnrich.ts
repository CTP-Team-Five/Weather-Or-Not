// Wikipedia REST enrichment for discovery popups. Best-effort — never throw
// into the caller; popups must still render with name + tag if the article
// fetch fails. Cached per article-title in-memory for the session.

const CACHE: Map<string, WikiEnrichment | null> = new Map();

export interface WikiEnrichment {
  title:       string;
  summary?:    string;
  photoUrl?:   string;
}

// Accepts the raw OSM `wikipedia` tag (e.g. "en:Bear Mountain (New York)")
// or a plain article title. Returns null on any failure / empty article.
export async function fetchWikiEnrichment(rawTag: string): Promise<WikiEnrichment | null> {
  const title = parseTitle(rawTag);
  if (!title) return null;
  if (CACHE.has(title)) return CACHE.get(title) ?? null;

  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      CACHE.set(title, null);
      return null;
    }
    const data: any = await res.json();
    const out: WikiEnrichment = {
      title,
      summary:  typeof data.extract === 'string' && data.extract.length > 0 ? data.extract : undefined,
      photoUrl: data.thumbnail?.source || data.originalimage?.source || undefined,
    };
    CACHE.set(title, out);
    return out;
  } catch {
    CACHE.set(title, null);
    return null;
  }
}

function parseTitle(rawTag: string): string | null {
  if (!rawTag) return null;
  // OSM stores either "Article Name" or "lang:Article Name" — strip the lang.
  const colon = rawTag.indexOf(':');
  const title = colon === 2 ? rawTag.slice(colon + 1) : rawTag;  // en:Foo → Foo
  return title.trim().replace(/ /g, '_') || null;
}
