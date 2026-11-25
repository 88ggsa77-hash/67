import type {
  BookmarkItem,
  BrowserSettings,
  BrowserStats,
  HistoryEntry,
  SpeedDialItem,
} from '../types/browser.ts';

const KEYS = {
  settings: 'viaweb_settings_v1',
  speedDial: 'viaweb_speed_dial_v1',
  bookmarks: 'viaweb_bookmarks_v1',
  history: 'viaweb_history_v1',
  stats: 'viaweb_stats_v1',
};

export const DEFAULT_SETTINGS: BrowserSettings = {
  searchEngine: 'duckduckgo',
  adBlock: true,
  noImages: false,
  darkMode: false,
  toolbarPosition: 'auto',
  userAgent: 'mobile',
  readerFontSize: 'md',
};

export const DEFAULT_SPEED_DIAL: SpeedDialItem[] = [
  {
    id: 'sd-wiki',
    title: 'ويكيبيديا',
    url: 'https://ar.wikipedia.org/wiki/%D8%A7%D9%84%D8%B5%D9%81%D8%AD%D8%A9_%D8%A7%D9%84%D8%B1%D8%A6%D9%8A%D8%B3%D9%8A%D8%A9',
    accentColor: '#334155',
  },
  {
    id: 'sd-hn',
    title: 'Hacker News',
    url: 'https://news.ycombinator.com',
    accentColor: '#C2410C',
  },
  {
    id: 'sd-github',
    title: 'GitHub',
    url: 'https://github.com/explore',
    accentColor: '#0F172A',
  },
  {
    id: 'sd-mdn',
    title: 'MDN Docs',
    url: 'https://developer.mozilla.org/en-US/',
    accentColor: '#1D4ED8',
  },
  {
    id: 'sd-aljazeera',
    title: 'الجزيرة نت',
    url: 'https://www.aljazeera.net',
    accentColor: '#B45309',
  },
  {
    id: 'sd-example',
    title: 'Example',
    url: 'https://example.com',
    accentColor: '#0F766E',
  },
];

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSettings(): BrowserSettings {
  const stored = safeReadJson<Partial<BrowserSettings>>(KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(settings: BrowserSettings): void {
  safeWriteJson(KEYS.settings, settings);
}

export function loadSpeedDial(): SpeedDialItem[] {
  const stored = safeReadJson<SpeedDialItem[] | null>(KEYS.speedDial, null);
  if (!Array.isArray(stored) || stored.length === 0) {
    return DEFAULT_SPEED_DIAL;
  }
  return stored;
}

export function saveSpeedDial(items: SpeedDialItem[]): void {
  safeWriteJson(KEYS.speedDial, items);
}

export function loadBookmarks(): BookmarkItem[] {
  const stored = safeReadJson<BookmarkItem[]>(KEYS.bookmarks, []);
  return Array.isArray(stored) ? stored : [];
}

export function saveBookmarks(items: BookmarkItem[]): void {
  safeWriteJson(KEYS.bookmarks, items);
}

export function loadHistory(): HistoryEntry[] {
  const stored = safeReadJson<HistoryEntry[]>(KEYS.history, []);
  return Array.isArray(stored) ? stored : [];
}

export function saveHistory(items: HistoryEntry[]): void {
  safeWriteJson(KEYS.history, items.slice(0, 150));
}

export function loadStats(): BrowserStats {
  const stored = safeReadJson<Partial<BrowserStats>>(KEYS.stats, {});
  return {
    totalBlocked: typeof stored.totalBlocked === 'number' ? stored.totalBlocked : 0,
    totalSavedBytes: typeof stored.totalSavedBytes === 'number' ? stored.totalSavedBytes : 0,
  };
}

export function saveStats(stats: BrowserStats): void {
  safeWriteJson(KEYS.stats, stats);
}
