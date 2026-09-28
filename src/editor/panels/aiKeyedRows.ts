/** Bounded lists retain unchanged nodes, selection and focus across streaming updates. */
export function createKeyedRows<T>(container: HTMLElement, render: (value: T, previous?: HTMLElement) => HTMLElement) {
  const rows = new Map<string, { signature: string | T; node: HTMLElement }>();
  return (items: readonly T[], key: (value: T, index: number) => string, signature: (value: T) => string | T = value => value): void => {
    const keys = items.map(key);
    const keep = new Set(keys);
    // Drop the expired prefix first; survivors then already occupy their slots.
    for (const [id, row] of rows) if (!keep.has(id)) { row.node.remove(); rows.delete(id); }
    let previous: HTMLElement | null = null;
    for (let index = 0; index < items.length; index++) {
      const item = items[index]!;
      const id = keys[index]!;
      const version = signature(item);
      let row = rows.get(id);
      if (!row || row.signature !== version) {
        const node = render(item, row?.node);
        if (row && row.node !== node) row.node.replaceWith(node);
        row = { signature: version, node };
        rows.set(id, row);
      }
      const position: ChildNode | null = previous ? previous.nextSibling ?? null : container.firstChild;
      if (row.node !== position) container.insertBefore(row.node, position);
      previous = row.node;
    }
  };
}
