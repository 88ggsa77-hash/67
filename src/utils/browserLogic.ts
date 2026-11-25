import type {
  BrowserTab,
  BookmarkItem,
  HistoryEntry,
  SearchEngineId,
} from '../types/browser.ts';

export interface NormalizedTarget {
  type: 'internal' | 'url' | 'search';
  url: string;
  displayUrl: string;
  query?: string;
}

export const SEARCH_ENGINES: Record<
  SearchEngineId,
  { name: string; arName: string; searchUrl: (q: string) => string }
> = {
  duckduckgo: {
    name: 'DuckDuckGo',
    arName: 'دك دك غو',
    searchUrl: (q: string) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
  },
  google: {
    name: 'Google',
    arName: 'جوجل',
    searchUrl: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  },
  wikipedia: {
    name: 'Wikipedia',
    arName: 'ويكيبيديا',
    searchUrl: (q: string) =>
      `https://ar.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`,
  },
  bing: {
    name: 'Bing',
    arName: 'بينج',
    searchUrl: (q: string) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  },
};

export function normalizeInputToTarget(
  rawInput: string,
  _searchEngine: SearchEngineId = 'duckduckgo'
): NormalizedTarget {
  const trimmed = rawInput.trim();

  if (!trimmed || trimmed === 'via://home') {
    return {
      type: 'internal',
      url: 'via://home',
      displayUrl: '',
    };
  }

  if (trimmed.startsWith('via://search?q=')) {
    const query = decodeURIComponent(trimmed.slice('via://search?q='.length));
    return {
      type: 'search',
      url: trimmed,
      displayUrl: query,
      query,
    };
  }

  if (trimmed === 'via://bookmarks' || trimmed === 'via://history' || trimmed === 'via://settings') {
    return {
      type: 'internal',
      url: trimmed,
      displayUrl: trimmed,
    };
  }

  // Reject dangerous schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:')
  ) {
    return {
      type: 'search',
      url: `via://search?q=${encodeURIComponent(trimmed)}`,
      displayUrl: trimmed,
      query: trimmed,
    };
  }

  // Direct http/https URL
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return {
        type: 'url',
        url: parsed.toString(),
        displayUrl: parsed.toString(),
      };
    } catch {
      return {
        type: 'search',
        url: `via://search?q=${encodeURIComponent(trimmed)}`,
        displayUrl: trimmed,
        query: trimmed,
      };
    }
  }

  // Domain-like input without scheme (no spaces, contains a dot with valid TLD >= 2 chars)
  const looksLikeDomain =
    !/\s/.test(trimmed) &&
    /^[a-zA-Z0-9\u0600-\u06FF-]+(\.[a-zA-Z0-9\u0600-\u06FF-]+)+(:\d+)?(\/.*)?$/.test(trimmed);

  if (looksLikeDomain) {
    try {
      const candidate = `https://${trimmed}`;
      const parsed = new URL(candidate);
      return {
        type: 'url',
        url: parsed.toString(),
        displayUrl: parsed.toString(),
      };
    } catch {
      // fall through to search
    }
  }

  return {
    type: 'search',
    url: `via://search?q=${encodeURIComponent(trimmed)}`,
    displayUrl: trimmed,
    query: trimmed,
  };
}

export function extractDomain(url: string): string {
  if (!url || url.startsWith('via://')) {
    return 'فيا ويب';
  }
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 ب';
  if (bytes < 1024) return `${Math.round(bytes)} ب`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} م.ب`;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const cleaned = ip.trim().toLowerCase();
  if (!cleaned) return true;

  // Strip IPv6 zone ID if present
  const withoutZone = cleaned.split('%')[0];

  // IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1
  if (withoutZone.startsWith('::ffff:')) {
    const mapped = withoutZone.slice(7);
    if (mapped.includes('.')) {
      return isPrivateOrReservedIp(mapped);
    }
  }

  // IPv4 check
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(withoutZone);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map((n) => Number(n));
    if (octets.some((o) => o < 0 || o > 255)) return true;
    const [a, b] = octets;

    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 0 && octets[2] === 0) return true; // 192.0.0.0/24
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmark
    if (a >= 224) return true; // multicast & reserved
    return false;
  }

  // IPv6 check
  if (withoutZone === '::' || withoutZone === '::1') return true;
  if (withoutZone.startsWith('fc') || withoutZone.startsWith('fd')) return true; // fc00::/7 ULA
  if (/^fe[89ab][0-9a-f]/i.test(withoutZone)) return true; // fe80::/10 link-local
  if (withoutZone.startsWith('ff')) return true; // multicast

  return false;
}

export function isSafePublicHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!host) return false;

  // Strip brackets around IPv6 literals
  const unwrapped = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

  if (
    unwrapped === 'localhost' ||
    unwrapped.endsWith('.localhost') ||
    unwrapped.endsWith('.local') ||
    unwrapped.endsWith('.internal') ||
    unwrapped.endsWith('.arpa')
  ) {
    return false;
  }

  // If IP literal, validate directly
  if (/^[\d.]+$/.test(unwrapped) || unwrapped.includes(':')) {
    return !isPrivateOrReservedIp(unwrapped);
  }

  // Must contain at least one dot for public domain
  return unwrapped.includes('.');
}

export function createBrowserTab(options: {
  id: string;
  url?: string;
  title?: string;
  isIncognito?: boolean;
}): BrowserTab {
  const initialUrl = options.url ?? 'via://home';
  return {
    id: options.id,
    title: options.title ?? (options.isIncognito ? 'تبويب خفي' : 'الصفحة الرئيسية'),
    url: initialUrl,
    historyStack: [initialUrl],
    historyIndex: 0,
    isLoading: false,
    isIncognito: Boolean(options.isIncognito),
    readerMode: false,
    pageData: null,
    searchData: null,
    error: null,
    scrollY: 0,
  };
}

export function pushTabNavigation(tab: BrowserTab, nextUrl: string, nextTitle?: string): BrowserTab {
  const current = tab.historyStack[tab.historyIndex];
  if (current === nextUrl) {
    return {
      ...tab,
      url: nextUrl,
      title: nextTitle ?? tab.title,
      error: null,
    };
  }
  const truncated = tab.historyStack.slice(0, tab.historyIndex + 1);
  const updatedStack = [...truncated, nextUrl];
  return {
    ...tab,
    url: nextUrl,
    title: nextTitle ?? extractDomain(nextUrl),
    historyStack: updatedStack,
    historyIndex: updatedStack.length - 1,
    error: null,
    readerMode: false,
  };
}

export function canTabGoBack(tab: BrowserTab): boolean {
  return tab.historyIndex > 0;
}

export function canTabGoForward(tab: BrowserTab): boolean {
  return tab.historyIndex < tab.historyStack.length - 1;
}

export function stepTabBack(tab: BrowserTab): BrowserTab {
  if (!canTabGoBack(tab)) return tab;
  const nextIndex = tab.historyIndex - 1;
  const targetUrl = tab.historyStack[nextIndex];
  return {
    ...tab,
    historyIndex: nextIndex,
    url: targetUrl,
    title: targetUrl === 'via://home' ? 'الصفحة الرئيسية' : extractDomain(targetUrl),
    error: null,
  };
}

export function stepTabForward(tab: BrowserTab): BrowserTab {
  if (!canTabGoForward(tab)) return tab;
  const nextIndex = tab.historyIndex + 1;
  const targetUrl = tab.historyStack[nextIndex];
  return {
    ...tab,
    historyIndex: nextIndex,
    url: targetUrl,
    title: targetUrl === 'via://home' ? 'الصفحة الرئيسية' : extractDomain(targetUrl),
    error: null,
  };
}

export function removeTabAndSelectNext(
  tabs: BrowserTab[],
  activeTabId: string,
  targetId: string,
  fallbackIdGenerator: () => string
): { tabs: BrowserTab[]; activeTabId: string } {
  const index = tabs.findIndex((t) => t.id === targetId);
  if (index === -1) {
    return { tabs, activeTabId };
  }
  const remaining = tabs.filter((t) => t.id !== targetId);
  if (remaining.length === 0) {
    const fresh = createBrowserTab({ id: fallbackIdGenerator() });
    return { tabs: [fresh], activeTabId: fresh.id };
  }
  if (activeTabId !== targetId) {
    return { tabs: remaining, activeTabId };
  }
  const nextIndex = Math.min(index, remaining.length - 1);
  return {
    tabs: remaining,
    activeTabId: remaining[nextIndex].id,
  };
}

export function getOmniboxSuggestions(
  query: string,
  bookmarks: BookmarkItem[],
  history: HistoryEntry[],
  limit = 6
): Array<{ title: string; url: string; source: 'bookmark' | 'history' }> {
  const q = query.trim().toLowerCase();
  if (!q || q.startsWith('via://')) return [];

  const seen = new Set<string>();
  const matches: Array<{ title: string; url: string; source: 'bookmark' | 'history' }> = [];

  for (const b of bookmarks) {
    if (
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q)
    ) {
      if (!seen.has(b.url)) {
        seen.add(b.url);
        matches.push({ title: b.title, url: b.url, source: 'bookmark' });
      }
    }
    if (matches.length >= limit) return matches;
  }

  for (const h of history) {
    if (
      h.title.toLowerCase().includes(q) ||
      h.url.toLowerCase().includes(q)
    ) {
      if (!seen.has(h.url)) {
        seen.add(h.url);
        matches.push({ title: h.title, url: h.url, source: 'history' });
      }
    }
    if (matches.length >= limit) return matches;
  }

  return matches;
}

export const PROXY_BASE_URL = 'https://aged-bonus-7a0e.88ggsa77.workers.dev/?url=';

export function buildProxyUrl(targetUrl: string): string {
  return `${PROXY_BASE_URL}${encodeURIComponent(targetUrl)}`;
}

export function decodeBingResultUrl(rawHref: string): string {
  const trimmed = rawHref.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed, 'https://www.bing.com');
    if (parsed.hostname.endsWith('bing.com') && parsed.pathname.startsWith('/ck/')) {
      const encodedParam = parsed.searchParams.get('u');
      if (encodedParam && encodedParam.startsWith('a1') && encodedParam.length > 2) {
        const b64 = encodedParam.slice(2).replace(/-/g, '+').replace(/_/g, '/');
        const padLength = (4 - (b64.length % 4)) % 4;
        const padded = b64 + '='.repeat(padLength);
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const decoded = new TextDecoder('utf-8').decode(bytes);
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          return decoded;
        }
      }
    }
  } catch {
    // Fallback to rawHref if decoding fails
  }
  return trimmed;
}

export function decodeDuckDuckGoResultUrl(rawHref: string): string {
  const trimmed = rawHref.trim();
  if (!trimmed) return '';
  if (trimmed.includes('uddg=')) {
    try {
      const parsed = new URL(trimmed, 'https://html.duckduckgo.com');
      const target = parsed.searchParams.get('uddg');
      if (target && (target.startsWith('http://') || target.startsWith('https://'))) {
        return target;
      }
    } catch {
      // ignore
    }
  }
  return trimmed;
}

