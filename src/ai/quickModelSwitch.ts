// 조수 머리줄·작업 설정 팝오버에서 쓰는 「지금 모델」 읽기와 한 번에 바꾸기.
//
// 역할별 모델(계획·실행·시공)은 고급 설정에 그대로 있다. 여기서는 「지금 쓰는 제공자」 안에서 모델 하나만 골라
// 그 제공자에 묶인 주요 역할(계획·실행·시공·작문)을 함께 옮긴다. 다른 제공자에 둔 역할과 화면 이해(vision)는 건드리지 않는다.
import type { AiConfig } from "./llmClient";
import { latestModelsFor } from "./modelCatalog";
import { DEFAULT_ULTRABRAIN_PROVIDER } from "./ultrabrainConfig";
import { modelForRole, type RoleModel, type SpecialistRole } from "./modelRoles";

/** 조수가 실제로 일을 하는 모델 — 「실행 · 검증」 칸. 머리줄 칩과 모델 목록의 선택 표시가 쓴다. */
export function activeModelId(config: AiConfig): string {
  return modelForRole(config, "deep").model;
}

/** 지금 제공자에서 고를 수 있는 모델. 지금 모델이 목록 밖(직접 입력)이어도 맨 앞에 넣어 선택 상태가 보이게 한다. */
export function quickModelOptions(config: AiConfig): readonly string[] {
  const active = activeModelId(config);
  const listed = latestModelsFor(config.providerId);
  return active && !listed.includes(active) ? [active, ...listed] : listed;
}

const MOVED_ROLES: readonly SpecialistRole[] = ["deep", "build", "writer"];

/** 같은 제공자에 묶인 계획·실행·시공·작문 칸의 모델을 `model` 로 맞춘 새 설정. */
export function configWithQuickModel(config: AiConfig, model: string): AiConfig {
  const providerId = config.providerId;
  const roleModels = { ...(config.roleModels ?? {}) };
  for (const role of MOVED_ROLES) {
    const entry: RoleModel | undefined = roleModels[role];
    if (entry && entry.provider === providerId) roleModels[role] = { ...entry, model };
  }
  const plannerHere = (config.ultrabrainProviderId ?? DEFAULT_ULTRABRAIN_PROVIDER) === providerId;
  return {
    ...config,
    model,
    liteModel: model,
    ...(Object.keys(roleModels).length > 0 ? { roleModels } : {}),
    ...(plannerHere ? { ultrabrainModel: model } : {}),
    // 직접 고른 칸이라고 표시해 자동 배정이 되돌리지 않게 한다.
    modelSelectionOverrides: { ...(config.modelSelectionOverrides ?? {}), deep: true, ...(plannerHere ? { ultrabrain: true } : {}) },
  };
}
