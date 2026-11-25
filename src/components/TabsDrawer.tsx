import React from 'react';
import { EyeOff, Globe, Plus, Trash2, X } from 'lucide-react';
import type { BrowserTab } from '../types/browser.ts';
import { extractDomain } from '../utils/browserLogic.ts';

interface TabsDrawerProps {
  isOpen: boolean;
  tabs: BrowserTab[];
  activeTabId: string;
  onClose: () => void;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: (incognito?: boolean) => void;
  onCloseAllTabs: () => void;
}

export const TabsDrawer: React.FC<TabsDrawerProps> = ({
  isOpen,
  tabs,
  activeTabId,
  onClose,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onCloseAllTabs,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="إدارة التبويبات"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[82vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              التبويبات المفتوحة
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              ({tabs.length})
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCloseAllTabs}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 min-h-[36px] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>إغلاق الكل</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق نافذة التبويبات"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className={`flex items-center justify-between gap-2 p-2.5 rounded-2xl border transition-colors ${
                  isActive
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800'
                    : 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab(tab.id);
                    onClose();
                  }}
                  className="flex-1 min-w-0 flex items-center gap-3 text-right py-1 px-1 cursor-pointer min-h-[44px]"
                >
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      tab.isIncognito
                        ? 'bg-slate-800 text-slate-100'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                    aria-hidden="true"
                  >
                    {tab.isIncognito ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Globe className="w-4 h-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {tab.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                      <span>{tab.isIncognito ? 'تبويب خفي' : extractDomain(tab.url)}</span>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onCloseTab(tab.id)}
                  aria-label={`إغلاق تبويب ${tab.title}`}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onNewTab(false);
              onClose();
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold min-h-[44px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تبويب جديد</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNewTab(true);
              onClose();
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold min-h-[44px] cursor-pointer"
          >
            <EyeOff className="w-4 h-4" />
            <span>تبويب خفي</span>
          </button>
        </div>
      </div>
    </div>
  );
};
