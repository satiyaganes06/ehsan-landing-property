import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api/client';
import type { RoleItem, UserItem } from '../../api/types';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';

export function Users() {
  const { me, can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.get<UserItem[]>('/api/users') });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: () => api.get<RoleItem[]>('/api/roles') });

  const create = useMutation({
    mutationFn: (body: { email: string; name: string; password: string; roleKeys: string[] }) => api.post('/api/users', body),
    onSuccess: () => { toast.push('success', 'User created.'); qc.invalidateQueries({ queryKey: ['users'] }); setCreating(false); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Could not create user.'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/api/users/${id}`, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Update failed.'),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    create.mutate({
      email: String(f.get('email')), name: String(f.get('name')), password: String(f.get('password')),
      roleKeys: [String(f.get('role'))],
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Users &amp; roles</h1>
        {can('user', 'create') && <button className="btn btn--primary" onClick={() => setCreating((c) => !c)}>{creating ? 'Cancel' : '+ New user'}</button>}
      </div>

      {creating && (
        <form onSubmit={onCreate} className="card card-pad field-row" style={{ alignItems: 'end' }}>
          <div className="field"><label>Name</label><input name="name" required /></div>
          <div className="field"><label>Email</label><input name="email" type="email" required /></div>
          <div className="field"><label>Password</label><input name="password" type="password" required minLength={8} /></div>
          <div className="field">
            <label>Role</label>
            <select name="role" defaultValue="editor">
              {roles?.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <button className="btn btn--primary" type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create'}</button>
        </form>
      )}

      <table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>Last seen</th><th>Status</th></tr></thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id} style={{ cursor: 'default' }}>
              <td>{u.name}</td>
              <td className="dim">{u.email}</td>
              <td className="dim" style={{ textTransform: 'capitalize' }}>{u.roles.join(', ')}</td>
              <td className="dimmer mono">{u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString() : 'Never'}</td>
              <td>
                {can('user', 'update') && u.id !== me?.id ? (
                  <button className={`btn btn--sm ${u.isActive ? 'btn--danger' : ''}`} onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}>
                    {u.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                ) : (
                  <span className={`pill ${u.isActive ? 'pill--good' : 'pill--bad'}`}>{u.isActive ? 'Active' : 'Deactivated'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="card card-pad">
        <h3 style={{ marginBottom: '1rem' }}>Role permissions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {roles?.map((r) => (
            <div key={r.key}>
              <p style={{ fontWeight: 500, fontSize: '.8125rem', textTransform: 'capitalize' }}>{r.label}</p>
              <p className="dim mono" style={{ fontSize: '.6875rem' }}>{r.permissions.join(', ')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
