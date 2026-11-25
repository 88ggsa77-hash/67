import React from 'react';
import {
  Bookmark,
  BookOpen,
  Code,
  EyeOff,
  History,
  Home,
  ImageOff,
  Monitor,
  Moon,
  Settings,
  ShieldCheck,
  Smartphone,
  Sun,
  X,
} from 'lucide-react';
import type { BrowserSettings, BrowserTab } from '../types/browser.ts';

interface ViaMenuSheetProps {
  isOpen: boolean;
  tab: BrowserTab;
  settings: BrowserSettings;
  isBookmarked: boolean;
  isBottomBar: boolean;
  onClose: () => void;
  onToggleBookmark: () => void;
  onToggleReaderMode: () => void;
  onToggleDarkMode: () => void;
  onNewIncognitoTab: () => void;
  onToggleAdBlock: () => void;
  onToggleNoImages: () => void;
  onToggleUserAgent: () => void;
  onGoHome: () => void;
  onOpenBookmarksHistory: () => void;
  onOpenSettings: () => void;
  onOpenViewSource: () => void;
}

export const ViaMenuSheet: React.FC<ViaMenuSheetProps> = ({
  isOpen,
  tab,
  settings,
  isBookmarked,
  isBottomBar,
  onClose,
  onToggleBookmark,
  onToggleReaderMode,
  onToggleDarkMode,
  onNewIncognitoTab,
  onToggleAdBlock,
  onToggleNoImages,
  onToggleUserAgent,
  onGoHome,
  onOpenBookmarksHistory,
  onOpenSettings,
  onOpenViewSource,
}) => {
  if (!isOpen) return null;

  const isWebPage = tab.url.startsWith('http://') || tab.url.startsWith('https://');

  const gridItems = [
    {
      id: 'bookmark',
      label: isBookmarked ? 'محفوظة' : 'إشارة مرجعية',
      icon: <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />,
      active: isBookmarked,
      disabled: !isWebPage,
      onClick: () => {
        onToggleBookmark();
        onClose();
      },
    },
    {
      id: 'reader',
      label: 'وضع القراءة',
      icon: <BookOpen className="w-5 h-5" />,
      active: tab.readerMode,
      disabled: !isWebPage || !tab.pageData,
      onClick: () => {
        onToggleReaderMode();
        onClose();
      },
    },
    {
      id: 'night',
      label: settings.darkMode ? 'الوضع النهاري' : 'الوضع الليلي',
      icon: settings.darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />,
      active: settings.darkMode,
      disabled: false,
      onClick: () => {
        onToggleDarkMode();
        onClose();
      },
    },
    {
      id: 'incognito',
      label: 'تبويب خفي',
      icon: <EyeOff className="w-5 h-5" />,
      active: tab.isIncognito,
      disabled: false,
      onClick: () => {
        onNewIncognitoTab();
        onClose();
      },
    },
    {
      id: 'adblock',
      label: 'مانع الإعلانات',
      icon: <ShieldCheck className="w-5 h-5" />,
      active: settings.adBlock,
      disabled: false,
      onClick: () => {
        onToggleAdBlock();
      },
    },
    {
      id: 'noimages',
      label: 'بدون صور',
      icon: <ImageOff className="w-5 h-5" />,
      active: settings.noImages,
      disabled: false,
      onClick: () => {
        onToggleNoImages();
      },
    },
    {
      id: 'history',
      label: 'المفضلة والسجل',
      icon: <History className="w-5 h-5" />,
      active: false,
      disabled: false,
      onClick: () => {
        onClose();
        onOpenBookmarksHistory();
      },
    },
    {
      id: 'settings',
      label: 'الإعدادات',
      icon: <Settings className="w-5 h-5" />,
      active: false,
      disabled: false,
      onClick: () => {
        onClose();
        onOpenSettings();
      },
    },
  ];

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex ${
        isBottomBar ? 'items-end justify-center' : 'items-start justify-end p-4 pt-16'
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="قائمة المتصفح السريعة"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full bg-white dark:bg-[#161B22] border border-slate-200 dark:border-slate-800 shadow-2xl ${
          isBottomBar
            ? 'max-w-lg rounded-t-3xl p-4 pb-6'
            : 'max-w-sm rounded-2xl p-4'
        }`}
      >
        {/* Drag affordance on bottom sheet */}
        {isBottomBar && (
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3" />
        )}

        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            قائمة فيا السريعة
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق القائمة"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4x2 Signature Via Grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {gridItems.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border text-center transition-colors min-h-[74px] cursor-pointer disabled:opacity-35 disabled:pointer-events-none ${
                item.active
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {item.icon}
              <span className="text-[11px] font-medium leading-tight">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Quick Utility Strip */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              onGoHome();
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[42px] cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>الرئيسية</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleUserAgent();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[42px] cursor-pointer"
          >
            {settings.userAgent === 'desktop' ? (
              <Smartphone className="w-3.5 h-3.5" />
            ) : (
              <Monitor className="w-3.5 h-3.5" />
            )}
            <span>{settings.userAgent === 'desktop' ? 'عرض الجوال' : 'عرض سطح المكتب'}</span>
          </button>

          {isWebPage && tab.pageData && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenViewSource();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[42px] cursor-pointer"
            >
              <Code className="w-3.5 h-3.5" />
              <span>المصدر</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
