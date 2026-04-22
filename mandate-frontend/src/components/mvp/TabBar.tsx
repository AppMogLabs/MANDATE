'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMvpEvents } from '@/hooks/useMvpEvents';

interface Tab {
  readonly href: string;
  readonly label: string;
  readonly glyph: string;
}

const TABS: readonly Tab[] = [
  { href: '/mvp', label: 'Portfolio', glyph: '◐' },
  { href: '/mvp/mandate', label: 'Mandate', glyph: '◇' },
  { href: '/mvp/events', label: 'Events', glyph: '◈' },
  { href: '/mvp/leaderboard', label: 'Standings', glyph: '◉' },
];

export function TabBar() {
  const pathname = usePathname();
  const { unreadCount } = useMvpEvents();

  return (
    <nav className="fixed bottom-0 inset-x-0 border-t border-border-default bg-surface-1/95 backdrop-blur-sm">
      <div className="mx-auto max-w-[420px] grid grid-cols-4">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          const showDot = tab.href === '/mvp/events' && unreadCount > 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center justify-center py-2.5 text-xs transition-colors ${
                active ? 'text-moon-white' : 'text-text-secondary hover:text-moon-white'
              }`}
            >
              <span className="text-lg leading-none mb-1" aria-hidden>
                {tab.glyph}
              </span>
              <span className="text-[10px] tracking-wide uppercase">{tab.label}</span>
              {showDot && (
                <span className="absolute top-1.5 right-1/2 translate-x-[18px] w-1.5 h-1.5 rounded-full bg-status-critical" />
              )}
              {active && (
                <span className="absolute top-0 left-4 right-4 h-px bg-moon-white" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
