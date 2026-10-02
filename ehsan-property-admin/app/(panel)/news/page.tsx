'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { latestNews, type NewsArticle } from '@/lib/news';
import { PageHeader } from '@/components/page-header';
import { PaginationBar, usePagination } from '@/components/pagination-bar';
import { RichTextEditor } from '@/components/rich-text-editor';
import { MediaPicker } from '@/components/media-picker';
import { mediaSrc } from '@/lib/media';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const site = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:8899';
export default function NewsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['news'], queryFn: () => api.get<{ articles: NewsArticle[] }>('/api/news') });
  const { can } = useSession();
  const [draft, setDraft] = useState<NewsArticle | null>(null);
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<NewsArticle | null>(null);
  const [picking, setPicking] = useState<'thumbnail' | 'gallery' | null>(null);
  const editable = can('block', 'update');
  const rows = latestNews(query.data?.articles || []).filter(article => article.archived === archived && article.title.toLowerCase().includes(search.toLowerCase()));
  const pagination = usePagination(rows);
  async function save(article: NewsArticle) {
    setBusy(true);
    try {
      const current = query.data?.articles || [];
      const articles = current.some(item => item.id === article.id) ? current.map(item => item.id === article.id ? article : item) : [...current, article];
      const result = await api.put<{ articles: NewsArticle[] }>('/api/news', { articles });
      queryClient.setQueryData(['news'], result); setDraft(null); setDeleting(null); toast.success('News saved.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save news.'); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-6xl space-y-5">
    <PageHeader title="News" description="Company news, handovers and project updates. The homepage shows the latest three published articles." actions={<Button disabled={!editable || !can('event', 'create') || !query.data} onClick={() => setDraft({ id: crypto.randomUUID(), title: '', date: new Date().toISOString(), excerpt: '', subtitle: '', thumbnail: '', body: '', images: [], videos: [], source: '', published: false, archived: false })}>Add news</Button>} />
    <div className="flex gap-2"><Input aria-label="Search news" placeholder="Search news…" value={search} onChange={event => { setSearch(event.target.value); pagination.bindings.onPageChange(0); }} /><Button variant="outline" onClick={() => { setArchived(!archived); pagination.bindings.onPageChange(0); }}>{archived ? 'Active news' : 'Archived news'}</Button></div>
    {query.isPending && <p>Loading news…</p>}{query.isError && <div role="alert"><p>Could not load news.</p><Button onClick={() => query.refetch()}>Retry</Button></div>}
    <div className="grid gap-3 md:grid-cols-2">{pagination.page.map(article => <article key={article.id} className="flex gap-3 rounded-xl border p-4">
      {article.thumbnail && <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-lg bg-muted"><Image src={new URL(article.thumbnail, site).href} alt={article.title} fill unoptimized sizes="112px" className="object-cover" /></div>}
      <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{new Date(article.date).toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })} · {article.published ? 'Published' : 'Draft'}</p><h2 className="my-2 text-sm font-medium">{article.title}</h2><div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => setDraft(structuredClone(article))}>{editable ? 'Edit' : 'View'}</Button>{editable && can('event', 'delete') && <Button size="sm" variant="ghost" disabled={busy} onClick={() => archived ? save({ ...article, archived: false }) : setDeleting(article)}>{archived ? 'Restore' : 'Archive'}</Button>}<a className="px-2 py-1 text-xs underline" href={`${site}/html/news-detail.html?news=${encodeURIComponent(article.id)}`} target="_blank" rel="noopener">View article</a></div></div>
    </article>)}</div>
    {!query.isPending && !rows.length && <p className="text-sm text-muted-foreground">No matching news.</p>}
    {query.data && <PaginationBar {...pagination.bindings} label="articles" />}
    <Dialog open={draft !== null} onOpenChange={open => { if (!open && !busy) setDraft(null); }}><DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{draft?.title || 'New news article'}</DialogTitle><DialogDescription>Edit the article and its images. Use the publication date to control newest first ordering.</DialogDescription></DialogHeader>{draft && <div className="space-y-4">
      <label className="block space-y-1 text-sm">Title<Input disabled={!editable || busy} value={draft.title} maxLength={500} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="block space-y-1 text-sm">Publication date<Input type="date" disabled={!editable || busy} value={draft.date.slice(0, 10)} onChange={event => { if (event.target.value) setDraft({ ...draft, date: `${event.target.value}T12:00:00+08:00` }); }} /></label>
      <label className="block space-y-1 text-sm">Summary<Input disabled={!editable || busy} value={draft.excerpt} maxLength={2000} onChange={event => setDraft({ ...draft, excerpt: event.target.value })} /></label>
      <div className="space-y-2"><label className="block space-y-1 text-sm">Card subtitle<Input disabled={!editable || busy} value={draft.subtitle} maxLength={200} onChange={event => setDraft({ ...draft, subtitle: event.target.value })} /></label><p className="text-xs text-muted-foreground">Used on the homepage’s latest three cards and the news archive. Recommended: 100–160 characters, one short sentence. {draft.subtitle.length}/200 characters. Keep it separate from the article summary.</p></div>
      <div className="space-y-2 rounded-lg border p-3"><p className="text-sm font-medium">Thumbnail image</p><p className="text-xs text-muted-foreground">Recommended: landscape, 1600 × 1000 px (8:5). WebP or JPEG; aim for 500 KB or less. Keep faces and key details near the centre. This image is independent of the article gallery.</p>{draft.thumbnail && <div className="relative h-40 overflow-hidden rounded bg-muted"><Image src={new URL(draft.thumbnail, site).href} alt="Article thumbnail" fill unoptimized sizes="500px" className="object-contain" /></div>}<div className="flex gap-2"><Button size="sm" variant="outline" disabled={!editable || busy} onClick={() => setPicking('thumbnail')}>{draft.thumbnail ? 'Replace thumbnail' : 'Add thumbnail'}</Button>{draft.thumbnail && <Button size="sm" variant="ghost" disabled={!editable || busy} onClick={() => setDraft({ ...draft, thumbnail: '' })}>Remove thumbnail</Button>}</div></div>
      <div className="space-y-2"><p className="text-sm">Article content</p><RichTextEditor id="news-body" label="Article content" html editorial disabled={!editable || busy} value={draft.body} onChange={body => setDraft(current => current ? { ...current, body } : current)} /></div>
      <div className="space-y-2"><p className="text-sm">Article gallery</p><div className="grid grid-cols-3 gap-2">{draft.images.map((image, index) => <div key={`${image}-${index}`} className="rounded border p-2"><div className="relative h-24"><Image src={new URL(image, site).href} alt={`Article photo ${index + 1}`} fill unoptimized sizes="180px" className="object-contain" /></div><div className="flex flex-wrap gap-1"><Button size="sm" variant="ghost" disabled={!editable || busy || index === 0} onClick={() => { const images = [...draft.images]; [images[index - 1], images[index]] = [images[index], images[index - 1]]; setDraft({ ...draft, images }); }}>Move up</Button><Button size="sm" variant="ghost" disabled={!editable || busy} onClick={() => setDraft({ ...draft, images: draft.images.filter((_, i) => i !== index) })}>Remove</Button></div></div>)}</div><Button size="sm" variant="outline" disabled={!editable || busy || draft.images.length >= 40} onClick={() => setPicking('gallery')}>Add image</Button></div>
      <label className="block space-y-1 text-sm">Related article URL (optional)<Input disabled={!editable || busy} value={draft.source} onChange={event => setDraft({ ...draft, source: event.target.value })} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!editable || !can('event', 'publish') || busy} checked={draft.published} onChange={event => setDraft({ ...draft, published: event.target.checked })} />Published</label>
    </div>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDraft(null)}>Cancel</Button><Button disabled={!editable || busy || !draft?.title.trim()} onClick={() => draft && save(draft)}>{busy ? 'Saving…' : 'Save news'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={deleting !== null} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>Archive this news article?</DialogTitle><DialogDescription>It will be removed from the website. You can restore it from Archived news.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={() => deleting && save({ ...deleting, archived: true })}>Archive article</Button></DialogFooter></DialogContent></Dialog>
    <MediaPicker open={picking !== null} onOpenChange={open => { if (!open) setPicking(null); }} onSelect={media => { if (draft) { const image = new URL(mediaSrc(media.storageKey), window.location.origin).href; setDraft(picking === 'thumbnail' ? { ...draft, thumbnail: image } : { ...draft, images: [...draft.images, image] }); } setPicking(null); }} />
  </div>;
}
