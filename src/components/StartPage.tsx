import React, { useState } from 'react';
import {
  Compass,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
  EyeOff,
} from 'lucide-react';
import type {
  BrowserStats,
  SearchEngineId,
  SpeedDialItem,
} from '../types/browser.ts';
import {
  extractDomain,
  formatBytes,
  normalizeInputToTarget,
  SEARCH_ENGINES,
} from '../utils/browserLogic.ts';

interface StartPageProps {
  isIncognito: boolean;
  searchEngine: SearchEngineId;
  speedDial: SpeedDialItem[];
  stats: BrowserStats;
  adBlockEnabled: boolean;
  onNavigate: (input: string) => void;
  onChangeSearchEngine: (engine: SearchEngineId) => void;
  onAddSpeedDial: (title: string, url: string) => void;
  onRemoveSpeedDial: (id: string) => void;
}

export const StartPage: React.FC<StartPageProps> = ({
  isIncognito,
  searchEngine,
  speedDial,
  stats,
  adBlockEnabled,
  onNavigate,
  onChangeSearchEngine,
  onAddSpeedDial,
  onRemoveSpeedDial,
}) => {
  const [query, setQuery] = useState('');
  const [isEditingDial, setIsEditingDial] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    onNavigate(trimmed);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newTitle.trim();
    const cleanUrl = newUrl.trim();
    if (!cleanTitle) {
      setFormError('يرجى إدخال اسم الاختصار.');
      return;
    }
    if (!cleanUrl) {
      setFormError('يرجى إدخال رابط الموقع.');
      return;
    }

    const normalized = normalizeInputToTarget(cleanUrl, searchEngine);
    if (normalized.type !== 'url') {
      setFormError('يرجى إدخال رابط موقع صحيح مثل example.com أو https://example.com');
      return;
    }

    onAddSpeedDial(cleanTitle, normalized.url);
    setNewTitle('');
    setNewUrl('');
    setFormError(null);
    setShowAddModal(false);
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-10 md:py-16">
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
        {/* Minimalist Via Emblem & Wordmark */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border transition-colors ${
              isIncognito
                ? 'bg-slate-800 text-slate-100 border-slate-700'
                : 'bg-white dark:bg-[#161B22] text-blue-600 dark:text-blue-400 border-slate-200 dark:border-slate-800 shadow-sm'
            }`}
            aria-hidden="true"
          >
            {isIncognito ? <EyeOff className="w-7 h-7" /> : <Compass className="w-7 h-7" />}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {isIncognito ? 'تصفح خفي' : 'فيا ويب'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {isIncognito
              ? 'لن يتم حفظ سجل التصفح أو الصفحات المفتوحة في هذا التبويب'
              : 'متصفح خفيف وسريع مع مانع إعلانات ووضع قراءة'}
          </p>
        </div>

        {/* Clean Omnibox Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="w-full mb-9"
          role="search"
          aria-label="البحث أو إدخال رابط"
        >
          <div className="flex items-center gap-2 bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-1.5 shadow-sm focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/15 transition-all">
            <label htmlFor="start-search-engine" className="sr-only">
              محرك البحث
            </label>
            <select
              id="start-search-engine"
              value={searchEngine}
              onChange={(e) => onChangeSearchEngine(e.target.value as SearchEngineId)}
              aria-label="اختيار محرك البحث"
              className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-2.5 py-2 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer shrink-0 min-h-[40px]"
            >
              {(Object.keys(SEARCH_ENGINES) as SearchEngineId[]).map((engineKey) => (
                <option key={engineKey} value={engineKey}>
                  {SEARCH_ENGINES[engineKey].arName}
                </option>
              ))}
            </select>

            <label htmlFor="start-page-input" className="sr-only">
              ابحث أو أدخل عنوان الموقع
            </label>
            <input
              id="start-page-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث في الويب أو أدخل رابطاً..."
              autoComplete="off"
              className="flex-1 min-w-0 bg-transparent text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 py-2.5 px-1 focus:outline-none"
            />

            <button
              type="submit"
              aria-label="انتقال أو بحث"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.97] text-white transition-all shrink-0 cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Speed Dial Grid */}
        <section className="w-full" aria-label="الوصول السريع">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              الوصول السريع
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsEditingDial((prev) => !prev)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors py-1 px-2 rounded-lg cursor-pointer"
              >
                {isEditingDial ? 'تم' : 'تعديل'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors py-1 px-2 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة اختصار</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            {speedDial.map((item) => {
              const domain = extractDomain(item.url);
              const initial = item.title.trim().charAt(0).toUpperCase() || domain.charAt(0).toUpperCase();

              return (
                <div key={item.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => onNavigate(item.url)}
                    className="w-full flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white dark:bg-[#161B22] border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 active:scale-[0.98] transition-all min-h-[88px] cursor-pointer"
                  >
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: item.accentColor }}
                      aria-hidden="true"
                    >
                      {initial}
                    </span>
                    <span
                      dir="auto"
                      className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate w-full text-center"
                    >
                      {item.title}
                    </span>
                  </button>

                  {isEditingDial && (
                    <button
                      type="button"
                      onClick={() => onRemoveSpeedDial(item.id)}
                      aria-label={`حذف اختصار ${item.title}`}
                      className="absolute -top-1.5 -left-1.5 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow-sm hover:bg-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Quiet, Real Privacy Summary (only when real stats exist) */}
        {(adBlockEnabled || stats.totalBlocked > 0) && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>{adBlockEnabled ? 'مانع الإعلانات مفعّل' : 'مانع الإعلانات متوقف'}</span>
            {stats.totalBlocked > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">تم حظر {stats.totalBlocked} عنصراً</span>
              </>
            )}
            {stats.totalSavedBytes > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">توفير {formatBytes(stats.totalSavedBytes)}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add Speed Dial Shortcut Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-shortcut-title"
        >
          <div className="w-full max-w-sm bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3
                id="add-shortcut-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                إضافة اختصار جديد
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="إغلاق نافذة إضافة اختصار"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="shortcut-name-input"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  اسم الموقع
                </label>
                <input
                  id="shortcut-name-input"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: ويكيبيديا"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="shortcut-url-input"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  رابط الموقع
                </label>
                <input
                  id="shortcut-url-input"
                  type="text"
                  dir="ltr"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://ar.wikipedia.org"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              {formError && (
                <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-blue-600 hover:bg-blue-700 text-white min-h-[40px] cursor-pointer"
                >
                  حفظ الاختصار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
