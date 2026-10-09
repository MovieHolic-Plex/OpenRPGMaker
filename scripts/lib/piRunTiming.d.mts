export function piTimingEnabled(): boolean;
export function piTimer(label: string): { mark(name: string, extra?: string): void; done(extra?: string): void };
