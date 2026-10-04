/** Preview clocks belong to surfaces, never document-body mutations or assistant work. */
export type DatabasePreviewLifecycle = {
  isActive(): boolean;
  setActive(active: boolean): void;
  retain(retained: boolean): void;
  dispose(): void;
};
type PreviewCallbacks = {
  readonly suspend: () => void;
  readonly resume: () => void;
  readonly dispose?: () => void;
};
const bindings = new WeakMap<HTMLElement, DatabasePreviewLifecycle>();
const surfaces = new WeakMap<ParentNode, boolean>();
// Parked/cached previews remain weakly owned by their DOM.
const activated = new Set<DatabasePreviewLifecycle>();
let listeningDocument: Document | undefined;
const selector = '[data-editor-preview-lifecycle]';

function surfaceAllows(node: HTMLElement): boolean {
  for (let parent: Node | null = node; parent; parent = parent.parentNode) {
    if (surfaces.get(parent as ParentNode) === false) return false;
    if (parent instanceof HTMLElement && (parent.hidden || parent.getAttribute('aria-hidden') === 'true' || parent.classList.contains('is-parked'))) return false;
  }
  return node.isConnected;
}
function onVisibility(): void {
  for (const lifecycle of [...activated]) lifecycle.setActive(true);
}
function syncListener(): void {
  if (listeningDocument && (activated.size === 0 || listeningDocument !== document)) {
    listeningDocument.removeEventListener('visibilitychange', onVisibility);
    listeningDocument = undefined;
  }
  if (activated.size > 0 && !listeningDocument) {
    document.addEventListener('visibilitychange', onVisibility);
    listeningDocument = document;
  }
}

/** All form callsites attach synchronously. Resolve attachment after construction. */
export function registerDatabasePreview(node: HTMLElement, callbacks: PreviewCallbacks): DatabasePreviewLifecycle {
  bindings.get(node)?.dispose();
  node.dataset.editorPreviewLifecycle = '';
  let active = false;
  let disposed = false;
  let retained = false;
  let requested: boolean | undefined;
  const lifecycle: DatabasePreviewLifecycle = {
    isActive: () => !disposed && active && node.isConnected && !document.hidden,
    retain(next) { retained = next; },
    setActive(next) {
      if (disposed) return;
      requested = next;
      active = next && surfaceAllows(node);
      if (active) activated.add(lifecycle);
      else activated.delete(lifecycle);
      syncListener();
      if (lifecycle.isActive()) callbacks.resume();
      else callbacks.suspend();
      // Record owners suspend before replacement. Only cache owners retain detached DOM.
      if (!active) queueMicrotask(() => { if (!node.isConnected && !retained) lifecycle.dispose(); });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      activated.delete(lifecycle);
      syncListener();
      callbacks.suspend();
      callbacks.dispose?.();
      bindings.delete(node);
      delete node.dataset.editorPreviewLifecycle;
    },
  };
  bindings.set(node, lifecycle);
  queueMicrotask(() => { if (requested !== false) lifecycle.setActive(true); });
  return lifecycle;
}

function eachPreview(scope: ParentNode, visit: (binding: DatabasePreviewLifecycle) => void, filter = selector): void {
  if (scope instanceof HTMLElement && (filter === selector || scope.matches?.(filter))) {
    const binding = bindings.get(scope);
    if (binding) visit(binding);
  }
  for (const node of scope.querySelectorAll<HTMLElement>(filter)) {
    const binding = bindings.get(node);
    if (binding) visit(binding);
  }
}
/** Transient replacement: the reusable record/detail host itself remains active. */
export function setDatabasePreviewsActiveIn(scope: ParentNode, active: boolean): void {
  eachPreview(scope, binding => binding.setActive(active));
}
/** Persistent modal state is set BEFORE parked/visible panel construction. */
export function setDatabasePreviewSurfaceActive(scope: ParentNode, active: boolean): void {
  surfaces.set(scope, active);
  setDatabasePreviewsActiveIn(scope, active);
}
export function disposeDatabasePreviewsIn(scope: ParentNode, filter?: string): void {
  eachPreview(scope, binding => binding.dispose(), filter);
}
/** The cache owns detached previews until reattachment or eviction. */
export function retainDatabasePreviewsIn(scope: ParentNode, retained: boolean): void {
  eachPreview(scope, binding => binding.retain(retained));
}
