'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Monitor, RotateCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Device = 'desktop' | 'mobile';

interface LivePreviewProps {
  /** 'project' or 'event' -- picks the template under /preview/. */
  template: 'project' | 'event';
  /** The site's own URL parameter value, i.e. the record's reference. */
  reference: string;
  /** The draft, already in the site's data/*.json shape. */
  data: unknown;
}

/**
 * Renders the real detail page from the static site, fed with unsaved draft
 * content instead of the published JSON.
 *
 * The frame asks for data rather than being pushed it: the template's shim
 * posts "ready" and parks its own data fetch until this component answers.
 * That removes the race where the parent posts before the frame is listening,
 * which is the usual way an iframe preview ends up blank.
 */
export function LivePreview({ template, reference, data }: LivePreviewProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [ready, setReady] = useState(false);
  const [nonce, setNonce] = useState(0);

  // Kept in a ref so the message handler always answers with the latest draft
  // without needing to be torn down and re-attached on every keystroke.
  const latest = useRef(data);
  latest.current = data;

  const post = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      { type: 'ehsan:preview-data', payload: latest.current },
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'ehsan:preview-ready') return;
      if (event.source !== frame.current?.contentWindow) return;
      setReady(true);
      post();
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post]);

  const src = `/preview/${template}.html?${template}=${encodeURIComponent(reference)}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          The real page, showing your unsaved changes. Nothing here is public yet.
        </p>

        <div className="flex items-center gap-1">
          <Button
            variant={device === 'desktop' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setDevice('desktop')}
            aria-pressed={device === 'desktop'}
          >
            <Monitor className="size-3.5" />
            Desktop
          </Button>
          <Button
            variant={device === 'mobile' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setDevice('mobile')}
            aria-pressed={device === 'mobile'}
          >
            <Smartphone className="size-3.5" />
            Mobile
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setReady(false);
              setNonce((n) => n + 1);
            }}
          >
            <RotateCw className="size-3.5" />
            Refresh
          </Button>

          <Button variant="ghost" size="sm" asChild>
            <a href={src} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              New tab
            </a>
          </Button>
        </div>
      </div>

      <div className="bg-muted/40 relative overflow-hidden rounded-lg border p-3">
        {!ready ? (
          <div className="absolute inset-3 z-10 space-y-3 rounded-md bg-white p-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}

        <iframe
          key={nonce}
          ref={frame}
          src={src}
          title={`${template} page preview`}
          onLoad={post}
          className={cn(
            'mx-auto block h-[68vh] rounded-md border bg-white transition-[width]',
            device === 'mobile' ? 'w-[390px]' : 'w-full',
          )}
          sandbox="allow-same-origin allow-scripts allow-popups"
        />
      </div>
    </div>
  );
}
