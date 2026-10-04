// The shell may paint before shared references arrive. First-generation authoring
// must capture its immutable base after that last boot-owned mutation has settled.
let prepare: (() => Promise<void>) | undefined;
let pending: Promise<void> | undefined;

export function configureProjectInterviewBootPreparation(work: () => Promise<void>): void {
  prepare = work;
  pending = undefined;
}

export function prepareProjectInterviewBootAssets(): Promise<void> {
  if (!prepare) return Promise.resolve();
  return pending ??= Promise.resolve().then(prepare);
}
