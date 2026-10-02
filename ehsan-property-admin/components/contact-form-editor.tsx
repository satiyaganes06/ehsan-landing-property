'use client';
import { ModernSelect } from "@/components/modern-select";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/rich-text-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { ContactForm } from '@/lib/contact-form';

export function ContactFormEditor({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  let form: ContactForm = { title: '', subtitle: '', button: 'Send enquiry', fields: [] };
  try { form = { ...form, ...JSON.parse(value) }; } catch { /* Keep the form editable. */ }
  form.fields = form.fields.map(field => field.id === 'phoneCountry' ? {...field,id:'phone',type:'tel',options:[],placeholder:'Phone number'} : field);
  const commit = (next: ContactForm) => onChange(JSON.stringify(next));
  const update = (id: string, patch: Partial<ContactForm['fields'][number]>) => commit({ ...form, fields: form.fields.map(field => field.id === id ? { ...field, ...patch } : field) });
  const move = (index: number, offset: number) => { const fields = [...form.fields]; const [field] = fields.splice(index, 1); fields.splice(index + offset, 0, field); commit({ ...form, fields }); };
  return <div className="space-y-4">
    <details className="rounded-lg border" open><summary className="cursor-pointer p-3 text-sm font-medium">Form heading and subtitle</summary><div className="space-y-4 border-t p-3">
      {(['title', 'subtitle'] as const).map(key => <div key={key} className="space-y-2"><p className="text-xs font-medium">{key === 'title' ? 'Title' : 'Subtitle'}</p><RichTextEditor id={`contact-form-${key}`} label={key} html value={form[key]} disabled={disabled} onChange={text => commit({ ...form, [key]: text })} /></div>)}
    </div></details>
    <p className="text-xs text-muted-foreground">Use the arrows to arrange fields. Half width fields share a row on desktop; all fields stack on mobile.</p>
    {form.fields.map((field, index) => <details key={field.id} className="rounded-lg border" onToggle={event => { const open = event.currentTarget.open; setExpanded(current => current[field.id] === open ? current : { ...current, [field.id]: open }); }}>
      <summary className="cursor-pointer p-3 text-sm font-medium">{index + 1}. {field.label.replace(/<[^>]*>/g, '') || 'Untitled field'}<span className="text-xs font-normal text-muted-foreground">{field.required ? ' · Required' : ''}</span></summary>
      {expanded[field.id] && <div className="space-y-3 border-t p-3">
        <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" disabled={disabled || index === 0} onClick={() => move(index, -1)}>Move up</Button><Button size="sm" variant="outline" disabled={disabled || index === form.fields.length - 1} onClick={() => move(index, 1)}>Move down</Button><Button size="sm" variant="ghost" disabled={disabled || ['name', 'email', 'message'].includes(field.id)} onClick={() => setRemoving(field.id)}>Delete field</Button></div>
        <div className="space-y-2"><p className="text-xs font-medium">Label</p><RichTextEditor id={`form-${field.id}-label`} label="Label" html value={field.label} disabled={disabled} onChange={label => update(field.id, { label })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs">Field type<ModernSelect className="block w-full rounded border bg-background p-2" disabled={disabled || ['name', 'email', 'message'].includes(field.id)} value={field.type} onChange={event => update(field.id, { type: event.target.value as typeof field.type })}>{[['text', 'Text'], ['email', 'Email'], ['tel', 'Phone'], ['textarea', 'Long message'], ['select', 'Dropdown']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</ModernSelect></label>
          <label className="space-y-1 text-xs">Width<ModernSelect className="block w-full rounded border bg-background p-2" disabled={disabled} value={field.wide ? 'full' : 'half'} onChange={event => update(field.id, { wide: event.target.value === 'full' })}><option value="half">Half width</option><option value="full">Full width</option></ModernSelect></label>
        </div>
        <label className="block space-y-1 text-xs">{field.type === 'select' ? 'Dropdown prompt' : 'Placeholder'}<Input disabled={disabled} maxLength={300} value={field.placeholder} onChange={event => update(field.id, { placeholder: event.target.value })} /></label>
        {field.type === 'select' && <div className="space-y-2"><p className="text-xs font-medium">Dropdown options</p>{field.options.map((option, i) => <div key={i} className="flex gap-2"><Input aria-label={`Option ${i + 1}`} disabled={disabled} maxLength={200} value={option} onChange={event => update(field.id, { options: field.options.map((text, j) => j === i ? event.target.value : text) })} /><Button size="sm" variant="ghost" disabled={disabled} aria-label={`Remove option ${i + 1}`} onClick={() => update(field.id, { options: field.options.filter((_, j) => j !== i) })}>Remove</Button></div>)}<Button size="sm" variant="outline" disabled={disabled || field.options.length >= 40} onClick={() => update(field.id, { options: [...field.options, 'New option'] })}>Add option</Button></div>}
        <div className="space-y-2"><p className="text-xs font-medium">Help text (optional)</p><RichTextEditor id={`form-${field.id}-help`} label="Help text" html value={field.help} disabled={disabled} onChange={help => update(field.id, { help })} /></div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" disabled={disabled || ['name', 'email', 'message'].includes(field.id)} checked={field.required} onChange={event => update(field.id, { required: event.target.checked })} />Required field</label>
      </div>}
    </details>)}
    <Button size="sm" variant="outline" disabled={disabled || form.fields.length >= 20} onClick={() => commit({ ...form, fields: [...form.fields, { id: crypto.randomUUID(), label: 'New field', type: 'text', placeholder: '', help: '', required: false, wide: false, options: [] }] })}>Add field</Button>
    <details className="rounded-lg border" open><summary className="cursor-pointer p-3 text-sm font-medium">Submit button</summary><div className="border-t p-3"><label className="block space-y-1 text-xs">Button text<Input disabled={disabled} maxLength={100} value={form.button} onChange={event => commit({ ...form, button: event.target.value })} /></label></div></details>
    <Dialog open={removing !== null} onOpenChange={open => { if (!open) setRemoving(null); }}><DialogContent><DialogHeader><DialogTitle>Delete this form field?</DialogTitle><DialogDescription>The field will be removed from the form when you save changes.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button><Button variant="destructive" disabled={disabled} onClick={() => { commit({ ...form, fields: form.fields.filter(field => field.id !== removing) }); setRemoving(null); }}>Delete field</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
