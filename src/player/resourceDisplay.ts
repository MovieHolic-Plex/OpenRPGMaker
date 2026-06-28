import { store } from "@/project/store";

export function resourceDisplayName(resourceId: string | undefined, fallback: string): string {
  if (!resourceId) return fallback;
  const profile = store.getCurrent().resourceProfiles.find((entry) => entry.assetId === resourceId);
  const name = profile?.name.trim();
  return name && name.length > 0 ? name : fallback;
}
