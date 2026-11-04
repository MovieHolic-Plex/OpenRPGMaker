import { parseRoleModel, type RoleModel } from "./modelRoles.ts";

export const TEAM_LEAD_STORAGE_KEY = "oprn:team-lead";

export function loadTeamLead(): RoleModel | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined;
    const raw = localStorage.getItem(TEAM_LEAD_STORAGE_KEY);
    return raw ? parseRoleModel(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

export function saveTeamLead(lead: RoleModel | undefined): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (lead) localStorage.setItem(TEAM_LEAD_STORAGE_KEY, JSON.stringify(lead));
    else localStorage.removeItem(TEAM_LEAD_STORAGE_KEY);
  } catch {
    /* 저장하지 못해도 이번 화면은 그대로 둔다 */
  }
}
