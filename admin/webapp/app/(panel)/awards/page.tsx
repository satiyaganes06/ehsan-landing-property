'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Trophy } from 'lucide-react';

import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/animate-ui/components/radix/sheet';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState } from '@/components/states';
import { PublishPill } from '@/components/state-pills';
import { PermissionButton } from '@/components/permission-button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { AwardDetail, AwardListItem } from '@/lib/types';

interface AwardDraft {
  name: string;
  issuer: string;
  description: string;
  year: string;
  reference: string;
}

const EMPTY: AwardDraft = {
  name: '',
  issuer: '',
  description: '',
  year: String(new Date().getFullYear()),
  reference: '',
};

export default function AwardsPage() {
  const queryClient = useQueryClient();
  const { can } = useSession();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<AwardDraft>(EMPTY);
  const [pendingDelete, setPendingDelete] = useState<AwardListItem | null>(null);

  const list = useQuery({
    queryKey: ['awards'],
    queryFn: () => api.get<AwardListItem[]>('/api/awards'),
  });

  const detail = useQuery({
    queryKey: ['awards', editingId],
    queryFn: () => api.get<AwardDetail>(`/api/awards/${editingId}`),
    enabled: Boolean(editingId),
  });

  useEffect(() => {
    const data = detail.data;
    if (!data) return;
    const t = data.translations?.find((x) => x.locale === 'EN');
    setDraft({
      name: t?.name ?? data.name ?? '',
      issuer: t?.issuer ?? '',
      description: t?.description ?? '',
      year: String(data.year ?? ''),
      reference: data.reference ?? '',
    });
  }, [detail.data]);

  const open = creating || Boolean(editingId);

  function close() {
    setCreating(false);
    setEditingId(null);
    setDraft(EMPTY);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (creating) {
        // The base row carries only structural fields; the wording lives in a
        // per-locale translation, so a new award is two calls.
        const created = await api.post<AwardDetail>('/api/awards', {
          reference: draft.reference || slugify(draft.name),
          year: Number(draft.year),
        });
        await api.put(`/api/awards/${created.id}/translations/EN`, {
          name: draft.name,
          issuer: draft.issuer || null,
          description: draft.description,
        });
        return created;
      }
      await api.patch(`/api/awards/${editingId}`, { year: Number(draft.year) });
      await api.put(`/api/awards/${editingId}/translations/EN`, {
        name: draft.name,
        issuer: draft.issuer || null,
        description: draft.description,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['awards'] });
      toast.success(creating ? 'Award added.' : 'Award saved.');
      close();
    },
    onError: (err) =>
      toast.error('Could not save', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  const publish = useMutation({
    mutationFn: (id: string) => api.post(`/api/awards/${id}/publish`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['awards'] });
      toast.success('Published.');
    },
    onError: (err) =>
      toast.error('Could not publish', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/awards/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['awards'] });
      toast.success('Award deleted.');
      setPendingDelete(null);
      close();
    },
    onError: (err) =>
      toast.error('Could not delete', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Awards"
        description="Recognition shown in the awards strip on the site."
        actions={
          <PermissionButton
            resource="award"
            action="create"
            onClick={() => {
              setDraft(EMPTY);
              setCreating(true);
            }}
          >
            <Plus className="size-3.5" />
            Add award
          </PermissionButton>
        }
      />

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : list.data?.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No awards yet"
          description="Add the first award and it will appear on the site once published."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...(list.data ?? [])]
            .sort((a, b) => b.year - a.year)
            .map((award) => (
              <button
                key={award.id}
                type="button"
                onClick={() => setEditingId(award.id)}
                className="bg-card hover:border-brass-line/60 overflow-hidden rounded-lg border text-left transition-colors"
              >
                {/* The logos are dark artwork on transparency with generous
                    padding, so they need both room and a light plate — the
                    same #f9f9f9 tile the site itself sits them on. */}
                <div className="flex h-20 items-center justify-center bg-[#f9f9f9] px-4">
                  {award.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={award.mediaUrl}
                      alt={`${award.name} award logo`}
                      className="max-h-16 w-auto max-w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <Trophy className="size-6 text-[#b9b3a9]" />
                  )}
                </div>

                <div className="min-w-0 space-y-1 p-3">
                  <p className="line-clamp-2 text-sm leading-snug font-medium">{award.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono text-xs">{award.year}</span>
                    <PublishPill state={award.publishState} />
                  </div>
                </div>
              </button>
            ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={(next) => (next ? null : close())}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{creating ? 'Add award' : 'Edit award'}</SheetTitle>
            <SheetDescription>
              {creating
                ? 'New awards start as drafts. Publish when you want them on the site.'
                : 'Changes appear on the site the next time this award is published.'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            {editingId && detail.isPending ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="award-name">Award name</Label>
                  <Input
                    id="award-name"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="award-issuer">Awarded by</Label>
                  <Input
                    id="award-issuer"
                    value={draft.issuer}
                    onChange={(e) => setDraft({ ...draft, issuer: e.target.value })}
                    placeholder="Organisation that gave the award"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="award-year">Year</Label>
                  <Input
                    id="award-year"
                    type="number"
                    value={draft.year}
                    onChange={(e) => setDraft({ ...draft, year: e.target.value })}
                    className="font-mono"
                  />
                </div>

                {creating ? (
                  <div className="space-y-2">
                    <Label htmlFor="award-reference">Reference</Label>
                    <Input
                      id="award-reference"
                      value={draft.reference || slugify(draft.name)}
                      onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
                      className="font-mono"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="award-description">Description</Label>
                  <Textarea
                    id="award-description"
                    rows={4}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </div>

                {!creating && detail.data && detail.data.publishState !== 'PUBLISHED' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => publish.mutate(editingId!)}
                    disabled={publish.isPending || !can('award', 'publish')}
                  >
                    {publish.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Publish this award
                  </Button>
                ) : null}
              </>
            )}
          </div>

          <SheetFooter className="flex-row justify-between gap-2">
            {!creating && can('award', 'delete') ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  const found = list.data?.find((a) => a.id === editingId);
                  if (found) setPendingDelete(found);
                }}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={close}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => save.mutate()}
                disabled={!draft.name.trim() || save.isPending}
              >
                {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {save.isPending ? 'Saving…' : creating ? 'Add award' : 'Save'}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => (next ? null : setPendingDelete(null))}
        title={`Delete ${pendingDelete?.name}?`}
        description="This removes the award from the panel and the site. It can't be undone."
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </div>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
