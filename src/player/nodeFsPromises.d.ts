declare module "node:fs/promises" {
  export function mkdir(path: URL | string, options: { readonly recursive: true }): Promise<string | undefined>;
  export function readFile(path: URL | string, encoding: "utf8"): Promise<string>;
  export function rename(oldPath: URL | string, newPath: URL | string): Promise<void>;
  export function rm(path: URL | string, options: { readonly force?: boolean; readonly recursive?: boolean }): Promise<void>;
  export function writeFile(path: URL | string, data: string, encoding: "utf8"): Promise<void>;
}
