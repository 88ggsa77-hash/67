import React, { useRef } from 'react';
import {
  AlertCircle,
  BookOpen,
  ExternalLink,
  Home,
  RotateCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type {
  BrowserSettings,
  BrowserStats,
  BrowserTab,
  SearchEngineId,
  SpeedDialItem,
} from '../types/browser.ts';
import { extractDomain, formatBytes, SEARCH_ENGINES } from '../utils/browserLogic.ts';
import { StartPage } from './StartPage.tsx';

interface PageViewportProps {
  tab: BrowserTab;
  settings: BrowserSettings;
  speedDial: SpeedDialItem[];
  stats: BrowserStats;
  onNavigate: (input: string) => void;
  onReload: () => void;
  onToggleReaderMode: () => void;
  onChangeSearchEngine: (engine: SearchEngineId) => void;
  onAddSpeedDial: (title: string, url: string) => void;
  onRemoveSpeedDial: (id: string) => void;
}

export const PageViewport: React.FC<PageViewportProps> = ({
  tab,
  settings,
  speedDial,
  stats,
  onNavigate,
  onReload,
  onToggleReaderMode,
  onChangeSearchEngine,
  onAddSpeedDial,
  onRemoveSpeedDial,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;

      // Intercept link clicks inside sandboxed (scriptless) iframe so browsing stays inside ViaWeb
      doc.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
        if (!anchor) return;
        const href = anchor.getAttribute('href');
        if (!href) return;

        if (href.startsWith('#')) {
          return;
        }

        event.preventDefault();
        if (href.startsWith('http://') || href.startsWith('https://')) {
          onNavigate(href);
        }
      });
    } catch {
      // Ignore cross-origin access errors if any
    }
  };

  // 1. Start Page
  if (tab.url === 'via://home') {
    return (
      <div className="flex-1 overflow-y-auto">
        <StartPage
          isIncognito={tab.isIncognito}
          searchEngine={settings.searchEngine}
          speedDial={speedDial}
          stats={stats}
          adBlockEnabled={settings.adBlock}
          onNavigate={onNavigate}
          onChangeSearchEngine={onChangeSearchEngine}
          onAddSpeedDial={onAddSpeedDial}
          onRemoveSpeedDial={onRemoveSpeedDial}
        />
      </div>
    );
  }

  // 2. Loading indicator overlay when tab has no content yet
  if (tab.isLoading && !tab.pageData && !tab.searchData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-blue-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          جارٍ التحميل الخفيف...
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono truncate max-w-md" dir="ltr">
          {tab.url}
        </p>
      </div>
    );
  }

  // 3. Error view
  if (tab.error) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center">
          <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            تعذر فتح الصفحة
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            {tab.error}
          </p>
          <p className="mt-2 text-xs font-mono text-slate-400 dark:text-slate-500 truncate" dir="ltr">
            {tab.url}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onReload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium min-h-[40px] cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>إعادة المحاولة</span>
            </button>
            {(tab.url.startsWith('http://') || tab.url.startsWith('https://')) && (
              <a
                href={tab.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium min-h-[40px]"
              >
                <span>فتح خارجياً</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => onNavigate('via://home')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium min-h-[40px] cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>الرئيسية</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Built-in Search Results View
  if (tab.url.startsWith('via://search') && tab.searchData) {
    const { query, engine, results, externalSearchUrl, offlineFallback, error } = tab.searchData;
    return (
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Search className="w-3.5 h-3.5" />
                <span>نتائج البحث عبر {SEARCH_ENGINES[engine].arName}</span>
                {results.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{results.length} نتيجة</span>
                  </>
                )}
              </div>
              <h1 dir="auto" className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                {query}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {(Object.keys(SEARCH_ENGINES) as SearchEngineId[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChangeSearchEngine(key);
                    onNavigate(query);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[36px] ${
                    engine === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-[#161B22] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {SEARCH_ENGINES[key].arName}
                </button>
              ))}
            </div>
          </div>

          {offlineFallback || results.length === 0 ? (
            <div className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {error || 'لم يتم العثور على نتائج مطابقة.'}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onChangeSearchEngine('wikipedia');
                    onNavigate(query);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium min-h-[40px] cursor-pointer"
                >
                  البحث في ويكيبيديا العربية
                </button>
                <a
                  href={externalSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
                >
                  <span>فتح البحث خارجياً</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((item, idx) => (
                <article
                  key={`${item.url}-${idx}`}
                  className="bg-white dark:bg-[#161B22] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span className="font-mono truncate max-w-xs" dir="ltr">
                      {item.domain}
                    </span>
                  </div>
                  <button
                    type="button"
                    dir="auto"
                    onClick={() => onNavigate(item.url)}
                    className="text-start text-base font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer block w-full"
                  >
                    {item.title}
                  </button>
                  {item.snippet && (
                    <p
                      dir="auto"
                      className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed"
                    >
                      {item.snippet}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 5. Reader Mode View (Pure Safe React Rendering)
  if (tab.pageData && tab.readerMode) {
    const { title, finalUrl, blockedCount, readerBlocks, readingMinutes } = tab.pageData;
    const sizeClass =
      settings.readerFontSize === 'sm'
        ? 'text-sm leading-7'
        : settings.readerFontSize === 'lg'
          ? 'text-lg leading-9'
          : 'text-base leading-8';

    return (
      <div className="flex-1 overflow-y-auto bg-[#FAF9F6] dark:bg-[#0D1117]">
        <article className="max-w-2xl mx-auto px-5 py-8 sm:py-12">
          <header className="pb-6 mb-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>وضع القراءة</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono" dir="ltr">
                  {extractDomain(finalUrl)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{readingMinutes} د قراءة</span>
                {blockedCount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">حُظر {blockedCount}</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={onToggleReaderMode}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer py-1"
              >
                عرض صفحة الويب الكاملة
              </button>
            </div>

            <h1
              dir="auto"
              className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 leading-snug text-balance"
            >
              {title}
            </h1>
          </header>

          {readerBlocks.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              لم يتم العثور على نص مقال منسق في هذه الصفحة. يمكنك العودة إلى عرض الويب الكامل.
            </div>
          ) : (
            <div className={`space-y-5 text-slate-800 dark:text-slate-200 ${sizeClass}`}>
              {readerBlocks.map((block, index) => {
                if (block.type === 'heading') {
                  const HeadingTag = block.level && block.level <= 2 ? 'h2' : 'h3';
                  return (
                    <HeadingTag
                      key={index}
                      dir="auto"
                      className="text-xl font-bold text-slate-900 dark:text-slate-100 pt-3"
                    >
                      {block.text}
                    </HeadingTag>
                  );
                }
                if (block.type === 'quote') {
                  return (
                    <blockquote
                      key={index}
                      dir="auto"
                      className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 italic"
                    >
                      {block.text}
                    </blockquote>
                  );
                }
                if (block.type === 'code') {
                  return (
                    <pre
                      key={index}
                      dir="ltr"
                      className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto"
                    >
                      <code>{block.text}</code>
                    </pre>
                  );
                }
                if (block.type === 'list' && block.items) {
                  return (
                    <ul key={index} dir="auto" className="list-disc list-inside space-y-1.5">
                      {block.items.map((item, liIdx) => (
                        <li key={liIdx}>{item}</li>
                      ))}
                    </ul>
                  );
                }
                if (block.type === 'image' && block.src) {
                  return (
                    <figure key={index} className="my-4">
                      <img
                        src={block.src}
                        alt={block.alt || ''}
                        referrerPolicy="no-referrer"
                        className="rounded-xl max-h-96 mx-auto object-contain border border-slate-200 dark:border-slate-800"
                      />
                    </figure>
                  );
                }
                return (
                  <p key={index} dir="auto">
                    {block.text}
                  </p>
                );
              })}
            </div>
          )}
        </article>
      </div>
    );
  }

  // 6. Sanitized Web Page View (iframe sandbox without allow-scripts)
  if (tab.pageData) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0D1117]">
        {/* Slim scrollable metadata strip */}
        <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-slate-50 dark:bg-[#161B22] border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate font-medium text-slate-700 dark:text-slate-200">
              {tab.pageData.title}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums shrink-0">
              {formatBytes(tab.pageData.rawBytes)}
            </span>
            {tab.pageData.blockedCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums shrink-0">
                  حُظر {tab.pageData.blockedCount}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleReaderMode}
            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline shrink-0 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>وضع القراءة</span>
          </button>
        </div>

        <iframe
          ref={iframeRef}
          title={tab.pageData.title}
          srcDoc={tab.pageData.sanitizedHtml}
          sandbox="allow-same-origin"
          onLoad={handleIframeLoad}
          className="flex-1 w-full border-0 bg-white dark:bg-[#0D1117]"
        />
      </div>
    );
  }

  return null;
};
