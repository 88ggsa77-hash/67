import { useCallback, useEffect, useRef, useState } from 'react';
import { BookmarksHistoryModal } from './components/BookmarksHistoryModal.tsx';
import { BrowserToolbar } from './components/BrowserToolbar.tsx';
import { PageViewport } from './components/PageViewport.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { TabsDrawer } from './components/TabsDrawer.tsx';
import { ViaMenuSheet } from './components/ViaMenuSheet.tsx';
import type {
  BookmarkItem,
  BrowserSettings,
  BrowserStats,
  BrowserTab,
  HistoryEntry,
  SearchEngineId,
  SpeedDialItem,
} from './types/browser.ts';
import {
  canTabGoBack,
  canTabGoForward,
  createBrowserTab,
  extractDomain,
  normalizeInputToTarget,
  pushTabNavigation,
  removeTabAndSelectNext,
  stepTabBack,
  stepTabForward,
} from './utils/browserLogic.ts';
import { browsePageViaProxy, searchWebViaProxy } from './utils/clientBrowse.ts';
import {
  loadBookmarks,
  loadHistory,
  loadSettings,
  loadSpeedDial,
  loadStats,
  saveBookmarks,
  saveHistory,
  saveSettings,
  saveSpeedDial,
  saveStats,
} from './utils/storage.ts';

let idCounter = 1;
function nextId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

const SPEED_DIAL_COLORS = ['#0F766E', '#1D4ED8', '#B45309', '#334155', '#C2410C', '#4338CA'];

export function App() {
  const [settings, setSettings] = useState<BrowserSettings>(() => loadSettings());
  const [speedDial, setSpeedDial] = useState<SpeedDialItem[]>(() => loadSpeedDial());
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => loadBookmarks());
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [stats, setStats] = useState<BrowserStats>(() => loadStats());

  const [tabs, setTabs] = useState<BrowserTab[]>(() => [
    createBrowserTab({ id: 'tab-initial' }),
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-initial');

  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  // Overlay modals
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTabsOpen, setIsTabsOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [settingsModal, setSettingsModal] = useState<{
    open: boolean;
    view: 'settings' | 'source';
  }>({ open: false, view: 'settings' });

  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const fetchControllersRef = useRef<Map<string, AbortController>>(new Map());

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const isBottomBar =
    settings.toolbarPosition === 'bottom' ||
    (settings.toolbarPosition === 'auto' && isMobileViewport);

  // Sync Tailwind dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkMode);
  }, [settings.darkMode]);

  // Responsive viewport listener
  useEffect(() => {
    const onResize = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Sync browser document title
  useEffect(() => {
    if (activeTab.url === 'via://home') {
      document.title = 'فيا ويب — متصفح خفيف وسريع';
    } else {
      document.title = `${activeTab.title} — فيا ويب`;
    }
  }, [activeTab.title, activeTab.url]);

  const updateTabById = useCallback(
    (tabId: string, updater: (tab: BrowserTab) => BrowserTab) => {
      setTabs((prev) => prev.map((t) => (t.id === tabId ? updater(t) : t)));
    },
    []
  );

  const loadTargetIntoTab = useCallback(
    async (
      tabId: string,
      targetUrl: string,
      isIncognito: boolean,
      activeSettings: BrowserSettings,
      overrideQuery?: string
    ) => {
      // Cancel any in-flight request for this tab
      const existing = fetchControllersRef.current.get(tabId);
      if (existing) {
        existing.abort();
      }

      if (targetUrl === 'via://home') {
        updateTabById(tabId, (t) => ({
          ...t,
          url: 'via://home',
          title: t.isIncognito ? 'تبويب خفي' : 'الصفحة الرئيسية',
          isLoading: false,
          pageData: null,
          searchData: null,
          error: null,
          readerMode: false,
        }));
        return;
      }

      const controller = new AbortController();
      fetchControllersRef.current.set(tabId, controller);

      updateTabById(tabId, (t) => ({
        ...t,
        isLoading: true,
        error: null,
      }));

      // Search query route (via external Cloudflare Worker proxy)
      if (targetUrl.startsWith('via://search?q=')) {
        const query =
          overrideQuery ?? decodeURIComponent(targetUrl.slice('via://search?q='.length));
        try {
          const data = await searchWebViaProxy(
            query,
            activeSettings.searchEngine,
            controller.signal
          );
          if (controller.signal.aborted) return;

          updateTabById(tabId, (t) => ({
            ...t,
            isLoading: false,
            title: `بحث: ${query}`,
            searchData: data,
            pageData: null,
            error: null,
          }));
        } catch (err) {
          if (controller.signal.aborted) return;
          updateTabById(tabId, (t) => ({
            ...t,
            isLoading: false,
            error:
              err instanceof Error ? err.message : 'تعذر إجراء البحث في الوقت الحالي.',
          }));
        }
        return;
      }

      // Web page route (directly via external Cloudflare Worker proxy)
      try {
        const data = await browsePageViaProxy({
          url: targetUrl,
          adBlock: activeSettings.adBlock,
          noImages: activeSettings.noImages,
          darkMode: activeSettings.darkMode,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        updateTabById(tabId, (t) => ({
          ...t,
          isLoading: false,
          url: data.finalUrl || targetUrl,
          title: data.title || extractDomain(targetUrl),
          pageData: data,
          searchData: null,
          error: null,
        }));

        if (data.blockedCount > 0 || data.savedBytes > 0) {
          setStats((prev) => {
            const next = {
              totalBlocked: prev.totalBlocked + data.blockedCount,
              totalSavedBytes: prev.totalSavedBytes + data.savedBytes,
            };
            saveStats(next);
            return next;
          });
        }

        if (!isIncognito) {
          const entry: HistoryEntry = {
            id: nextId('hist'),
            title: data.title || extractDomain(data.finalUrl || targetUrl),
            url: data.finalUrl || targetUrl,
            domain: extractDomain(data.finalUrl || targetUrl),
            visitedAt: Date.now(),
          };
          setHistory((prev) => {
            const filtered = prev.filter((item) => item.url !== entry.url);
            const next = [entry, ...filtered].slice(0, 150);
            saveHistory(next);
            return next;
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        updateTabById(tabId, (t) => ({
          ...t,
          isLoading: false,
          pageData: null,
          searchData: null,
          error: err instanceof Error ? err.message : 'حدث خطأ أثناء الاتصال بالصفحة.',
        }));
      }
    },
    [updateTabById]
  );

  const handleNavigate = useCallback(
    (rawInput: string) => {
      const target = normalizeInputToTarget(rawInput, settings.searchEngine);
      const tabId = activeTab.id;
      const isIncognito = activeTab.isIncognito;

      updateTabById(tabId, (t) =>
        pushTabNavigation(
          t,
          target.url,
          target.type === 'search' ? `بحث: ${target.query}` : extractDomain(target.url)
        )
      );

      void loadTargetIntoTab(tabId, target.url, isIncognito, settings, target.query);
    },
    [activeTab.id, activeTab.isIncognito, loadTargetIntoTab, settings, updateTabById]
  );

  const handleGoBack = useCallback(() => {
    if (!canTabGoBack(activeTab)) return;
    const stepped = stepTabBack(activeTab);
    updateTabById(activeTab.id, () => stepped);
    void loadTargetIntoTab(activeTab.id, stepped.url, activeTab.isIncognito, settings);
  }, [activeTab, loadTargetIntoTab, settings, updateTabById]);

  const handleGoForward = useCallback(() => {
    if (!canTabGoForward(activeTab)) return;
    const stepped = stepTabForward(activeTab);
    updateTabById(activeTab.id, () => stepped);
    void loadTargetIntoTab(activeTab.id, stepped.url, activeTab.isIncognito, settings);
  }, [activeTab, loadTargetIntoTab, settings, updateTabById]);

  const handleReload = useCallback(() => {
    if (activeTab.url === 'via://home') return;
    void loadTargetIntoTab(activeTab.id, activeTab.url, activeTab.isIncognito, settings);
  }, [activeTab.id, activeTab.isIncognito, activeTab.url, loadTargetIntoTab, settings]);

  const handleNewTab = useCallback((incognito = false) => {
    const newTab = createBrowserTab({
      id: nextId('tab'),
      isIncognito: incognito,
    });
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const handleCloseTab = useCallback(
    (targetId: string) => {
      const controller = fetchControllersRef.current.get(targetId);
      if (controller) {
        controller.abort();
        fetchControllersRef.current.delete(targetId);
      }
      setTabs((prev) => {
        const result = removeTabAndSelectNext(prev, activeTabId, targetId, () =>
          nextId('tab')
        );
        setActiveTabId(result.activeTabId);
        return result.tabs;
      });
    },
    [activeTabId]
  );

  const handleCloseAllTabs = useCallback(() => {
    fetchControllersRef.current.forEach((ctrl) => ctrl.abort());
    fetchControllersRef.current.clear();
    const fresh = createBrowserTab({ id: nextId('tab') });
    setTabs([fresh]);
    setActiveTabId(fresh.id);
    setIsTabsOpen(false);
  }, []);

  const updateSettingsAndRefreshIfNeeded = useCallback(
    (partial: Partial<BrowserSettings>, shouldReloadPage = false) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        saveSettings(next);
        if (
          shouldReloadPage &&
          (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://'))
        ) {
          void loadTargetIntoTab(activeTab.id, activeTab.url, activeTab.isIncognito, next);
        }
        return next;
      });
    },
    [activeTab.id, activeTab.isIncognito, activeTab.url, loadTargetIntoTab]
  );

  const isCurrentBookmarked = bookmarks.some((b) => b.url === activeTab.url);

  const handleToggleBookmark = useCallback(() => {
    if (!activeTab.url.startsWith('http://') && !activeTab.url.startsWith('https://')) {
      return;
    }
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.url === activeTab.url);
      let next: BookmarkItem[];
      if (exists) {
        next = prev.filter((b) => b.url !== activeTab.url);
      } else {
        const item: BookmarkItem = {
          id: nextId('bm'),
          title: activeTab.title || extractDomain(activeTab.url),
          url: activeTab.url,
          domain: extractDomain(activeTab.url),
          createdAt: Date.now(),
        };
        next = [item, ...prev];
      }
      saveBookmarks(next);
      return next;
    });
  }, [activeTab.title, activeTab.url]);

  const handleRemoveBookmark = useCallback((id: string) => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      saveBookmarks(next);
      return next;
    });
  }, []);

  const handleAddSpeedDial = useCallback((title: string, url: string) => {
    setSpeedDial((prev) => {
      const color = SPEED_DIAL_COLORS[prev.length % SPEED_DIAL_COLORS.length];
      const next = [...prev, { id: nextId('sd'), title, url, accentColor: color }];
      saveSpeedDial(next);
      return next;
    });
  }, []);

  const handleRemoveSpeedDial = useCallback((id: string) => {
    setSpeedDial((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveSpeedDial(next);
      return next;
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const handleClearAllData = useCallback(() => {
    setHistory([]);
    saveHistory([]);
    const zeroStats = { totalBlocked: 0, totalSavedBytes: 0 };
    setStats(zeroStats);
    saveStats(zeroStats);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        setIsTabsOpen(false);
        setIsBookmarksOpen(false);
        setSettingsModal((prev) => ({ ...prev, open: false }));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        addressInputRef.current?.focus();
        addressInputRef.current?.select();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleNewTab(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNewTab]);

  const toolbarElement = (
    <BrowserToolbar
      tab={activeTab}
      tabCount={tabs.length}
      isBottomBar={isBottomBar}
      isBookmarked={isCurrentBookmarked}
      adBlockEnabled={settings.adBlock}
      bookmarks={bookmarks}
      history={history}
      addressInputRef={addressInputRef}
      onNavigate={handleNavigate}
      onGoBack={handleGoBack}
      onGoForward={handleGoForward}
      onReload={handleReload}
      onGoHome={() => handleNavigate('via://home')}
      onToggleBookmark={handleToggleBookmark}
      onToggleReaderMode={() =>
        updateTabById(activeTab.id, (t) => ({ ...t, readerMode: !t.readerMode }))
      }
      onOpenTabs={() => setIsTabsOpen(true)}
      onOpenMenu={() => setIsMenuOpen(true)}
    />
  );

  return (
    <div
      className="h-dvh w-full flex flex-col bg-[#F7F8FA] dark:bg-[#0D1117] text-slate-900 dark:text-slate-100 overflow-hidden"
      data-incognito={activeTab.isIncognito ? 'true' : 'false'}
    >
      {/* Top Toolbar when in Desktop / Top Mode */}
      {!isBottomBar && toolbarElement}

      {/* Sleek Top Loading Progress Line */}
      {activeTab.isLoading && (
        <div
          className="h-0.5 w-full bg-blue-100 dark:bg-blue-950 overflow-hidden shrink-0"
          role="progressbar"
          aria-label="جارٍ تحميل الصفحة"
        >
          <div className="h-full w-2/5 bg-blue-600 dark:bg-blue-400 animate-[pulse_1s_ease-in-out_infinite]" />
        </div>
      )}

      {/* Main Viewport */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <PageViewport
          tab={activeTab}
          settings={settings}
          speedDial={speedDial}
          stats={stats}
          onNavigate={handleNavigate}
          onReload={handleReload}
          onToggleReaderMode={() =>
            updateTabById(activeTab.id, (t) => ({ ...t, readerMode: !t.readerMode }))
          }
          onChangeSearchEngine={(engine: SearchEngineId) =>
            updateSettingsAndRefreshIfNeeded({ searchEngine: engine })
          }
          onAddSpeedDial={handleAddSpeedDial}
          onRemoveSpeedDial={handleRemoveSpeedDial}
        />
      </main>

      {/* Bottom Toolbar when in Mobile / Via Bottom Mode */}
      {isBottomBar && toolbarElement}

      {/* Iconic Via Quick Grid Menu */}
      <ViaMenuSheet
        isOpen={isMenuOpen}
        tab={activeTab}
        settings={settings}
        isBookmarked={isCurrentBookmarked}
        isBottomBar={isBottomBar}
        onClose={() => setIsMenuOpen(false)}
        onToggleBookmark={handleToggleBookmark}
        onToggleReaderMode={() =>
          updateTabById(activeTab.id, (t) => ({ ...t, readerMode: !t.readerMode }))
        }
        onToggleDarkMode={() =>
          updateSettingsAndRefreshIfNeeded({ darkMode: !settings.darkMode }, true)
        }
        onNewIncognitoTab={() => handleNewTab(true)}
        onToggleAdBlock={() =>
          updateSettingsAndRefreshIfNeeded({ adBlock: !settings.adBlock }, true)
        }
        onToggleNoImages={() =>
          updateSettingsAndRefreshIfNeeded({ noImages: !settings.noImages }, true)
        }
        onToggleUserAgent={() =>
          updateSettingsAndRefreshIfNeeded(
            { userAgent: settings.userAgent === 'desktop' ? 'mobile' : 'desktop' },
            true
          )
        }
        onGoHome={() => handleNavigate('via://home')}
        onOpenBookmarksHistory={() => setIsBookmarksOpen(true)}
        onOpenSettings={() => setSettingsModal({ open: true, view: 'settings' })}
        onOpenViewSource={() => setSettingsModal({ open: true, view: 'source' })}
      />

      {/* Tabs Switcher Drawer */}
      <TabsDrawer
        isOpen={isTabsOpen}
        tabs={tabs}
        activeTabId={activeTab.id}
        onClose={() => setIsTabsOpen(false)}
        onSelectTab={(id) => setActiveTabId(id)}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
        onCloseAllTabs={handleCloseAllTabs}
      />

      {/* Bookmarks & History Modal */}
      <BookmarksHistoryModal
        isOpen={isBookmarksOpen}
        bookmarks={bookmarks}
        history={history}
        onClose={() => setIsBookmarksOpen(false)}
        onNavigate={handleNavigate}
        onRemoveBookmark={handleRemoveBookmark}
        onClearHistory={handleClearHistory}
      />

      {/* Settings & View Source Modal */}
      <SettingsModal
        isOpen={settingsModal.open}
        initialView={settingsModal.view}
        settings={settings}
        tab={activeTab}
        onClose={() => setSettingsModal((prev) => ({ ...prev, open: false }))}
        onUpdateSettings={(partial) => {
          const needsReload =
            partial.adBlock !== undefined ||
            partial.noImages !== undefined ||
            partial.darkMode !== undefined ||
            partial.userAgent !== undefined;
          updateSettingsAndRefreshIfNeeded(partial, needsReload);
        }}
        onClearAllData={handleClearAllData}
      />
    </div>
  );
}

export default App;
