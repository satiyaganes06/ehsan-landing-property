import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { ProjectListItem } from '../../api/types';
import { SeoBadge, PublishBadge } from '../../components/SeoBadge';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';

export function ProjectList() {
  const { can } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ items: ProjectListItem[] }>('/api/projects?perPage=100'),
  });

  const create = useMutation({
    mutationFn: (body: { reference: string; status: string; name: string; location: string }) =>
      api.post<{ id: string }>('/api/projects', body),
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: ['projects'] }); nav(`/projects/${row.id}`); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Could not create project.'),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    create.mutate({
      reference: String(f.get('reference')), status: String(f.get('status')),
      name: String(f.get('name')), location: String(f.get('location')),
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Projects</h1>
        {can('project', 'create') && (
          <button className="btn btn--primary" onClick={() => setCreating((c) => !c)}>{creating ? 'Cancel' : '+ New project'}</button>
        )}
      </div>

      {creating && (
        <form onSubmit={onCreate} className="card card-pad field-row" style={{ alignItems: 'end' }}>
          <div className="field"><label>Reference</label><input name="reference" required placeholder="proj-17" /></div>
          <div className="field">
            <label>Status</label>
            <select name="status" defaultValue="ONGOING">
              <option value="COMPLETED">Completed</option><option value="ONGOING">Ongoing</option><option value="FUTURE">Future</option>
            </select>
          </div>
          <div className="field"><label>Name</label><input name="name" required /></div>
          <div className="field"><label>Location</label><input name="location" required /></div>
          <button className="btn btn--primary" type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create'}</button>
        </form>
      )}

      {isLoading ? <p className="dim">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Location</th><th>Status</th><th>Years</th><th>SEO</th><th>State</th></tr></thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id} onClick={() => nav(`/projects/${p.id}`)}>
                <td>{p.name}</td>
                <td className="dim">{p.location}</td>
                <td className="dim">{p.status}</td>
                <td className="dim mono">{p.yearStart}–{p.yearEnd}</td>
                <td><SeoBadge score={p.seoScore} band={p.seoBand} /></td>
                <td><PublishBadge state={p.publishState} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
