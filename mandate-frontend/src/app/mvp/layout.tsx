import type { ReactNode } from 'react';
import { TabBar } from '@/components/mvp/TabBar';
import { MvpAgentProvider } from './MvpAgentProvider';

export default function MvpLayout({ children }: { children: ReactNode }) {
  return (
    <MvpAgentProvider>
      <div className="min-h-screen bg-night-sky text-text-primary">
        <div className="mx-auto max-w-[420px] pb-20 px-4">{children}</div>
        <TabBar />
      </div>
    </MvpAgentProvider>
  );
}
