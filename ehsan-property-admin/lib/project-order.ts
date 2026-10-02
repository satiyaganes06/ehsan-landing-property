/** Move a record to the target's position without changing the other records' order. */
export function moveProject<T extends { id: string }>(items: T[], id: string, targetId: string): T[] {
  const from = items.findIndex(item => item.id === id);
  const to = items.findIndex(item => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
