/** Live ownership, not a historical Pokédex or a list of every allocated instance. */
export interface MonsterOwnershipState {
  readonly monsterInstances?: Readonly<Record<string, { readonly speciesId: string }>>;
  readonly monsterParty?: readonly string[];
  readonly monsterBox?: readonly string[];
}

/**
 * Only party/box membership confers ownership. Orphan records, missing instance
 * references, and other species do not qualify. A fainted monster still belongs
 * to its trainer. Optional fields support old saves with no collector party.
 */
export function ownsMonsterSpecies(state: MonsterOwnershipState, speciesId: string): boolean {
  if (!speciesId.trim()) return false;
  const instances = state.monsterInstances;
  if (!instances) return false;
  const matches = (instanceId: string): boolean =>
    Object.hasOwn(instances, instanceId) && instances[instanceId]?.speciesId === speciesId;
  return (state.monsterParty ?? []).some(matches) || (state.monsterBox ?? []).some(matches);
}
