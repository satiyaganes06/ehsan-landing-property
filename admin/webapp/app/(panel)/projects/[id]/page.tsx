'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft, ExternalLink, Image as ImageIcon, Loader2, Plus, Save, Trash2,
} from 'lucide-react';

import {
  Tabs, TabsContent, TabsContents, TabsList, TabsTrigger,
} from '@/components/animate-ui/components/radix/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { PublishPill } from '@/components/state-pills';
import { PermissionButton } from '@/components/permission-button';
import { ErrorState, EmptyState } from '@/components/states';
import { SeoPanel, type SeoDraft } from '@/components/seo-panel';
import { LivePreview } from '@/components/live-preview';
import { MediaPicker } from '@/components/media-picker';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { AltTextField } from '@/components/alt-text-field';
import { toSiteProject } from '@/lib/preview';
import { mediaSrc } from '@/lib/media';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { MediaItem, ProjectDetail, SeoMeta } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ContentDraft {
  status: ProjectDetail['status'];
  yearStart: string;
  yearEnd: string;
  units: string;
  areaText: string;
  priceRange: string;
  occupancy: string;
  name: string;
  location: string;
  description: string;
  certificate: string;
}

export default function ProjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { can } = useSession();

  const project = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<ProjectDetail>(`/api/projects/${id}`),
  });

  const seo = useQuery({
    queryKey: ['seo', 'project', id],
    queryFn: () => api.get<SeoMeta[]>(`/api/seo/project/${id}`),
  });

  const [content, setContent] = useState<ContentDraft | null>(null);
  const [seoDraft, setSeoDraft] = useState<SeoDraft | null>(null);

  // Seed the editable copy once the record arrives. Keyed on the loaded id so
  // navigating between projects reseeds rather than carrying the old draft.
  // Seed the editable copy once per record. Publishing (and any other write)
  // invalidates the list key, which prefix-matches this record and refetches
  // it -- without this guard that refetch would reset the form and silently
  // discard whatever was being typed.
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    const data = project.data;
    if (!data) return;
    if (seededFor.current === data.id) return;
    seededFor.current = data.id;
    const t = data.translations.find((x) => x.locale === 'EN');
    setContent({
      status: data.status,
      yearStart: data.yearStart ?? '',
      yearEnd: data.yearEnd ?? '',
      units: data.units ?? '',
      areaText: data.areaText ?? '',
      priceRange: data.priceRange ?? '',
      occupancy: data.occupancy ?? '',
      name: t?.name ?? '',
      location: t?.location ?? '',
      description: t?.description ?? '',
      certificate: t?.certificate ?? '',
    });
  }, [project.data]);

  useEffect(() => {
    const row = seo.data?.find((x) => x.locale === 'EN');
    if (!row) return;
    setSeoDraft({
      metaTitle: row.metaTitle ?? '',
      metaDescription: row.metaDescription ?? '',
      focusKeyword: row.focusKeyword ?? '',
      canonicalUrl: row.canonicalUrl ?? '',
      robotsIndex: row.robotsIndex,
      robotsFollow: row.robotsFollow,
    });
  }, [seo.data]);

  const seoRow = seo.data?.find((x) => x.locale === 'EN');

  const isDirty = useMemo(() => {
    const data = project.data;
    if (!data || !content) return false;
    const t = data.translations.find((x) => x.locale === 'EN');
    return (
      content.status !== data.status ||
      content.yearStart !== (data.yearStart ?? '') ||
      content.yearEnd !== (data.yearEnd ?? '') ||
      content.units !== (data.units ?? '') ||
      content.areaText !== (data.areaText ?? '') ||
      content.priceRange !== (data.priceRange ?? '') ||
      content.occupancy !== (data.occupancy ?? '') ||
      content.name !== (t?.name ?? '') ||
      content.location !== (t?.location ?? '') ||
      content.description !== (t?.description ?? '') ||
      content.certificate !== (t?.certificate ?? '')
    );
  }, [project.data, content]);

  const seoDirty = useMemo(() => {
    if (!seoRow || !seoDraft) return false;
    return (
      seoDraft.metaTitle !== (seoRow.metaTitle ?? '') ||
      seoDraft.metaDescription !== (seoRow.metaDescription ?? '') ||
      seoDraft.focusKeyword !== (seoRow.focusKeyword ?? '') ||
      seoDraft.canonicalUrl !== (seoRow.canonicalUrl ?? '') ||
      seoDraft.robotsIndex !== seoRow.robotsIndex ||
      seoDraft.robotsFollow !== seoRow.robotsFollow
    );
  }, [seoRow, seoDraft]);

  const hasChanges = isDirty || seoDirty;

  // Leaving with unsaved edits is almost always an accident.
  useEffect(() => {
    if (!hasChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasChanges]);

  const save = useMutation({
    mutationFn: async () => {
      if (!content) return;
      if (isDirty) {
        await api.patch(`/api/projects/${id}`, {
          status: content.status,
          yearStart: content.yearStart || null,
          yearEnd: content.yearEnd || null,
          units: content.units || null,
          areaText: content.areaText || null,
          priceRange: content.priceRange || null,
          occupancy: content.occupancy || null,
        });
        await api.put(`/api/projects/${id}/translations/EN`, {
          name: content.name,
          location: content.location,
          description: content.description,
          certificate: content.certificate || null,
          amenities: project.data?.translations.find((t) => t.locale === 'EN')?.amenities ?? [],
        });
      }
      if (seoDirty && seoDraft) {
        await api.put(`/api/seo/project/${id}/EN`, {
          metaTitle: seoDraft.metaTitle || null,
          metaDescription: seoDraft.metaDescription || null,
          focusKeyword: seoDraft.focusKeyword || null,
          canonicalUrl: seoDraft.canonicalUrl || null,
          robotsIndex: seoDraft.robotsIndex,
          robotsFollow: seoDraft.robotsFollow,
        });
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['seo', 'project', id] }),
      ]);
      toast.success('Changes saved.', {
        description: project.data?.publishState === 'PUBLISHED'
          ? 'Publish again to push them to the live site.'
          : undefined,
      });
    },
    onError: (err) =>
      toast.error('Could not save', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  const publish = useMutation({
    mutationFn: () => api.post(`/api/projects/${id}/publish`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Published.', { description: 'The live site data has been updated.' });
    },
    onError: (err) =>
      toast.error('Could not publish', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  // ⌘S saves, the way every editor the client already uses behaves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (hasChanges && !save.isPending) save.mutate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasChanges, save]);

  if (project.isError) {
    return (
      <div className="mx-auto w-full max-w-2xl py-10">
        <ErrorState error={project.error} onRetry={() => project.refetch()} />
      </div>
    );
  }

  const data = project.data;
  const tab = searchParams.get('tab') ?? 'content';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/projects"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          All projects
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            {data ? (
              <h1 className="font-display truncate text-2xl leading-tight font-semibold tracking-tight">
                {content?.name || '(untitled)'}
              </h1>
            ) : (
              <Skeleton className="h-8 w-72" />
            )}
            <div className="flex flex-wrap items-center gap-2">
              {data ? <PublishPill state={data.publishState} /> : null}
              {data ? (
                <span className="text-muted-foreground font-mono text-xs">{data.reference}</span>
              ) : null}
              {hasChanges ? (
                <span className="text-sand inline-flex items-center gap-1.5 text-xs">
                  <span className="bg-sand size-1.5 rounded-full" aria-hidden />
                  Unsaved changes
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <PermissionButton
              resource="project"
              action="update"
              variant="default"
              onClick={() => save.mutate()}
              disabled={!hasChanges || save.isPending}
            >
              {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {save.isPending ? 'Saving…' : 'Save'}
            </PermissionButton>

            <PermissionButton
              resource="project"
              action="publish"
              variant="outline"
              onClick={() => publish.mutate()}
              disabled={publish.isPending}
            >
              {publish.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {data?.publishState === 'PUBLISHED' ? 'Republish' : 'Publish'}
            </PermissionButton>
          </div>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => router.replace(`/projects/${id}?tab=${value}`, { scroll: false })}
      >
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="media">Images</TabsTrigger>
          <TabsTrigger value="seo">Search listing</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContents>
        <TabsContent value="content" className="pt-5">
          {content ? (
            <ContentTab draft={content} onChange={setContent} readOnly={!can('project', 'update')} />
          ) : (
            <FormSkeleton />
          )}
        </TabsContent>

        <TabsContent value="media" className="pt-5">
          {data ? <MediaTab project={data} /> : <FormSkeleton />}
        </TabsContent>

        <TabsContent value="seo" className="pt-5">
          {seoRow && seoDraft ? (
            <SeoPanel
              seo={seoRow}
              draft={seoDraft}
              onChange={(patch) => setSeoDraft((d) => (d ? { ...d, ...patch } : d))}
              previewUrl={`ehsanproperty.com/project/${
                data?.translations.find((t) => t.locale === 'EN')?.slug ?? ''
              }`}
            />
          ) : seo.isError ? (
            <ErrorState error={seo.error} onRetry={() => seo.refetch()} />
          ) : (
            <FormSkeleton />
          )}
        </TabsContent>

        <TabsContent value="preview" className="pt-5">
          {project.data && content ? (
            <LivePreview
              template="project"
              reference={project.data.reference}
              data={toSiteProject(project.data, {
                ...content,
                amenities:
                  project.data.translations.find((t) => t.locale === 'EN')?.amenities ?? [],
                certificate: content.certificate || null,
              })}
            />
          ) : (
            <FormSkeleton />
          )}
        </TabsContent>
        </TabsContents>
      </Tabs>
    </div>
  );
}

function ContentTab({
  draft,
  onChange,
  readOnly,
}: {
  draft: ContentDraft;
  onChange: (next: ContentDraft) => void;
  readOnly: boolean;
}) {
  const set = <K extends keyof ContentDraft>(key: K, value: ContentDraft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <fieldset disabled={readOnly} className="grid gap-6 lg:grid-cols-2">
      <section className="bg-card space-y-4 rounded-lg border p-5">
        <h2 className="text-sm font-medium">What people read</h2>

        <div className="space-y-2">
          <Label htmlFor="name">Project name</Label>
          <Input id="name" value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={draft.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Town, State"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={6}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Shown on the project page and used to grade the search listing.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="certificate">Certificate</Label>
          <Input
            id="certificate"
            value={draft.certificate}
            onChange={(e) => set('certificate', e.target.value)}
            placeholder="e.g. Phases 1–4 Certificate of Completion and Compliance"
          />
        </div>
      </section>

      <section className="bg-card h-fit space-y-4 rounded-lg border p-5">
        <h2 className="text-sm font-medium">The facts</h2>

        <div className="space-y-2">
          <Label htmlFor="status">Stage</Label>
          <select
            id="status"
            value={draft.status}
            onChange={(e) => set('status', e.target.value as ContentDraft['status'])}
            className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-3 focus-visible:outline-none"
          >
            <option value="ONGOING">Ongoing</option>
            <option value="COMPLETED">Completed</option>
            <option value="FUTURE">Planned</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="yearStart">Start</Label>
            <Input id="yearStart" value={draft.yearStart} onChange={(e) => set('yearStart', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="yearEnd">Finish</Label>
            <Input
              id="yearEnd"
              value={draft.yearEnd}
              onChange={(e) => set('yearEnd', e.target.value)}
              placeholder="on-going"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="units">Units</Label>
          <Input
            id="units"
            value={draft.units}
            onChange={(e) => set('units', e.target.value)}
            placeholder="e.g. 238 units"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="areaText">Tenure</Label>
          <Input
            id="areaText"
            value={draft.areaText}
            onChange={(e) => set('areaText', e.target.value)}
            placeholder="e.g. 99-year leasehold"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="priceRange">Value</Label>
          <Input
            id="priceRange"
            value={draft.priceRange}
            onChange={(e) => set('priceRange', e.target.value)}
            placeholder="e.g. RM 90M GDV"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="occupancy">Completion note</Label>
          <Input
            id="occupancy"
            value={draft.occupancy}
            onChange={(e) => set('occupancy', e.target.value)}
          />
        </div>
      </section>
    </fieldset>
  );
}

/** The two buckets the project page actually renders: the photo carousel and
    the separate blueprint gallery behind the "Blueprint" switcher. */
const MEDIA_ROLES = [
  { role: 'gallery', label: 'Photos', blurb: 'Shown in the carousel and gallery grid.' },
  { role: 'blueprint', label: 'Blueprints', blurb: 'Shown behind the Blueprint switcher.' },
] as const;

type MediaRole = (typeof MEDIA_ROLES)[number]['role'];

function MediaTab({ project }: { project: ProjectDetail }) {
  const queryClient = useQueryClient();
  const { can } = useSession();

  // Which bucket the picker is adding into. null means the picker is closed.
  const [pickerRole, setPickerRole] = useState<MediaRole | null>(null);
  const [pendingRemove, setPendingRemove] = useState<
    { linkId: string; filename: string } | null
  >(null);

  const media = project.media ?? [];
  const editable = can('project', 'update');

  const attach = useMutation({
    mutationFn: ({ mediaId, role }: { mediaId: string; role: MediaRole }) =>
      api.post(`/api/projects/${project.id}/media`, {
        mediaId,
        role,
        sortOrder: media.filter((m) => m.role === role).length,
      }),
    onSuccess: async (_data, { role }) => {
      await queryClient.invalidateQueries({ queryKey: ['projects', project.id] });
      toast.success(role === 'blueprint' ? 'Blueprint added.' : 'Photo added.');
    },
    onError: (err) =>
      toast.error('Could not add the image', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  const detach = useMutation({
    mutationFn: (linkId: string) =>
      api.delete(`/api/projects/${project.id}/media/${linkId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects', project.id] });
      toast.success('Image removed.', { description: 'It stays in the media library.' });
      setPendingRemove(null);
    },
    onError: (err) =>
      toast.error('Could not remove the image', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  return (
    <div className="space-y-8">
      {MEDIA_ROLES.map(({ role, label, blurb }) => {
        const items = media
          .filter((link) => (link.role ?? 'gallery') === role)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        return (
          <section key={role} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-sm font-medium">
                  {label}
                  <span className="text-muted-foreground ml-2 font-mono text-xs tabular-nums">
                    {items.length}
                  </span>
                </h2>
                <p className="text-muted-foreground text-xs">{blurb}</p>
              </div>

              {editable ? (
                <Button variant="outline" size="sm" onClick={() => setPickerRole(role)}>
                  <Plus className="size-3.5" />
                  Add {role === 'blueprint' ? 'blueprint' : 'photo'}
                </Button>
              ) : null}
            </div>

            {items.length === 0 ? (
              <button
                type="button"
                disabled={!editable}
                onClick={() => setPickerRole(role)}
                className="text-muted-foreground enabled:hover:border-brass-line/60 enabled:hover:text-foreground flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed transition-colors disabled:cursor-default"
              >
                <ImageIcon className="size-5" />
                <span className="text-sm">
                  {editable
                    ? `Add the first ${role === 'blueprint' ? 'blueprint' : 'photo'}`
                    : `No ${label.toLowerCase()} yet`}
                </span>
              </button>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((link) => (
                  <figure key={link.id} className="bg-card overflow-hidden rounded-lg border">
                    <div className="bg-muted relative aspect-4/3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mediaSrc(link.media.storageKey, link.media.url)}
                        alt={link.media.altText || `${link.media.filename} — no description added yet`}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                      {editable ? (
                        <Button
                          variant="secondary"
                          size="icon"
                          aria-label={`Remove ${link.media.filename}`}
                          className="absolute top-2 right-2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 hover:opacity-100"
                          onClick={() =>
                            setPendingRemove({
                              linkId: link.id,
                              filename: link.media.filename,
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                    <figcaption className="space-y-1.5 p-3">
                      <p className="truncate text-xs font-medium">{link.media.filename}</p>
                      <AltTextField
                        mediaId={link.media.id}
                        value={link.media.altText}
                        invalidate={[['projects', project.id]]}
                      />
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <MediaPicker
        open={pickerRole !== null}
        onOpenChange={(open) => (open ? null : setPickerRole(null))}
        onSelect={(media: MediaItem) => {
          if (pickerRole) attach.mutate({ mediaId: media.id, role: pickerRole });
        }}
      />

      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => (open ? null : setPendingRemove(null))}
        title={`Remove ${pendingRemove?.filename} from this project?`}
        description="The image stays in the media library and can be added again."
        confirmLabel="Remove"
        onConfirm={() => pendingRemove && detach.mutate(pendingRemove.linkId)}
      />
    </div>
  );
}


function FormSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[0, 1].map((col) => (
        <div key={col} className="bg-card space-y-4 rounded-lg border p-5">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
