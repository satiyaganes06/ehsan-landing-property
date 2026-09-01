'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import { EVENT_CATEGORIES } from '@/lib/constants';
import type { EventDetail } from '@/lib/types';

export default function NewEventPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [touchedReference, setTouchedReference] = useState(false);

  const suggestedReference = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const effectiveReference = touchedReference ? reference : suggestedReference;

  const create = useMutation({
    mutationFn: () =>
      api.post<EventDetail>('/api/events', {
        reference: effectiveReference,
        startsAt: new Date(startsAt).toISOString(),
        title: title.trim(),
        category: category.trim(),
        location: location.trim(),
        description,
      }),
    onSuccess: async (event) => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event created.', { description: 'It stays a draft until you publish it.' });
      router.replace(`/events/${event.id}`);
    },
    onError: (err) =>
      toast.error('Could not create the event', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  const canSubmit =
    title.trim() && category.trim() && location.trim() && startsAt && effectiveReference && !create.isPending;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/events"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          All events
        </Link>
        <div className="space-y-1">
          <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight">New event</h1>
          <p className="text-muted-foreground text-sm">
            Just enough to create it. Capacity, agenda and the search listing come next.
          </p>
        </div>
      </div>

      <form
        className="bg-card space-y-4 rounded-lg border p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) create.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="title">Event title</Label>
          <Input
            id="title"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Residensi Mutiara Austin Grand Launch"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-3 focus-visible:outline-none"
            >
              <option value="" disabled>
                Choose a category
              </option>
              {EVENT_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startsAt">Starts</Label>
            <Input
              id="startsAt"
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Venue</Label>
          <Input
            id="location"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Where it takes place"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reference">Reference</Label>
          <Input
            id="reference"
            required
            value={effectiveReference}
            onChange={(e) => {
              setTouchedReference(true);
              setReference(e.target.value);
            }}
            className="font-mono"
          />
          <p className="text-muted-foreground text-xs">
            Used in the event’s web address. Lowercase, no spaces.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional for now — you can write this later."
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => router.push('/events')}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {create.isPending ? 'Creating…' : 'Create event'}
          </Button>
        </div>
      </form>
    </div>
  );
}
