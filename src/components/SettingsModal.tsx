import React from 'react';
import { Code, Trash2, X } from 'lucide-react';
import type {
  BrowserSettings,
  BrowserTab,
  ReaderFontSize,
  SearchEngineId,
  ToolbarPosition,
  UserAgentMode,
} from '../types/browser.ts';
import { SEARCH_ENGINES } from '../utils/browserLogic.ts';

interface SettingsModalProps {
  isOpen: boolean;
  initialView: 'settings' | 'source';
  settings: BrowserSettings;
  tab: BrowserTab;
  onClose: () => void;
  onUpdateSettings: (partial: Partial<BrowserSettings>) => void;
  onClearAllData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  initialView,
  settings,
  tab,
  onClose,
  onUpdateSettings,
  onClearAllData,
}) => {
  const [view, setView] = React.useState<'settings' | 'source'>(initialView);

  React.useEffect(() => {
    if (isOpen) {
      setView(initialView);
    }
  }, [isOpen, initialView]);

  if (!isOpen) return null;

  const hasPageSource = Boolean(tab.pageData?.rawHtmlPreview);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="إعدادات المتصفح"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {view === 'source' ? 'مصدر الصفحة' : 'إعدادات فيا ويب'}
            </h2>
            {hasPageSource && (
              <button
                type="button"
                onClick={() => setView(view === 'settings' ? 'source' : 'settings')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Code className="w-3.5 h-3.5" />
                <span>{view === 'settings' ? 'عرض المصدر' : 'الإعدادات'}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الإعدادات"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {view === 'source' && hasPageSource ? (
          <div className="flex-1 overflow-auto p-4">
            <pre
              dir="ltr"
              className="p-4 rounded-xl bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed"
            >
              <code>{tab.pageData?.rawHtmlPreview}</code>
            </pre>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Search Engine */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <label
                  htmlFor="setting-search-engine"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100 block"
                >
                  محرك البحث الافتراضي
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  يُستخدم عند البحث من شريط العنوان
                </span>
              </div>
              <select
                id="setting-search-engine"
                value={settings.searchEngine}
                onChange={(e) =>
                  onUpdateSettings({ searchEngine: e.target.value as SearchEngineId })
                }
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 min-h-[40px]"
              >
                {(Object.keys(SEARCH_ENGINES) as SearchEngineId[]).map((key) => (
                  <option key={key} value={key}>
                    {SEARCH_ENGINES[key].arName}
                  </option>
                ))}
              </select>
            </div>

            {/* Toolbar Position */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <label
                  htmlFor="setting-toolbar-pos"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100 block"
                >
                  موضع شريط الأدوات
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  تلقائي (سفلي للجوال، علوي للحاسوب) أو مثبت
                </span>
              </div>
              <select
                id="setting-toolbar-pos"
                value={settings.toolbarPosition}
                onChange={(e) =>
                  onUpdateSettings({ toolbarPosition: e.target.value as ToolbarPosition })
                }
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 min-h-[40px]"
              >
                <option value="auto">تلقائي</option>
                <option value="bottom">شريط سفلي (وضع فيا)</option>
                <option value="top">شريط علوي</option>
              </select>
            </div>

            {/* User Agent */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <label
                  htmlFor="setting-ua"
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100 block"
                >
                  هوية المتصفح (User-Agent)
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  طلب نسخة الجوال الخفيفة أو سطح المكتب
                </span>
              </div>
              <select
                id="setting-ua"
                value={settings.userAgent}
                onChange={(e) =>
                  onUpdateSettings({ userAgent: e.target.value as UserAgentMode })
                }
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 min-h-[40px]"
              >
                <option value="mobile">جوال (خفيف)</option>
                <option value="desktop">سطح المكتب</option>
              </select>
            </div>

            {/* Reader Font Size */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                  حجم خط وضع القراءة
                </span>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {(
                  [
                    { id: 'sm', label: 'صغير' },
                    { id: 'md', label: 'متوسط' },
                    { id: 'lg', label: 'كبير' },
                  ] as Array<{ id: ReaderFontSize; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ readerFontSize: opt.id })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                      settings.readerFontSize === opt.id
                        ? 'bg-white dark:bg-[#0D1117] text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle Switches */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="flex items-center justify-between gap-4 cursor-pointer py-1">
                <div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                    مانع الإعلانات والمتتبعات
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    إزالة النصوص البرمجية الإعلانية وعناصر التتبع تلقائياً
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.adBlock}
                  onChange={(e) => onUpdateSettings({ adBlock: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-4 cursor-pointer py-1">
                <div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                    وضع توفير البيانات (بدون صور)
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    إخفاء الصور لتسريع التصفح وتقليل استهلاك البيانات
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.noImages}
                  onChange={(e) => onUpdateSettings({ noImages: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-4 cursor-pointer py-1">
                <div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                    الوضع الليلي
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    تعتيم واجهة المتصفح وصفحات الويب لراحة العين
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.darkMode}
                  onChange={(e) => onUpdateSettings({ darkMode: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </label>
            </div>

            {/* Clear Data */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClearAllData}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-semibold min-h-[44px] cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>مسح سجل التصفح وإحصائيات الحظر</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
