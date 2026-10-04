import type { Project, UploadedAsset } from "@/project/types";
import artwork from "../../../../public/assets/monster-expedition/opening/uploaded-art.json";
import storyboardArtwork from "../../../../public/assets/monster-expedition/opening/storyboard-uploaded-art.json";
import prologueMusic from "../../../../public/assets/monster-expedition/opening/score/payload.json";

/** Authored prologue and title art; the canonical document carries the media. */
export function configureExpeditionOpening(project: Project): void {
  const asset = artwork as UploadedAsset;
  project.assets.uploaded[asset.id] = { ...asset, meta: { ...asset.meta } };
  for (const shot of storyboardArtwork as UploadedAsset[]) project.assets.uploaded[shot.id] = { ...shot, meta: { ...shot.meta } };
  const music = prologueMusic as UploadedAsset;
  project.assets.uploaded[music.id] = { ...music, meta: { ...music.meta } };
  project.system.opening = {
    enabled: true,
    skippable: true,
    musicResourceId: music.id,
    scenes: [
      { id: "mx_opening_1", kind: "image", resourceId: asset.id, motion: "pan", durationMs: 4000, narration: "" },
      { id: "mx_opening_2", kind: "image", resourceId: "mx_opening_dimming", motion: "none", durationMs: 5000,
        narration: "어? 북쪽 불빛이…" },
      { id: "mx_opening_3", kind: "image", resourceId: "mx_opening_starters", motion: "zoom", durationMs: 9000,
        narration: "첫 동료를 만나러 오렴. — 천문박사" },
    ],
  };
  if (project.system.titleScreen) {
    project.system.titleScreen.title = project.meta.title;
    project.system.titleScreen.backgroundResourceId = asset.id;
    project.system.titleScreen.backgroundFit = "cover";
    project.system.titleScreen.logoStyle = "plain";
    project.system.titleScreen.logoSubtitle = "작은 동료와 여덟 빛의 약속";
  }
}
