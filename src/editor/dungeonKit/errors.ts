export class DungeonComposeError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}
