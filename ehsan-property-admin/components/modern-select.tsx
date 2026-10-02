'use client';

import { Children, isValidElement, useId, useRef, useState, type ComponentProps } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Keep a real select for existing form/change handlers, with Radix providing
// the visible, keyboard-accessible dropdown and consistent popover styling.
export function ModernSelect({ children, className, value, defaultValue, disabled, id, ...props }: ComponentProps<'select'>) {
  const options = Children.toArray(children).flatMap(child => {
    if (!isValidElement<ComponentProps<'option'>>(child) || child.type !== 'option') return [];
    return [{ value: String(child.props.value ?? child.props.children ?? ''), label: child.props.children, disabled: child.props.disabled }];
  });
  const [internal, setInternal] = useState(String(defaultValue ?? options[0]?.value ?? ''));
  const native = useRef<HTMLSelectElement>(null);
  const generatedId = useId();
  const triggerId = id || generatedId;
  const selected = String(value ?? internal);
  return <>
    <select {...props} ref={native} value={selected} disabled={disabled} hidden aria-hidden="true" tabIndex={-1} onInvalid={event => { event.preventDefault(); document.getElementById(triggerId)?.focus(); }}>{children}</select>
    <Select value={selected || '__empty__'} disabled={disabled} onValueChange={next => {
      const actual = next === '__empty__' ? '' : next;
      setInternal(actual);
      if (native.current) {
        native.current.value = actual;
        native.current.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }}>
      <SelectTrigger id={triggerId} onClick={event => event.preventDefault()} aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} aria-invalid={props['aria-invalid']} className={cn('w-full min-w-0 bg-background', className)}><SelectValue /></SelectTrigger>
      <SelectContent position="popper">
        {options.map(option => <SelectItem key={option.value} value={option.value || '__empty__'} disabled={option.disabled}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  </>;
}
