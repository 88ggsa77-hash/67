export type SearchEngineId = 'duckduckgo' | 'google' | 'wikipedia' | 'bing';

export type ToolbarPosition = 'auto' | 'bottom' | 'top';
export type UserAgentMode = 'mobile' | 'desktop';
export type ReaderFontSize = 'sm' | 'md' | 'lg';

export interface ReaderBlock {
  type: 'heading' | 'paragraph' | 'quote' | 'code' | 'list' | 'image';
  level?: number;
  text?: string;
  items?: string[];
  src?: string;
  alt?: string;
}

export interface SearchResultItem {
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

export interface BrowseResponse {
  ok: boolean;
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  favicon: string;
  blockedCount: number;
  rawBytes: number;
  savedBytes: number;
  sanitizedHtml: string;
  rawHtmlPreview: string;
  readerBlocks: ReaderBlock[];
  readingMinutes: number;
  error?: string;
  offlineFallback?: boolean;
}

export interface SearchResponse {
  ok: boolean;
  query: string;
  engine: SearchEngineId;
  results: SearchResultItem[];
  externalSearchUrl: string;
  error?: string;
  offlineFallback?: boolean;
}

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  historyStack: string[];
  historyIndex: number;
  isLoading: boolean;
  isIncognito: boolean;
  readerMode: boolean;
  pageData: BrowseResponse | null;
  searchData: SearchResponse | null;
  error: string | null;
  scrollY: number;
}

export interface SpeedDialItem {
  id: string;
  title: string;
  url: string;
  accentColor: string;
}

export interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  domain: string;
  createdAt: number;
}

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  domain: string;
  visitedAt: number;
}

export interface BrowserSettings {
  searchEngine: SearchEngineId;
  adBlock: boolean;
  noImages: boolean;
  darkMode: boolean;
  toolbarPosition: ToolbarPosition;
  userAgent: UserAgentMode;
  readerFontSize: ReaderFontSize;
}

export interface BrowserStats {
  totalBlocked: number;
  totalSavedBytes: number;
}
