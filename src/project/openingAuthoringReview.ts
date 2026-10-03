import type { Project } from "./types";
import { openingAuthoringStatus } from "./openingAuthoringStatus";

/** Structural clues for an author, never a score or proof of visual/playback quality. */
export function reviewOpeningAuthoring(project: Project) {
  const opening = project.system.opening;
  const warnings: string[] = [];
  const scenes = (opening?.scenes ?? []).map((scene, index) => {
    const narrationCharacters = [...scene.narration.trim()].length;
    // A conservative heuristic for short Korean narration, not a reading-speed requirement.
    const estimatedReadingMs = narrationCharacters ? Math.ceil(1000 + narrationCharacters / 6 * 1000) : 0;
    if (narrationCharacters >= 100) warnings.push(`${scene.id}: 내레이션 ${narrationCharacters}자. 그림으로 전달할 내용을 줄일 수 있는지 검토하세요.`);
    if (scene.durationMs > 0 && estimatedReadingMs > scene.durationMs) {
      warnings.push(`${scene.id}: ${scene.durationMs}ms 안에 ${narrationCharacters}자를 읽어야 합니다. 실제 화면에서 읽을 시간을 확인하세요(추정 ${estimatedReadingMs}ms).`);
    }
    return {
      index, id: scene.id, kind: scene.kind,
      resourceId: scene.kind === "text" ? null : scene.resourceId,
      narrationPreview: [...scene.narration].slice(0, 80).join(""), narrationCharacters, estimatedReadingMs,
      durationMs: scene.durationMs,
      advance: scene.kind === "video" ? (scene.durationMs > 0 ? "timer-or-video-end" : "video-end")
        : scene.durationMs > 0 ? "timer-or-confirm" : "confirm",
      ...(scene.kind === "video" ? { confirmAvailableWhilePlaying: false, confirmWhenMediaBlocked: true } : {}),
      motion: scene.kind === "image" ? scene.motion : null,
      narrationAudioResourceId: scene.narrationAudioResourceId ?? null,
    };
  });
  const imageUses = new Map<string, string[]>();
  for (const scene of scenes) if (scene.kind === "image" && scene.resourceId) {
    const uses = imageUses.get(scene.resourceId) ?? [];
    uses.push(scene.id); imageUses.set(scene.resourceId, uses);
  }
  const repeatedImages = [...imageUses].filter(([, ids]) => ids.length > 1)
    .map(([resourceId, sceneIds]) => ({ resourceId, sceneIds }));
  for (const repeat of repeatedImages) if (repeat.sceneIds.length >= 3) {
    warnings.push(`같은 그림 ${repeat.resourceId}를 ${repeat.sceneIds.length}장면에서 반복합니다. 의도된 반복인지, 사건·인물·구도가 실제로 달라지는지 그림을 직접 확인하세요.`);
  }
  const status = openingAuthoringStatus(project);
  if (!status.configuredToPlay) warnings.push("현재 설정으로는 새 게임에서 오프닝이 재생되지 않습니다.");
  if (status.defaultPlaceholder) warnings.push("기본 오프닝이 남아 있습니다. 작품의 사건과 첫 행동에 맞게 저작하세요.");
  return {
    verificationScope: "configuration-review" as const,
    playbackVerified: false, visualInspectionVerified: false,
    authoringStatus: status,
    sceneCount: scenes.length, distinctImageCount: imageUses.size,
    // Videos may end early and duration 0 may await input/video end: never claim an exact runtime.
    scheduledDurationMs: scenes.reduce((sum, scene) => sum + scene.durationMs, 0),
    automaticDurationMs: scenes.length > 0 && scenes.every(scene => scene.kind !== "video" && scene.durationMs > 0)
      ? scenes.reduce((sum, scene) => sum + scene.durationMs, 0) : null,
    confirmationSceneIds: scenes.filter(scene => scene.advance === "confirm").map(scene => scene.id),
    musicResourceId: opening?.musicResourceId ?? null,
    repeatedImages, scenes, warnings,
    remainingReview: [
      "그림을 직접 보고 장면별 사건·인물·구도와 기존 캐릭터 외형을 확인한다.",
      "정지 그림의 pan/zoom을 인물 행동 애니메이션으로 보고하지 않는다.",
      "출하 플레이어 New Game에서 정상 완료·건너뛰기·그림 로드·문구 가독성·음악 유지/종료·첫 맵 진입을 확인한다.",
    ],
  };
}
