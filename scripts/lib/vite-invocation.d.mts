// Type declarations for vite-invocation.mjs (shared by capture script and regression test).

export const VITE_FIXED_ARGS: readonly string[];
export const VITE_ENTRY_REL: string;

export interface ViteInvocation {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: {
    readonly cwd: string;
    readonly env: Record<string, string | undefined>;
    readonly stdio: "ignore";
    readonly shell: false;
    readonly windowsHide: true;
  };
}

export function buildViteInvocation(
  port: number,
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv },
): ViteInvocation;
