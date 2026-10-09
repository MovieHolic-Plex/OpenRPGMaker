export type AuxWhich = "ai" | "preview" | "flow";

const openByKey = new Map<string, Set<AuxWhich>>();
const hostsByKey = new Map<string, Partial<Record<AuxWhich, HTMLDetailsElement>>>();

let applyingOpen = false;

export function auxCompositeKey(mapId: string, eventId: string, pageId: string): string {
  return `${mapId}:${eventId}:${pageId}`;
}

export function getAuxOpenSet(key: string): Set<AuxWhich> {
  return openByKey.get(key) ?? new Set();
}

export function getAuxOpen(key: string): AuxWhich | null {
  const set = openByKey.get(key);
  if (!set || set.size === 0) return null;
  if (set.has("ai")) return "ai";
  if (set.has("preview")) return "preview";
  if (set.has("flow")) return "flow";
  return null;
}

export function isAuxOpen(key: string, which: AuxWhich): boolean {
  return openByKey.get(key)?.has(which) ?? false;
}

export function isAuxOpenApplying(): boolean {
  return applyingOpen;
}

export function bindAuxDetails(key: string, which: AuxWhich, details: HTMLDetailsElement): void {
  let hosts = hostsByKey.get(key);
  if (!hosts) {
    hosts = {};
    hostsByKey.set(key, hosts);
  }
  hosts[which] = details;
  applyingOpen = true;
  try {
    applyDetailsOpen(details, isAuxOpen(key, which));
  } finally {
    applyingOpen = false;
  }
}

export function setAuxOpen(key: string, which: AuxWhich | null): void {
  let set = openByKey.get(key);
  if (!set) {
    set = new Set();
    openByKey.set(key, set);
  }
  if (which === null) {
    set.clear();
  } else if (which === "ai") {
    set.clear();
    set.add("ai");
  } else {
    set.delete("ai");
    set.add(which);
  }
  applyToHosts(key);
}

export function setAuxClosed(key: string, which: AuxWhich): void {
  const set = openByKey.get(key);
  if (!set) return;
  set.delete(which);
  applyToHosts(key);
}

export function syncAuxHosts(key: string): void {
  applyToHosts(key);
}

function applyToHosts(key: string): void {
  const hosts = hostsByKey.get(key);
  if (!hosts) return;
  const set = openByKey.get(key) ?? new Set<AuxWhich>();
  applyingOpen = true;
  try {
    for (const panel of ["ai", "preview", "flow"] as const) {
      const details = hosts[panel];
      if (!details) continue;
      applyDetailsOpen(details, set.has(panel));
    }
  } finally {
    applyingOpen = false;
  }
}

function applyDetailsOpen(details: HTMLDetailsElement, open: boolean): void {
  if (details.open === open) return;
  details.open = open;
}
