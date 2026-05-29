import { Folder, Download, Settings } from 'lucide-react';

interface BottomNavBarProps {
  activeTab: 'files' | 'downloads' | 'settings';
  setActiveTab: (tab: 'files' | 'downloads' | 'settings') => void;
  isAndroid?: boolean;
}

export function BottomNavBar({ activeTab, setActiveTab, isAndroid }: BottomNavBarProps) {
  const tabs = [
    { id: 'files' as const, label: 'Files', icon: Folder },
    { id: 'downloads' as const, label: 'Transfers', icon: Download },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <nav 
      className={`fixed left-4 right-4 bg-telegram-surface/85 backdrop-blur-xl border border-telegram-border/50 rounded-2xl shadow-2xl flex justify-around py-3 z-50 transition-all duration-300 ${
        isAndroid ? 'bottom-4' : 'bottom-5'
      }`}
      style={isAndroid ? { bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' } : undefined}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative px-4 py-1 ${
              isActive 
                ? 'text-telegram-primary scale-110' 
                : 'text-telegram-subtext hover:text-telegram-text active:scale-95'
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-[11px] font-bold tracking-wide uppercase">{label}</span>
            {isActive && (
              <span className="absolute -bottom-1 w-1.5 h-1.5 bg-telegram-primary rounded-full shadow-[0_0_8px_var(--telegram-primary)]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}