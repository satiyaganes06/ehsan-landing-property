'use client';

import { useEffect, useRef, useState } from 'react';
import type Quill from 'quill';
import DOMPurify from 'dompurify';
import 'quill/dist/quill.snow.css';
import './rich-text-editor.css';

type Props = { id: string; label: string; value: string; html: boolean; disabled: boolean; editorial?: boolean; onChange: (html: string) => void };

/** Browser-only Quill instance. No raw HTML editing or arbitrary embeds. */
export function RichTextEditor({ id, label, value, html, disabled, editorial = false, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<Quill | null>(null);
  const latest = useRef({ value, html, disabled, onChange });
  const [failure, setFailure] = useState(false);
  useEffect(() => { latest.current = { value, html, disabled, onChange }; });
  useEffect(() => {
    let active = true;
    const mount = host.current;
    if (!mount) return;
    import('quill').then(({ default: Quill }) => {
      if (!active) return;
      const surface = document.createElement('div');
      mount.append(surface);
      const instance = new Quill(surface, {
        theme: 'snow',
        formats: ['bold', 'italic', 'underline', 'strike', 'color', 'background', 'size', 'align', ...(editorial ? ['header', 'list', 'blockquote'] : [])],
        modules: { toolbar: [['bold', 'italic', 'underline', 'strike'], ...(editorial ? [[{ header: [2, 3, false] }], [{ list: 'ordered' }, { list: 'bullet' }, 'blockquote']] : []), [{ size: ['small', false, 'large', 'huge'] }], [{ color: [] }, { background: [] }], [{ align: [] }], ['clean']] },
      });
      editor.current = instance;
      instance.root.id = id;
      instance.root.setAttribute('role', 'textbox');
      instance.root.setAttribute('aria-label', label);
      instance.root.setAttribute('aria-multiline', 'true');
      const current = latest.current;
      if (current.html) instance.clipboard.dangerouslyPasteHTML(DOMPurify.sanitize(current.value), 'silent');
      else instance.setText(current.value.trim().replace(/\s+/g, ' '), 'silent');
      instance.enable(!current.disabled);
      instance.on('text-change', (_delta, _old, source) => {
        if (source !== 'user') return;
        latest.current.onChange(DOMPurify.sanitize(instance.getSemanticHTML()));
      });
      mount.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
        button.type = 'button';
        button.setAttribute('aria-label', button.className.replace('ql-', 'Format '));
      });
      mount.querySelectorAll<HTMLElement>('.ql-picker-label').forEach(picker => {
        const parent = picker.parentElement;
        const name = parent?.classList.contains('ql-color') ? 'Text colour' : parent?.classList.contains('ql-background') ? 'Highlight colour' : parent?.classList.contains('ql-align') ? 'Text alignment' : parent?.classList.contains('ql-header') ? 'Heading level' : 'Text size';
        picker.setAttribute('aria-label', name);
      });
    }).catch(() => { if (active) setFailure(true); });
    return () => { active = false; editor.current = null; mount.replaceChildren(); };
  }, [id, label, editorial]);

  useEffect(() => {
    const instance = editor.current;
    if (!instance) return;
    instance.enable(!disabled);
    instance.root.setAttribute('aria-disabled', String(disabled));
    // Do not reset selection or undo history during normal typing.
    if (html && DOMPurify.sanitize(instance.getSemanticHTML()) === value) return;
    if (!html && instance.getText().trim() === value.trim().replace(/\s+/g, ' ')) return;
    if (html) instance.clipboard.dangerouslyPasteHTML(DOMPurify.sanitize(value), 'silent');
    else instance.setText(value.trim().replace(/\s+/g, ' '), 'silent');
  }, [value, html, disabled]);

  return <div className="rich-text-control"><div ref={host} />{failure && <p role="alert" className="p-3 text-sm text-destructive">The text editor could not load. Refresh this page to retry.</p>}</div>;
}
