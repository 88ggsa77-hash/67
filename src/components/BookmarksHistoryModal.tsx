import React, { useState } from 'react';
import { Bookmark, Clock, Search, Trash2, X } from 'lucide-react';
import type { BookmarkItem, HistoryEntry } from '../types/browser.ts';

interface BookmarksHistoryModalProps {
  isOpen: boolean;
  bookmarks: BookmarkItem[];
  history: HistoryEntry[];
  onClose: () => void;
  onNavigate: (url: string) => void;
  onRemoveBookmark: (id: string) => void;
  onClearHistory: () => void;
}

export const BookmarksHistoryModal: React.FC<BookmarksHistoryModalProps> = ({
  isOpen,
  bookmarks,
  history,
  onClose,
  onNavigate,
  onRemoveBookmark,
  onClearHistory,
}) => {
  const [activeSection, setActiveSection] = useState<'bookmarks' | 'history'>('bookmarks');
  const [filterText, setFilterText] = useState('');

  if (!isOpen) return null;

  const q = filterText.trim().toLowerCase();
  const filteredBookmarks = bookmarks.filter(
    (b) => !q || b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)
  );
  const filteredHistory = history.filter(
    (h) => !q || h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q)
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="المفضلة وسجل التصفح"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[82vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSection('bookmarks')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[36px] ${
                activeSection === 'bookmarks'
                  ? 'bg-white dark:bg-[#0D1117] text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>المفضلة ({bookmarks.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('history')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[36px] ${
                activeSection === 'history'
                  ? 'bg-white dark:bg-[#0D1117] text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>السجل ({history.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق المفضلة والسجل"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl px-3 h-10">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <label htmlFor="bh-filter-input" className="sr-only">
              بحث في المفضلة والسجل
            </label>
            <input
              id="bh-filter-input"
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="تصفية..."
              className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>

          {activeSection === 'history' && history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="px-3 h-10 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer shrink-0"
            >
              مسح السجل
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {activeSection === 'bookmarks' ? (
            filteredBookmarks.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                لا توجد إشارات مرجعية محفوظة بعد.
              </div>
            ) : (
              filteredBookmarks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(b.url);
                      onClose();
                    }}
                    className="flex-1 min-w-0 text-right cursor-pointer py-1"
                  >
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {b.title}
                    </div>
                    <div className="text-xs font-mono text-slate-400 truncate" dir="ltr">
                      {b.url}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveBookmark(b.id)}
                    aria-label={`حذف إشارة ${b.title}`}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )
          ) : filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              سجل التصفح فارغ.
            </div>
          ) : (
            filteredHistory.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  onNavigate(h.url);
                  onClose();
                }}
                className="w-full text-right px-3 py-2.5 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {h.title}
                  </div>
                  <div className="text-xs font-mono text-slate-400 truncate" dir="ltr">
                    {h.domain}
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                  {new Date(h.visitedAt).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
