declare module "node:fs/promises" {
  export function readFile(path: URL | string, encoding: "utf8"): Promise<string>;
  export function writeFile(path: URL | string, data: string, encoding: "utf8"): Promise<void>;
}
