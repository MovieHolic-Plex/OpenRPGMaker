export type TeamStatus = {
  team: { id: string; name: string };
  member: { id: string; label: string; role: 'owner' | 'editor' | 'viewer' };
  members: Array<{ id: string; label: string; role: 'owner' | 'editor' | 'viewer' }>;
  revision: number;
  locks: Array<{ resource: string; ownerLabel: string; expiresAt: number }>;
};
export type TeamLockResult = { kind: 'held' | 'released' | 'locked'; expiresAt?: number; ownerLabel?: string; canTakeover?: boolean };
export type TeamBridge = {
  status(): Promise<TeamStatus>;
  lock(input: { resource: string; release?: boolean; takeover?: boolean }): Promise<TeamLockResult>;
};
