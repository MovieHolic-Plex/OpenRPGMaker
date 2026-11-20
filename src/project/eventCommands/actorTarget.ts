export function isWholePartyActorTarget(actorId: string | undefined): actorId is "" | "party" | "all" | undefined {
  return actorId === undefined || actorId === "" || actorId === "party" || actorId === "all";
}
