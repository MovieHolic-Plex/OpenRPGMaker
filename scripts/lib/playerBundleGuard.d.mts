import type { Plugin } from "vite";

export declare const PLAYER_FORBIDDEN_MODULES: readonly { readonly label: string; readonly pattern: RegExp }[];
export declare const PLAYER_FORBIDDEN_HOSTS: readonly { readonly label: string; readonly pattern: RegExp }[];
export declare function playerBundleGuardPlugin(): Plugin;
