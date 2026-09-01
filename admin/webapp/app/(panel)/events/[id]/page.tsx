'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft, ExternalLink, GripVertical, Image as ImageIcon, Loader2, Plus, Save, Trash2,
} from 'lucide-react';

import {
  Tabs, TabsContent, TabsContents, TabsList, TabsTrigger,
} from '@/components/animate-ui/components/radix/tabs';
import { Switch } from '@/components/animate-ui/components/radix/switch';
import { MediaPicker } from '@/components/media-picker';
import { AltTextField } from '@/components/alt-text-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { PublishPill } from '@/components/state-pills';
import { PermissionButton } from '@/components/permission-button';
import { ErrorState } from '@/components/states';
import { SeoPanel, type SeoDraft } from '@/components/seo-panel';
import { LivePreview } from '@/components/live-preview';
import { toSiteEvent, toHeroSrc } from '@/lib/preview';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { AgendaItem, EventDetail, MediaItem, SeoMeta } from '@/lib/types';

interface Draft {
  startsAt: string;
  endsAt: string;
  capacity: string;
  registered: string;
  priceText: string;
  title: string;
  category: string;
  location: string;
  description: string;
  /** Whether the page shows an agenda at all. Kept separate from the list so
      switching it off does not throw away what has already been typed. */
  agendaEnabled: boolean;
  agenda: AgendaItem[];
  /** The single image at the top of the event page. Either a library image
      (id + key) or, for the imported events, a plain external URL. */
  heroMediaId: string | null;
  heroStorageKey: string | null;
  heroImageUrl: string;
  /** Description of the chosen library image, edited in place below it. */
  heroAltText: string;
}

/** <input type="datetime-local"> wants local time with no zone suffix. */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { can } = useSession();

  const event = useQuery({
    queryKey: ['events', id],
    queryFn: () => api.get<EventDetail>(`/api/events/${id}`),
  });

  const seo = useQuery({
    queryKey: ['seo', 'event', id],
    queryFn: () => api.get<SeoMeta[]>(`/api/seo/event/${id}`),
  });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [seoDraft, setSeoDraft] = useState<SeoDraft | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Seed the editable copy once per record. Publishing (and any other write)
  // invalidates the list key, which prefix-matches this record and refetches
  // it -- without this guard that refetch would reset the form and silently
  // discard whatever was being typed.
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    const data = event.data;
    if (!data) return;
    if (seededFor.current === data.id) return;
    seededFor.current = data.id;
    const t = data.translations.find((x) => x.locale === 'EN');
    setDraft({
      startsAt: toLocalInput(data.startsAt),
      endsAt: toLocalInput(data.endsAt),
      capacity: data.capacity != null ? String(data.capacity) : '',
      registered: data.registered != null ? String(data.registered) : '',
      priceText: data.priceText ?? '',
      title: t?.title ?? '',
      category: t?.category ?? '',
      location: t?.location ?? '',
      description: t?.description ?? '',
      agendaEnabled: (t?.agenda ?? []).length > 0,
      agenda: t?.agenda ?? [],
      heroMediaId: data.heroMediaId ?? null,
      heroStorageKey: data.heroMedia?.storageKey ?? null,
      heroImageUrl: data.heroImageUrl ?? '',
      heroAltText: data.heroMedia?.altText ?? '',
    });
  }, [event.data]);

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

  // Switching the agenda off publishes no agenda, without clearing the rows.
  const agendaToSave = draft?.agendaEnabled ? draft.agenda : [];

  // The same resolution the preview uses, so the thumbnail here and the hero
  // in the preview can never disagree.
  const heroSrc = draft ? toHeroSrc(draft.heroStorageKey, draft.heroImageUrl) : '';

  const isDirty = useMemo(() => {
    const data = event.data;
    if (!data || !draft) return false;
    const t = data.translations.find((x) => x.locale === 'EN');
    return (
      draft.startsAt !== toLocalInput(data.startsAt) ||
      draft.endsAt !== toLocalInput(data.endsAt) ||
      draft.capacity !== (data.capacity != null ? String(data.capacity) : '') ||
      draft.registered !== (data.registered != null ? String(data.registered) : '') ||
      draft.priceText !== (data.priceText ?? '') ||
      draft.title !== (t?.title ?? '') ||
      draft.category !== (t?.category ?? '') ||
      draft.location !== (t?.location ?? '') ||
      draft.description !== (t?.description ?? '') ||
      JSON.stringify(draft.agendaEnabled ? draft.agenda : []) !==
        JSON.stringify(t?.agenda ?? []) ||
      draft.heroMediaId !== (data.heroMediaId ?? null) ||
      draft.heroImageUrl !== (data.heroImageUrl ?? '')
    );
  }, [event.data, draft]);

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

  useEffect(() => {
    if (!hasChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasChanges]);

  function updateAgendaItem(index: number, patch: Partial<AgendaItem>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            agenda: current.agenda.map((item, i) => (i === index ? { ...item, ...patch } : item)),
          }
        : current,
    );
  }

  function addAgendaItem() {
    setDraft((current) =>
      current
        ? { ...current, agenda: [...current.agenda, { time: '', title: '', description: '' }] }
        : current,
    );
  }

  function removeAgendaItem(index: number) {
    setDraft((current) =>
      current ? { ...current, agenda: current.agenda.filter((_, i) => i !== index) } : current,
    );
  }

  /** Agenda order is the running order, so it has to be rearrangeable. */
  function moveAgendaItem(index: number, delta: number) {
    setDraft((current) => {
      if (!current) return current;
      const next = [...current.agenda];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, agenda: next };
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      if (isDirty) {
        await api.patch(`/api/events/${id}`, {
          startsAt: new Date(draft.startsAt).toISOString(),
          endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
          capacity: draft.capacity ? Number(draft.capacity) : null,
          registered: draft.registered ? Number(draft.registered) : 0,
          priceText: draft.priceText || null,
          heroMediaId: draft.heroMediaId,
          heroImageUrl: draft.heroImageUrl || null,
        });
        const t = event.data?.translations.find((x) => x.locale === 'EN');
        await api.put(`/api/events/${id}/translations/EN`, {
          title: draft.title,
          category: draft.category,
          location: draft.location,
          description: draft.description,
          agenda: agendaToSave,
          speakers: t?.speakers ?? [],
        });
      }
      if (seoDirty && seoDraft) {
        await api.put(`/api/seo/event/${id}/EN`, {
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
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        queryClient.invalidateQueries({ queryKey: ['seo', 'event', id] }),
      ]);
      toast.success('Changes saved.', {
        description:
          event.data?.publishState === 'PUBLISHED'
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
    mutationFn: (next: 'publish' | 'unpublish') => api.post(`/api/events/${id}/${next}`),
    onSuccess: async (_data, next) => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(next === 'publish' ? 'Published.' : 'Unpublished.', {
        description:
          next === 'publish'
            ? 'The live site data has been updated.'
            : 'This event no longer appears on the site.',
      });
    },
    onError: (err) =>
      toast.error('Could not change publish state', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

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

  if (event.isError) {
    return (
      <div className="mx-auto w-full max-w-2xl py-10">
        <ErrorState error={event.error} onRetry={() => event.refetch()} />
      </div>
    );
  }

  const data = event.data;
  const tab = searchParams.get('tab') ?? 'content';
  const published = data?.publishState === 'PUBLISHED';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/events"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          All events
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            {data ? (
              <h1 className="font-display truncate text-2xl leading-tight font-semibold tracking-tight">
                {draft?.title || '(untitled)'}
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
              resource="event"
              action="update"
              onClick={() => save.mutate()}
              disabled={!hasChanges || save.isPending}
            >
              {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {save.isPending ? 'Saving…' : 'Save'}
            </PermissionButton>

            <PermissionButton
              resource="event"
              action="publish"
              variant="outline"
              onClick={() => publish.mutate(published ? 'unpublish' : 'publish')}
              disabled={publish.isPending}
            >
              {publish.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {published ? 'Unpublish' : 'Publish'}
            </PermissionButton>
          </div>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => router.replace(`/events/${id}?tab=${value}`, { scroll: false })}
      >
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="seo">Search listing</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContents>
          <TabsContent value="content" className="pt-5">
            {draft ? (
              <fieldset disabled={!can('event', 'update')} className="grid gap-6 lg:grid-cols-2">
                <section className="bg-card space-y-4 rounded-lg border p-5 lg:col-span-2">
                  <div className="space-y-0.5">
                    <h2 className="text-sm font-medium">Hero image</h2>
                    <p className="text-muted-foreground text-xs">
                      Shown full width at the top of the event page, behind the title.
                    </p>
                  </div>

                  {heroSrc ? (
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="w-full max-w-sm space-y-2">
                        <div className="bg-muted h-32 overflow-hidden rounded-md border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={heroSrc}
                            alt={
                              draft.heroAltText || `Hero image for ${draft.title || 'this event'}`
                            }
                            className="size-full object-cover"
                          />
                        </div>

                        {draft.heroMediaId ? (
                          <AltTextField
                            mediaId={draft.heroMediaId}
                            value={draft.heroAltText}
                            // Refetching the event here would reseed the whole
                            // form and drop any unsaved edits, so update in place.
                            onSaved={(heroAltText) =>
                              setDraft((current) => (current ? { ...current, heroAltText } : current))
                            }
                          />
                        ) : (
                          <p className="text-muted-foreground text-xs">
                            This image is linked by web address, so it has no entry in the media
                            library to describe. Replace it with a library image to add a
                            description.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPickerOpen(true)}
                        >
                          <ImageIcon className="size-3.5" />
                          Replace image
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              heroMediaId: null,
                              heroStorageKey: null,
                              heroImageUrl: '',
                              heroAltText: '',
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="text-muted-foreground hover:border-brass-line/60 hover:text-foreground flex h-32 w-full max-w-sm flex-col items-center justify-center gap-1.5 rounded-md border border-dashed transition-colors"
                    >
                      <ImageIcon className="size-5" />
                      <span className="text-sm">Add an image</span>
                    </button>
                  )}
                </section>

                <section className="bg-card space-y-4 rounded-lg border p-5">
                  <h2 className="text-sm font-medium">What people read</h2>

                  <div className="space-y-2">
                    <Label htmlFor="title">Event title</Label>
                    <Input
                      id="title"
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={draft.category}
                      onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                      placeholder="e.g. Property Launch"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Venue</Label>
                    <Input
                      id="location"
                      value={draft.location}
                      onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      rows={6}
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    />
                  </div>
                </section>

                <section className="bg-card h-fit space-y-4 rounded-lg border p-5">
                  <h2 className="text-sm font-medium">When and how many</h2>

                  <div className="space-y-2">
                    <Label htmlFor="startsAt">Starts</Label>
                    <Input
                      id="startsAt"
                      type="datetime-local"
                      value={draft.startsAt}
                      onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endsAt">Ends</Label>
                    <Input
                      id="endsAt"
                      type="datetime-local"
                      value={draft.endsAt}
                      onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
                    />
                    <p className="text-muted-foreground text-xs">Leave blank for a single-session event.</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="capacity">Capacity</Label>
                      <Input
                        id="capacity"
                        type="number"
                        min={0}
                        value={draft.capacity}
                        onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registered">Registered</Label>
                      <Input
                        id="registered"
                        type="number"
                        min={0}
                        value={draft.registered}
                        onChange={(e) => setDraft({ ...draft, registered: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priceText">Price</Label>
                    <Input
                      id="priceText"
                      value={draft.priceText}
                      onChange={(e) => setDraft({ ...draft, priceText: e.target.value })}
                      placeholder="Leave blank if the event is free"
                    />
                  </div>
                </section>

                <section className="bg-card space-y-4 rounded-lg border p-5 lg:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <h2 className="text-sm font-medium">Agenda</h2>
                      <p className="text-muted-foreground text-xs">
                        The running order shown on the event page.
                      </p>
                    </div>

                    <label className="flex cursor-pointer items-center gap-2.5">
                      <span className="text-sm">
                        {draft.agendaEnabled ? 'Shown on the page' : 'Hidden'}
                      </span>
                      <Switch
                        checked={draft.agendaEnabled}
                        onCheckedChange={(agendaEnabled) =>
                          setDraft({ ...draft, agendaEnabled })
                        }
                        aria-label="Show an agenda on this event page"
                      />
                    </label>
                  </div>

                  {draft.agendaEnabled ? (
                    <div className="space-y-3">
                      {draft.agenda.length === 0 ? (
                        <p className="text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm">
                          No agenda items yet. Add the first one below.
                        </p>
                      ) : (
                        <ol className="space-y-3">
                          {draft.agenda.map((item, index) => (
                            <li
                              key={index}
                              className="bg-background grid gap-3 rounded-md border p-3 sm:grid-cols-[7rem_minmax(0,1fr)_auto]"
                            >
                              <div className="space-y-1.5">
                                <Label htmlFor={`agenda-time-${index}`} className="text-xs">
                                  Time
                                </Label>
                                <Input
                                  id={`agenda-time-${index}`}
                                  value={item.time}
                                  placeholder="2:00 PM"
                                  className="font-mono"
                                  onChange={(e) =>
                                    updateAgendaItem(index, { time: e.target.value })
                                  }
                                />
                              </div>

                              <div className="space-y-3">
                                <div className="space-y-1.5">
                                  <Label htmlFor={`agenda-title-${index}`} className="text-xs">
                                    Title
                                  </Label>
                                  <Input
                                    id={`agenda-title-${index}`}
                                    value={item.title}
                                    placeholder="Welcome & Arrival"
                                    onChange={(e) =>
                                      updateAgendaItem(index, { title: e.target.value })
                                    }
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <Label
                                    htmlFor={`agenda-description-${index}`}
                                    className="text-xs"
                                  >
                                    Subtitle
                                  </Label>
                                  <Input
                                    id={`agenda-description-${index}`}
                                    value={item.description}
                                    placeholder="Registration and networking"
                                    onChange={(e) =>
                                      updateAgendaItem(index, { description: e.target.value })
                                    }
                                  />
                                </div>
                              </div>

                              <div className="flex flex-row gap-1 sm:flex-col">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Move item ${index + 1} up`}
                                  disabled={index === 0}
                                  onClick={() => moveAgendaItem(index, -1)}
                                >
                                  <GripVertical className="size-3.5 rotate-90" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  aria-label={`Remove item ${index + 1}`}
                                  onClick={() => removeAgendaItem(index)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}

                      <Button type="button" variant="outline" size="sm" onClick={addAgendaItem}>
                        <Plus className="size-3.5" />
                        Add item
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      The agenda section won&rsquo;t appear on the event page. Turning this back on
                      restores what you had typed.
                    </p>
                  )}
                </section>
              </fieldset>
            ) : (
              <FormSkeleton />
            )}
          </TabsContent>

          <TabsContent value="seo" className="pt-5">
            {seoRow && seoDraft ? (
              <SeoPanel
                seo={seoRow}
                draft={seoDraft}
                onChange={(patch) => setSeoDraft((d) => (d ? { ...d, ...patch } : d))}
                previewUrl={`ehsanproperty.com/event/${
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
            {event.data && draft ? (
              <LivePreview
                template="event"
                reference={event.data.reference}
                data={toSiteEvent(event.data, draft)}
              />
            ) : (
              <FormSkeleton />
            )}
          </TabsContent>
        </TabsContents>
      </Tabs>

      {draft ? (
        <MediaPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          selectedId={draft.heroMediaId}
          onSelect={(media: MediaItem) =>
            setDraft({
              ...draft,
              heroMediaId: media.id,
              heroStorageKey: media.storageKey ?? null,
              heroAltText: media.altText ?? '',
              // A library image wins over any URL that was set before.
              heroImageUrl: '',
            })
          }
        />
      ) : null}
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
