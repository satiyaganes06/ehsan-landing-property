'use client';

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/animate-ui/components/radix/sidebar';
import { Separator } from '@/components/ui/separator';
import { AppSidebar } from '@/components/app-sidebar';
import { SessionProvider, useSession } from '@/lib/session';
import { Skeleton } from '@/components/ui/skeleton';

function PanelChrome({ children }: { children: React.ReactNode }) {
  const { isLoading } = useSession();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-sm">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <span className="eyebrow text-muted-foreground">Content management</span>
        </header>

        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {/* The session gates permission-dependent UI everywhere below, so the
              first paint waits on it rather than flashing a nav the user may
              not be allowed to see. */}
          {isLoading ? <PanelSkeleton /> : children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function PanelSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PanelChrome>{children}</PanelChrome>
    </SessionProvider>
  );
}
