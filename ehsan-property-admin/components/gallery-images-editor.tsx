'use client';
import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MediaPicker } from '@/components/media-picker';
import { mediaSrc } from '@/lib/media';

type Photo = { id: string; src: string; alt: string };
const site = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:8899';
export function GalleryImagesEditor({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
  const [picking, setPicking] = useState<string | null>(null);
  let photos: Photo[] = [];
  try { const data = JSON.parse(value); if (Array.isArray(data)) photos = data; } catch { /* Recover as an empty gallery. */ }
  const commit = (next: Photo[]) => onChange(JSON.stringify(next));
  const update = (id: string, patch: Partial<Photo>) => commit(photos.map(photo => photo.id === id ? { ...photo, ...patch } : photo));
  const move = (index: number, offset: number) => { const next = [...photos]; const [photo] = next.splice(index, 1); next.splice(index + offset, 0, photo); commit(next); };
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">{photos.length} images. Each card pairs one image with its description. Carousel rows adjust automatically. Recommended: landscape, 1600 × 1000 px, WebP or JPEG.</p>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{photos.map((photo, index) => {
      let source = ''; try { source = new URL(photo.src, site).href; } catch { /* Invalid URL remains editable. */ }
      return <div key={photo.id} className="space-y-2 rounded-lg border p-3">
        <div className="relative h-28 rounded bg-muted overflow-hidden">{source && <Image src={source} alt={photo.alt || `Gallery image ${index + 1}`} fill unoptimized sizes="300px" className="object-contain" />}</div>
        <label className="block space-y-1 text-xs">Image description<Input aria-label={`Gallery image ${index + 1} description`} disabled={disabled} maxLength={500} value={photo.alt} onChange={event => update(photo.id, { alt: event.target.value })} /></label>
        <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" disabled={disabled} onClick={() => setPicking(photo.id)}>Replace</Button><Button size="sm" variant="ghost" disabled={disabled} aria-label={`Remove gallery image ${index + 1}`} onClick={() => commit(photos.filter(item => item.id !== photo.id))}>Remove</Button><Button size="sm" variant="ghost" disabled={disabled || index === 0} aria-label={`Move gallery image ${index + 1} earlier`} onClick={() => move(index, -1)}>↑</Button><Button size="sm" variant="ghost" disabled={disabled || index === photos.length - 1} aria-label={`Move gallery image ${index + 1} later`} onClick={() => move(index, 1)}>↓</Button></div>
      </div>;
    })}</div>
    {!photos.length && <p className="text-sm text-muted-foreground">No images. The carousel stays hidden until an image is added.</p>}
    <Button size="sm" variant="outline" disabled={disabled || photos.length >= 30} onClick={() => setPicking('new')}>Add image</Button>
    <MediaPicker open={picking !== null} onOpenChange={open => { if (!open) setPicking(null); }} onSelect={media => {
      const src = new URL(mediaSrc(media.storageKey), window.location.origin).href;
      if (picking === 'new') commit([...photos, { id: crypto.randomUUID(), src, alt: media.altText || '' }]);
      else if (picking) update(picking, { src, alt: media.altText || photos.find(photo => photo.id === picking)?.alt || '' });
      setPicking(null);
    }} />
  </div>;
}
