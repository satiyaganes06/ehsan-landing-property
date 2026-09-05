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
import type { ProjectDetail, ProjectStatus } from '@/lib/types';

/**
 * Creation asks only for what a project cannot exist without. Everything else
 * — the facts, images, search listing — is edited in the workspace this
 * redirects to, so nobody meets a thirty-field form before the record exists.
 */
export default function NewProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [reference, setReference] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('ONGOING');
  const [description, setDescription] = useState('');
  const [touchedReference, setTouchedReference] = useState(false);

  // The reference is the site's stable identifier for a project. Derive it
  // from the name until someone types their own.
  const suggestedReference = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const effectiveReference = touchedReference ? reference : suggestedReference;

  const create = useMutation({
    mutationFn: () =>
      api.post<ProjectDetail>('/api/projects', {
        reference: effectiveReference,
        status,
        name: name.trim(),
        location: location.trim(),
        description,
      }),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created.', { description: 'It stays a draft until you publish it.' });
      router.replace(`/projects/${project.id}`);
    },
    onError: (err) =>
      toast.error('Could not create the project', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  const canSubmit = name.trim() && location.trim() && effectiveReference && !create.isPending;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/projects"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          All projects
        </Link>
        <div className="space-y-1">
          <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight">
            New project
          </h1>
          <p className="text-muted-foreground text-sm">
            Just enough to create it. You’ll add the details, images and search listing next.
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
          <Label htmlFor="name">Project name</Label>
          <Input
            id="name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Taman Mawar Ehsan"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Town, State"
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
            Used in the project’s web address. Lowercase, no spaces.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Stage</Label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-3 focus-visible:outline-none"
          >
            <option value="ONGOING">Ongoing</option>
            <option value="COMPLETED">Completed</option>
            <option value="FUTURE">Planned</option>
          </select>
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
          <Button type="button" variant="ghost" onClick={() => router.push('/projects')}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {create.isPending ? 'Creating…' : 'Create project'}
          </Button>
        </div>
      </form>
    </div>
  );
}
