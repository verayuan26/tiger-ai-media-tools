import { Link, Outlet, useLocation } from 'react-router';
import { Database, HardDrive, Loader2, Settings, Tags } from 'lucide-react';
import { cn } from '../lib/utils';
import { Toaster } from '../components/ui/sonner';
import { useQueueSummary } from '../hooks/useQueueSummary';

export function RootLayout(): React.JSX.Element {
  const location = useLocation();
  const { badge: taskBadge } = useQueueSummary();

  const navItems = [
    { path: '/', icon: Database, label: '素材库' },
    { path: '/sources', icon: HardDrive, label: '导入来源' },
    { path: '/tasks', icon: Loader2, label: '任务队列', badge: taskBadge },
    { path: '/tags', icon: Tags, label: '标签管理' },
    { path: '/settings', icon: Settings, label: '设置' }
  ];

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">
      <aside
        aria-label="主导航"
        className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-full overflow-hidden border-r border-sidebar-border"
      >
        <div className="p-6">
          <h1 className="text-xl font-semibold tracking-tight text-sidebar-accent-foreground">AI 素材库</h1>
          <p className="text-sm text-sidebar-foreground mt-1">多媒体整理工具</p>
        </div>

        <nav className="flex-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="size-5" />
                <span className="flex-1">{item.label}</span>
                {'badge' in item && item.badge !== undefined && item.badge > 0 && (
                  <span className="bg-amber-500 text-black text-xs px-2 py-0.5 rounded-full font-semibold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground">v1.0.0 • 本地运行</div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
        <Outlet />
      </main>

      <Toaster />
    </div>
  );
}
