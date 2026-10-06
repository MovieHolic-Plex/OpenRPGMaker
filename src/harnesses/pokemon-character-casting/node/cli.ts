// Keep the registered harness entrypoint thin; the standalone server uses the same implementation.
export async function run(argv: string[]): Promise<number> {
  const module = await import('./cli.mjs');
  return module.run(argv);
}
