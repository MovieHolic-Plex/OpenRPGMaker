import type { Plugin as VitePlugin } from "vite";

export declare function readRuntimeLicenseNotice(licensePath: string): string;
export declare function runtimeLicenseBannerPlugin(licensePath: string): VitePlugin;
