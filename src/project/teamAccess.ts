type TeamRole = 'owner' | 'editor' | 'viewer';

let role: TeamRole | null = null;
export function setTeamRole(value: TeamRole | null): void { role = value; }
/** Fail closed until host membership has been read. Ordinary web projects have no team bridge. */
export function canWriteTeamProject(): boolean {
  return typeof window === 'undefined' || !window.oprn?.team || role === 'owner' || role === 'editor';
}
