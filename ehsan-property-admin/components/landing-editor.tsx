'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Eye, EyeOff, ExternalLink, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { MediaPicker } from '@/components/media-picker';
import { PageHeader } from '@/components/page-header';
import { mediaSrc } from '@/lib/media';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '@/components/rich-text-editor';
import { StatisticCardsEditor } from '@/components/statistic-cards-editor';
import { SectionHeadingEditor } from '@/components/section-heading-editor';
import { GalleryImagesEditor } from '@/components/gallery-images-editor';

type Field = { key: string; group: string; type: string; label: string; value: string; category?: string; managed?: boolean };
const site = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:8899';
const NAMES: Record<string, string> = { hero: 'Hero', about: 'About Ehsan', gallery: 'Gallery', record: 'Projects', events: 'Events', awards: 'Awards', testimonials: 'Voices', commitment: 'Commitments', doctrine: 'Vision and mission', contact: 'Contact', topnav: 'Navigation', assistant: 'Chat assistant', seo: 'Search settings', theme: 'Colours and motion' };
const COLLECTIONS: Record<string, string> = { record: '/projects', events: '/events', awards: '/awards', testimonials: '/testimonials' };
const CATEGORIES = ['Heading', 'Content', 'Statistics', 'Images', 'Links and buttons', 'Form labels', 'Accessibility'];
const nameOf = (group: string) => NAMES[group] || (group.startsWith('chrome') ? 'Footer' : group);
const settingsGroup = (group: string) => ['topnav', 'assistant', 'seo', 'theme'].includes(group) || group.startsWith('chrome');

export function LandingEditor({ mode = 'page', initialSection }: { mode?: 'page' | 'settings' | 'section'; initialSection?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const previewBox = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState({ width: 400, height: 650 });
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState(initialSection || (mode === 'settings' ? 'theme' : 'hero'));
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failure, setFailure] = useState('');
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [deleteSection, setDeleteSection] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const { can } = useSession();
  const editable = can('block', 'update');
  const origin = new URL(site).origin;
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const viewportWidth = mobile ? 375 : 1280;
  const previewScale = Math.min(1, previewSize.width / viewportWidth);
  const valueOf = (field: Field) => values[field.key] ?? field.value;
  const change = (key: string, value: string) => setValues(current => ({ ...current, [key]: value }));
  const groups = [...new Set(fields.map(field => field.group))].filter(group => settingsGroup(group) === (mode === 'settings'));
  const orderField = (group: string) => fields.find(field => field.key === `${group}:order`);
  const ordered = groups.filter(group => orderField(group)).sort((a, b) => Number(values[`${a}:order`] ?? orderField(a)?.value) - Number(values[`${b}:order`] ?? orderField(b)?.value));
  const displayedGroups = mode === 'page' ? ['hero', ...ordered, 'contact'].filter(group => groups.includes(group)) : groups;
  const removedGroups = mode === 'page' ? displayedGroups.filter(group => values[`${group}:deleted`] === 'true') : [];
  const activeGroups = displayedGroups.filter(group => mode !== 'page' || values[`${group}:deleted`] !== 'true');
  const activeOrdered = ordered.filter(group => values[`${group}:deleted`] !== 'true');
  const sectionFields = fields.filter(field => field.group === selected && !field.managed && !field.key.endsWith(':order') && !field.key.endsWith(':visible') && `${field.label} ${valueOf(field)}`.toLowerCase().includes(search.toLowerCase()));
  const categoryOf = (field: Field) => field.category || (field.type === 'src' || field.type === 'alt' ? 'Images' : field.type === 'number' ? 'Statistics' : 'Content');

  useEffect(() => {
    const element = previewBox.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setPreviewSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    api.get<{ values: Record<string, string> }>('/api/landing').then(data => {
      if (active) { setValues(data.values); setSaved(data.values); setLoaded(true); }
    }).catch(error => { if (active) setFailure(error.message); });
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'ehsan:landing-fields' && Array.isArray(event.data.fields)) setFields(event.data.fields);
    };
    window.addEventListener('message', receive);
    return () => { active = false; window.removeEventListener('message', receive); };
  }, [origin]);

  useEffect(() => {
    if (loaded && fields.length) frame.current?.contentWindow?.postMessage({ type: 'ehsan:landing-preview', values }, origin);
  }, [values, fields, loaded, origin]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function select(group: string) {
    setSelected(group); setSearch('');
    frame.current?.contentWindow?.postMessage({ type: 'ehsan:landing-focus', group }, origin);
  }

  function move(source: string, target: string) {
    if (!editable || source === target || !ordered.includes(source) || !ordered.includes(target)) return;
    const next = [...ordered]; next.splice(next.indexOf(source), 1); next.splice(ordered.indexOf(target), 0, source);
    setValues(current => ({ ...current, ...Object.fromEntries(next.map((group, index) => [`${group}:order`, String(index)])) }));
    setDragging(null);
    toast.success(`${nameOf(source)} moved. Save to apply it to the website.`);
  }

  function removeSection(group: string) {
    if (!editable) return;
    change(`${group}:deleted`, 'true');
    if (selected === group) setSelected(activeGroups.find(item => item !== group) || '');
    setDeleteSection(null);
  }

  async function save() {
    setBusy(true);
    try { await api.put('/api/landing', { values }); setSaved({ ...values }); toast.success('Website changes saved.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save.'); }
    finally { setBusy(false); }
  }

  function renderField(field: Field) {
    const value = valueOf(field);
    const image = field.type === 'src';
    const rich = field.type === 'text' && field.group !== 'seo';
    return <div key={field.key} className="space-y-2">
      <div className="flex items-center justify-between gap-2"><label htmlFor={field.key} className="text-sm font-medium">{field.label}</label>{Object.hasOwn(values, field.key) && <button type="button" className="text-muted-foreground hover:text-foreground" title="Restore original" aria-label={`Restore ${field.label}`} disabled={!editable} onClick={() => setValues(current => { const next = { ...current }; delete next[field.key]; return next; })}><RotateCcw className="size-3.5" /></button>}</div>
      {image && field.group === 'hero' && <div className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground"><p className="font-medium text-foreground">Recommended background image</p><p>Landscape, 16:9. Use 2560 × 1440 px, or at least 1920 × 1080 px. WebP is preferred; JPEG is also suitable. Aim for 1 MB or less after compression.</p><p className="mt-1">Keep the main subject toward the centre or right, with clear space on the left for the headline. Backgrounds crop to fill the screen, especially on mobile. Avoid text embedded in the image.</p></div>}
      {field.type === 'heading' ? <SectionHeadingEditor id={field.key} value={value} disabled={!editable} onChange={next => change(field.key, next)} /> : field.type === 'gallery-images' ? <GalleryImagesEditor value={value} disabled={!editable} onChange={next => change(field.key, next)} /> : field.type === 'cards' ? <StatisticCardsEditor value={value} disabled={!editable} onChange={next => change(field.key, next)} /> : image ? <div className="space-y-2"><div className="bg-muted relative h-36 overflow-hidden rounded-lg border"><Image src={new URL(value || 'assets/logo/epp_logo.png', site).href} alt={field.label} fill unoptimized sizes="400px" className="object-contain" /></div><Button size="sm" variant="outline" disabled={!editable} onClick={() => setImageKey(field.key)}>Replace image</Button><details><summary className="text-muted-foreground cursor-pointer text-xs">Image URL</summary><Input id={field.key} className="mt-2" disabled={!editable} value={value} onChange={event => change(field.key, event.target.value)} /></details></div>
        : field.type === 'visible' ? <select id={field.key} className="w-full rounded border bg-background p-2" disabled={!editable} value={value} onChange={event => change(field.key, event.target.value)}><option value="true">Enabled</option><option value="false">Disabled</option></select>
        : rich ? <RichTextEditor id={field.key} label={field.label} disabled={!editable} value={value} html={values[`${field.key}:format`] === 'html' && Object.hasOwn(values, field.key)} onChange={html => setValues(current => ({ ...current, [field.key]: html, [`${field.key}:format`]: 'html' }))} />
        : <Input id={field.key} type={field.type === 'color' ? 'color' : field.type === 'number' ? 'number' : 'text'} step="any" disabled={!editable} value={value} onChange={event => change(field.key, event.target.value)} />}
    </div>;
  }

  return <div className="space-y-5">
    <PageHeader title={mode === 'page' ? 'Landing page' : mode === 'section' ? `${nameOf(selected)} section` : 'Website settings'} description={mode === 'page' ? 'Arrange your sections, edit their content and preview the result.' : mode === 'section' ? 'Manage the heading and appearance of this homepage section.' : 'Shared navigation, footer, brand colours and search settings.'} actions={<><span className="text-muted-foreground hidden text-xs sm:inline">{dirty ? 'Unsaved changes' : 'All changes saved'}</span><Button variant="outline" disabled={!dirty || busy} onClick={() => setValues({ ...saved })}>Discard</Button><Button disabled={!editable || !loaded || !dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</Button></>} />
    {failure && <p role="alert" className="rounded-lg border border-destructive p-4 text-sm">{failure}</p>}
    {mode === 'section' && <Link href={COLLECTIONS[selected] || '/landing'} className="inline-block text-sm text-muted-foreground hover:text-foreground">Back to {nameOf(selected)}</Link>}
    <div className={cn('grid items-start gap-4', mode === 'section' ? 'lg:grid-cols-[minmax(300px,1fr)_minmax(340px,1.1fr)]' : 'md:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(300px,1fr)_minmax(340px,1.1fr)]')}>
      {mode !== 'section' && <aside className="rounded-xl border bg-card p-3 md:sticky md:top-4">
        <h2 className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{mode === 'page' ? 'Page sections' : 'Settings'}</h2>
        {mode === 'page' && <p className="mb-3 px-2 text-xs text-muted-foreground">Drag sections to reorder. Hero and contact stay at the top and bottom.</p>}
        {!fields.length && <p className="px-2 py-4 text-sm text-muted-foreground">Loading website…</p>}
        <div className="space-y-1">{activeGroups.map(group => {
          const movable = ordered.includes(group); const position = activeOrdered.indexOf(group); const hidden = values[`${group}:visible`] === 'false';
          return <div key={group} draggable={editable && movable} onDragStart={event => { setDragging(group); event.dataTransfer.setData('text/plain', group); event.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDragging(null)} onDragOver={event => { if (editable && movable) event.preventDefault(); }} onDrop={event => { event.preventDefault(); move(dragging || event.dataTransfer.getData('text/plain'), group); }} className={cn('group flex items-center gap-1 rounded-lg border border-transparent px-1 py-2', selected === group && 'border-border bg-muted', dragging === group && 'opacity-40')}>
            {movable ? <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" /> : <span className="w-4" />}
            <button type="button" className={cn('min-w-0 flex-1 text-left text-sm', hidden && 'text-muted-foreground')} onClick={() => select(group)}>{nameOf(group)}</button>
            {hidden && <EyeOff className="size-3 text-muted-foreground" />}
            {movable && editable && <div className="flex flex-col"><button type="button" aria-label={`Move ${nameOf(group)} up`} disabled={position === 0} className="text-muted-foreground disabled:opacity-20" onClick={() => move(group, activeOrdered[position - 1])}><ArrowUp className="size-3" /></button><button type="button" aria-label={`Move ${nameOf(group)} down`} disabled={position === activeOrdered.length - 1} className="text-muted-foreground disabled:opacity-20" onClick={() => move(group, activeOrdered[position + 1])}><ArrowDown className="size-3" /></button></div>}
            {mode === 'page' && editable && <button type="button" className="p-1 text-muted-foreground hover:text-destructive" aria-label={`Remove ${nameOf(group)} section`} title={`Remove ${nameOf(group)} section`} onClick={() => setDeleteSection(group)}><Trash2 className="size-3.5" /></button>}
          </div>;
        })}</div>
        {mode === 'page' && !activeGroups.length && fields.length > 0 && <p className="px-2 py-3 text-sm text-muted-foreground">No sections. Restore one below.</p>}
        {removedGroups.length > 0 && <details className="mt-3 border-t pt-3"><summary className="cursor-pointer px-2 text-xs text-muted-foreground">Removed sections ({removedGroups.length})</summary><div className="mt-2 space-y-2">{removedGroups.map(group => <div key={group} className="flex items-center justify-between gap-2 px-2 text-xs"><span>{nameOf(group)}</span><button type="button" disabled={!editable} className="underline" aria-label={`Restore ${nameOf(group)} section`} onClick={() => { change(`${group}:deleted`, 'false'); select(group); }}>Restore</button></div>)}</div></details>}
        <div className="mt-4 border-t pt-3"><Link href={mode === 'page' ? '/website' : '/landing'} className="flex items-center justify-between px-2 text-xs text-muted-foreground">{mode === 'page' ? 'Website settings' : 'Back to page layout'}<ExternalLink className="size-3" /></Link></div>
      </aside>}
      <section className="rounded-xl border bg-card min-w-0">
        <div className="border-b p-4"><div className="flex items-center justify-between"><h2 className="font-medium">{nameOf(selected)}</h2>{fields.some(field => field.key === `${selected}:visible`) && <Button size="sm" variant="ghost" aria-label={`Toggle ${nameOf(selected)} visibility`} disabled={!editable} onClick={() => change(`${selected}:visible`, values[`${selected}:visible`] === 'false' ? 'true' : 'false')}>{values[`${selected}:visible`] === 'false' ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{values[`${selected}:visible`] === 'false' ? 'Hidden' : 'Visible'}</Button>}</div><Input className="mt-3" aria-label="Search section fields" placeholder="Search this section…" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
          {COLLECTIONS[selected] && <div className="rounded-lg bg-muted p-3 text-sm"><p className="mb-2 text-muted-foreground">Manage the cards in {nameOf(selected)}. Only this section’s heading and layout belong here.</p><Button asChild variant="outline" size="sm"><Link href={COLLECTIONS[selected]}>Manage {nameOf(selected)}<ExternalLink className="size-3" /></Link></Button></div>}
          {CATEGORIES.map(category => {
            const items = sectionFields.filter(field => categoryOf(field) === category);
            if (!items.length) return null;
            return <details key={`${selected}:${category}`} open={category !== 'Accessibility' && category !== 'Form labels'} className="rounded-lg border"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">{category}<span className="ml-2 text-xs font-normal text-muted-foreground">{items.length}</span></summary><div className="border-t px-4 py-4 space-y-5">{items.map(renderField)}</div></details>;
          })}
          {loaded && fields.length > 0 && !sectionFields.length && <p className="text-muted-foreground text-sm">No matching fields.</p>}
        </div>
      </section>
      <section className={cn('min-w-0 xl:sticky xl:top-4', mode !== 'section' && 'md:col-span-2 xl:col-span-1')}>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-medium">Live preview</h2><div className="flex gap-1"><Button size="sm" variant={mobile ? 'ghost' : 'outline'} onClick={() => setMobile(false)}>Desktop</Button><Button size="sm" variant={mobile ? 'outline' : 'ghost'} onClick={() => setMobile(true)}>Mobile</Button></div></div>
        <div ref={previewBox} className="relative h-[75vh] rounded-xl border bg-muted overflow-hidden"><iframe title="Homepage live preview" ref={frame} src={`${site}/index.html?landing-editor=1&rich-text=2&statistic-cards=3&grouped-gallery=1`} className="absolute top-0 origin-top-left border-0 bg-white" style={{ width: viewportWidth, height: previewSize.height / previewScale, transform: `scale(${previewScale})`, left: (previewSize.width - viewportWidth * previewScale) / 2 }} onLoad={() => frame.current?.contentWindow?.postMessage({ type: 'ehsan:landing-request' }, origin)} /></div>
      </section>
    </div>
    <Dialog open={deleteSection !== null} onOpenChange={open => { if (!open) setDeleteSection(null); }}>
      <DialogContent onOpenAutoFocus={event => { event.preventDefault(); document.getElementById('cancel-section-delete')?.focus(); }}>
        <DialogHeader>
          <DialogTitle>Delete {deleteSection ? nameOf(deleteSection) : ''} section?</DialogTitle>
          <DialogDescription>This section will be removed from the landing page when you save changes. Its content is kept, so you can restore it from Removed sections.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button id="cancel-section-delete" variant="outline" onClick={() => setDeleteSection(null)}>Cancel</Button>
          <Button variant="destructive" disabled={!editable} onClick={() => { if (deleteSection) removeSection(deleteSection); }}>Delete section</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <MediaPicker open={imageKey !== null} onOpenChange={open => { if (!open) setImageKey(null); }} onSelect={media => { if (imageKey) change(imageKey, new URL(mediaSrc(media.storageKey), window.location.origin).href); setImageKey(null); }} />
  </div>;
}
