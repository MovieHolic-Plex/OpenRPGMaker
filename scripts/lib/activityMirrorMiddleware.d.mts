import type { IncomingMessage, ServerResponse } from "node:http";

export type ActivityMirrorKind = "ai" | "edit";

export type ActivityMirrorResult = {
  status: number;
  contentType: string | null;
  body: string;
} | null;

export const AI_ACTIVITY_DISK_ENDPOINT: string;
export const EDIT_ACTIVITY_DISK_ENDPOINT: string;
export const ACTIVITY_MIRROR_LIMITS: {
  readonly editMaxBodyBytes: number;
  readonly editIndexLimit: number;
  readonly aiIndexLimit: number;
};

export function activityMirrorKind(pathname: string | undefined): ActivityMirrorKind | null;
export function isActivityMirrorPath(pathname: string | undefined): boolean;
export function activityMirrorDir(kind: ActivityMirrorKind, baseDir: string): string;
export function handleActivityMirror(input: {
  method: string;
  url: string;
  bodyText?: string;
  baseDir: string;
}): ActivityMirrorResult;

export type ActivityMirrorMiddleware = ((
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void) & { dispose?: () => void };

export function createActivityMirrorMiddleware(options?: {
  baseDir?: string;
  allowedOrigin?: string | null;
  corsOrigin?: (req: { headers: { origin?: string | string[] } }) => string | null;
}): ActivityMirrorMiddleware;
