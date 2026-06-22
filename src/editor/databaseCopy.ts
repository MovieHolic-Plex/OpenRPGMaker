export function duplicateInto<T extends { id: string; name: string }>(records: T[], id: string, copyId: string): void {
  const source = records.find((entry) => entry.id === id);
  if (!source) return;
  const copy = structuredClone(source);
  copy.id = copyId;
  copy.name = `${source.name} Copy`;
  records.push(copy);
}
