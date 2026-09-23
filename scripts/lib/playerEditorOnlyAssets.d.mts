import type { Plugin as VitePlugin } from "vite";

export declare const PLAYER_EDITOR_ONLY_ASSETS: Readonly<Record<string, "whole" | "field">>;
export declare function stripEditorOnlyJson(mode: "whole" | "field", text: string): string;
export declare function playerEditorOnlyAssetsVitePlugin(): VitePlugin;
export declare function playerEditorOnlyAssetsEsbuildPlugin(repoRoot: string): {
  name: string;
  setup(build: { onLoad(options: { filter: RegExp }, callback: (args: { path: string }) => Promise<{ contents: string; loader: "json" } | undefined>): void }): void;
};
