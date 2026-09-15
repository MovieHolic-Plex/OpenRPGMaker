import { describe, expect, it } from "vitest";
import { loadProjectFromSupabase, saveProjectToSupabase } from "@/project/supabaseProjectSync";

declare const process: { readonly env: Record<string, string | undefined> };

function envConfig(): { readonly anonKey: string; readonly projectId: string; readonly url: string } {
  const url = process.env.VITE_SUPABASE_URL;
  const projectId = process.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !projectId || !anonKey) throw new Error("Supabase env is missing");
  return { anonKey, projectId, url };
}

const describeLive = process.env.OPRN_LIVE_SUPABASE_ROUNDTRIP === "1" ? describe : describe.skip;

describeLive("live Supabase canonical project roundtrip", () => {
  it("persists normalized RM2003 utility database records into current_json", async () => {
    const config = envConfig();
    const project = await loadProjectFromSupabase(config);
    if (!project) throw new Error("Supabase canonical project was not found");

    expect(project.database.elements?.[0]?.id).toBe("sword");
    expect(project.database.terrains?.[0]?.id).toBe("terrain_grassland");
    expect(project.database.battleCommands?.map((command) => command.id)).toEqual(["cmd_attack", "cmd_skill", "cmd_defend", "cmd_item"]);

    await saveProjectToSupabase(project, config);
    const restored = await loadProjectFromSupabase(config);

    expect(restored?.database.elements?.[0]?.id).toBe("sword");
    expect(restored?.database.terrains?.[0]?.id).toBe("terrain_grassland");
    expect(restored?.database.battleCommands?.[0]?.id).toBe("cmd_attack");
  });
});
