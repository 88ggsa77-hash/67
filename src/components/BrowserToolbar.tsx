import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  EyeOff,
  Home,
  Lock,
  Menu,
  RotateCw,
  Search,
  Shield,
  X,
} from 'lucide-react';
import type {
  BookmarkItem,
  BrowserTab,
  HistoryEntry,
} from '../types/browser.ts';
import {
  canTabGoBack,
  canTabGoForward,
  extractDomain,
  getOmniboxSuggestions,
} from '../utils/browserLogic.ts';

interface BrowserToolbarProps {
  tab: BrowserTab;
  tabCount: number;
  isBottomBar: boolean;
  isBookmarked: boolean;
  adBlockEnabled: boolean;
  bookmarks: BookmarkItem[];
  history: HistoryEntry[];
  addressInputRef: React.RefObject<HTMLInputElement | null>;
  onNavigate: (input: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onGoHome: () => void;
  onToggleBookmark: () => void;
  onToggleReaderMode: () => void;
  onOpenTabs: () => void;
  onOpenMenu: () => void;
}

export const BrowserToolbar: React.FC<BrowserToolbarProps> = ({
  tab,
  tabCount,
  isBottomBar,
  isBookmarked,
  adBlockEnabled,
  bookmarks,
  history,
  addressInputRef,
  onNavigate,
  onGoBack,
  onGoForward,
  onReload,
  onGoHome,
  onToggleBookmark,
  onToggleReaderMode,
  onOpenTabs,
  onOpenMenu,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isEditingMobile, setIsEditingMobile] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  const displayAddress =
    tab.url === 'via://home'
      ? ''
      : tab.url.startsWith('via://search?q=')
        ? decodeURIComponent(tab.url.slice('via://search?q='.length))
        : tab.url;

  useEffect(() => {
    if (!isFocused && !isEditingMobile) {
      setInputValue(displayAddress);
    }
  }, [displayAddress, isFocused, isEditingMobile]);

  useEffect(() => {
    if (isEditingMobile) {
      setInputValue(displayAddress);
      setTimeout(() => {
        mobileInputRef.current?.focus();
        mobileInputRef.current?.select();
      }, 20);
    }
  }, [isEditingMobile, displayAddress]);

  const suggestions = getOmniboxSuggestions(inputValue, bookmarks, history, 5);
  const canBack = canTabGoBack(tab);
  const canForward = canTabGoForward(tab);
  const isWebPage = tab.url.startsWith('http://') || tab.url.startsWith('https://');
  const blockedOnPage = tab.pageData?.blockedCount ?? 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setIsFocused(false);
    setIsEditingMobile(false);
    onNavigate(trimmed);
  };

  // Mobile / Bottom-Bar Mode (Iconic Via Thumb Navigation <= 56px)
  if (isBottomBar) {
    return (
      <>
        <nav
          aria-label="شريط تصفح فيا"
          className="h-14 shrink-0 bg-white/95 dark:bg-[#161B22]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 flex items-center justify-between gap-1 z-30"
        >
          {/* Back (RTL: ArrowRight points back in reading direction) */}
          <button
            type="button"
            onClick={onGoBack}
            disabled={!canBack}
            aria-label="رجوع"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          {/* Forward */}
          <button
            type="button"
            onClick={onGoForward}
            disabled={!canForward}
            aria-label="تقدم"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Address Trigger Pill */}
          <div className="flex-1 min-w-0 flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-xl h-10 px-2.5 gap-1.5">
            {tab.isIncognito ? (
              <EyeOff className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
            ) : isWebPage ? (
              <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            ) : (
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            )}

            <button
              type="button"
              onClick={() => setIsEditingMobile(true)}
              aria-label="شريط العنوان والبحث"
              className="flex-1 min-w-0 text-right text-xs sm:text-sm text-slate-700 dark:text-slate-200 truncate cursor-pointer py-1"
            >
              {tab.url === 'via://home'
                ? 'ابحث أو أدخل رابطاً...'
                : tab.url.startsWith('via://search?q=')
                  ? displayAddress
                  : extractDomain(tab.url)}
            </button>

            {tab.url !== 'via://home' && (
              <button
                type="button"
                onClick={onReload}
                aria-label="تحديث الصفحة"
                className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer shrink-0"
              >
                <RotateCw className={`w-3.5 h-3.5 ${tab.isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {/* Tab Switcher Square Icon [N] */}
          <button
            type="button"
            onClick={onOpenTabs}
            aria-label={`التبويبات المفتوحة (${tabCount})`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <span className="w-5 h-5 rounded-md border-[1.75px] border-current flex items-center justify-center text-[11px] font-bold tabular-nums">
              {tabCount}
            </span>
          </button>

          {/* Via Menu Trigger */}
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="قائمة المتصفح"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        </nav>

        {/* Full-screen / Top Address Editor Overlay for Bottom Bar Mode */}
        {isEditingMobile && (
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex flex-col justify-start p-3"
            role="dialog"
            aria-modal="true"
            aria-label="تحرير العنوان أو البحث"
          >
            <div className="bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xl">
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                  ref={mobileInputRef}
                  type="text"
                  dir={/^https?:\/\//i.test(inputValue) ? 'ltr' : 'auto'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="ابحث أو أدخل رابط الموقع..."
                  aria-label="أدخل رابطاً أو عبارة بحث"
                  className="flex-1 min-w-0 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {inputValue && (
                  <button
                    type="button"
                    onClick={() => setInputValue('')}
                    aria-label="مسح النص"
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-medium min-h-[44px] cursor-pointer shrink-0"
                >
                  انتقال
                </button>
              </form>

              {suggestions.length > 0 && (
                <ul className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-2 space-y-1 max-h-60 overflow-y-auto">
                  {suggestions.map((s) => (
                    <li key={s.url}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingMobile(false);
                          onNavigate(s.url);
                        }}
                        className="w-full text-right px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2 cursor-pointer min-h-[44px]"
                      >
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                          {s.title}
                        </span>
                        <span className="text-xs font-mono text-slate-400 truncate max-w-[140px]" dir="ltr">
                          {extractDomain(s.url)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditingMobile(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop Top Toolbar (Single-row crisp 3-zone layout)
  return (
    <header className="h-14 shrink-0 bg-white dark:bg-[#161B22] border-b border-slate-200 dark:border-slate-800 px-3 flex items-center gap-3 z-30">
      {/* Navigation Group */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onGoBack}
          disabled={!canBack}
          aria-label="رجوع"
          title="رجوع"
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onGoForward}
          disabled={!canForward}
          aria-label="تقدم"
          title="تقدم"
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onReload}
          disabled={tab.url === 'via://home'}
          aria-label="تحديث"
          title="تحديث"
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        >
          <RotateCw className={`w-4 h-4 ${tab.isLoading ? 'animate-spin' : ''}`} />
        </button>

        <button
          type="button"
          onClick={onGoHome}
          aria-label="الصفحة الرئيسية"
          title="الصفحة الرئيسية"
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Home className="w-4 h-4" />
        </button>
      </div>

      {/* Unified Address & Search Bar */}
      <div className="relative flex-1 min-w-0 max-w-3xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className={`flex items-center gap-2 rounded-xl px-3 h-10 border transition-all ${
            tab.isIncognito
              ? 'bg-slate-800/90 border-slate-700 text-slate-100'
              : 'bg-slate-100/90 dark:bg-slate-800/70 border-transparent focus-within:bg-white dark:focus-within:bg-[#0D1117] focus-within:border-blue-500'
          }`}
        >
          {tab.isIncognito ? (
            <EyeOff className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          ) : isWebPage ? (
            <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          ) : (
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          )}

          <label htmlFor="desktop-address-input" className="sr-only">
            شريط العنوان والبحث
          </label>
          <input
            id="desktop-address-input"
            ref={addressInputRef}
            type="text"
            dir={/^https?:\/\//i.test(inputValue) ? 'ltr' : 'auto'}
            value={inputValue}
            onFocus={(e) => {
              setIsFocused(true);
              e.currentTarget.select();
            }}
            onBlur={() => {
              setTimeout(() => setIsFocused(false), 150);
            }}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="أدخل رابط الموقع أو ابحث..."
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />

          {adBlockEnabled && blockedOnPage > 0 && (
            <span
              className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0"
              title={`تم حظر ${blockedOnPage} عنصراً`}
            >
              <Shield className="w-3 h-3" />
              <span>{blockedOnPage}</span>
            </span>
          )}

          {isWebPage && tab.pageData && (
            <button
              type="button"
              onClick={onToggleReaderMode}
              aria-label={tab.readerMode ? 'إيقاف وضع القراءة' : 'تفعيل وضع القراءة'}
              title={tab.readerMode ? 'إيقاف وضع القراءة' : 'وضع القراءة'}
              className={`min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg transition-colors cursor-pointer shrink-0 ${
                tab.readerMode
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          )}

          {isWebPage && (
            <button
              type="button"
              onClick={onToggleBookmark}
              aria-label={isBookmarked ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
              title={isBookmarked ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
              className={`min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg transition-colors cursor-pointer shrink-0 ${
                isBookmarked
                  ? 'text-amber-500'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
          )}
        </form>

        {/* Omnibox Autocomplete Dropdown */}
        {isFocused && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-12 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-1.5 z-50">
            {suggestions.map((item) => (
              <li key={item.url}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsFocused(false);
                    onNavigate(item.url);
                  }}
                  className="w-full text-right px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-3 cursor-pointer"
                >
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {item.title}
                  </span>
                  <span className="text-xs font-mono text-slate-400 truncate max-w-[200px]" dir="ltr">
                    {item.url}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Right Actions: Tabs Counter & Menu */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onOpenTabs}
          aria-label={`التبويبات المفتوحة (${tabCount})`}
          title="إدارة التبويبات"
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <span className="w-5 h-5 rounded-md border-[1.75px] border-current flex items-center justify-center text-[11px] font-bold tabular-nums">
            {tabCount}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="قائمة المتصفح"
          title="القائمة"
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
