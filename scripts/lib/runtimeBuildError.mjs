export class PlayerArtifactSyncError extends Error {
  name = "PlayerArtifactSyncError";

  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function syncFail(code, message) {
  throw new PlayerArtifactSyncError(code, message);
}

export async function redactSyncFailure({ code, message, operation }) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PlayerArtifactSyncError) throw error;
    throw new PlayerArtifactSyncError(code, message);
  }
}
