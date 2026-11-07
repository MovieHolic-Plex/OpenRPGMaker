// ai/imageModelResolution.ts
// 「그림 모델 이름을 코드에 박지 않는다」 — 제공자가 보고한 목록에서 지금 가장 새 그림 모델을 고르는 순수 함수.
//
// 왜(2026-11-07 실측): Codex 경로는 `gpt-image-2.5-sunburst` 를 **고정해서** 보냈고, 같은 요청에서
// `image_generation.model` 을 빼자 백엔드가 스스로 `gpt-image-2-codex` 를 골라 응답 tools[] 에 되돌려 줬다.
// 즉 고정값이 라우트가 실제로 쓰는 모델보다 낡은 값을 사용자에게 보이게 하고 있었다(오너: 「왜 gpt image 1 이야」).
// 그래서 기본값은 목록에서 계산하고, 응답이 모델을 말하면 그 값을 그대로 기록한다.
//
// 이 파일은 DOM·Node 전용 API 를 쓰지 않는다(브라우저 번들과 Bun 워커가 같이 쓴다).

export interface ImageModelCandidate {
  readonly id: string;
  readonly kind?: string;
  readonly revision?: string | null;
  readonly priority?: number | null;
}

function versionParts(value: string | null | undefined): number[] {
  if (!value) return [];
  return value
    .split(/[.\-+_]/u)
    .map((part) => Number.parseInt(part.replace(/\D.*$/u, ""), 10))
    .filter((part) => Number.isFinite(part));
}

/** a > b 면 양수. 숫자 조각을 앞에서부터 비교하고, 짧은 쪽의 빈 자리는 0 으로 본다. */
export function compareImageModelVersions(a: string | null | undefined, b: string | null | undefined): number {
  const left = versionParts(a);
  const right = versionParts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l !== r) return l - r;
  }
  return 0;
}

/**
 * 목록에서 지금 쓸 그림 모델 하나를 고른다: kind==='image' 만 → priority 작은 것 → revision 큰 것 → id 큰 것(결정적).
 * 고를 것이 없으면 null — 「모른다」를 새 이름으로 대신하지 않고 호출자가 자기 최후 수단을 쓰게 한다.
 */
export function pickNewestImageModel(candidates: readonly ImageModelCandidate[]): string | null {
  const imageOnly = candidates.filter((candidate) => candidate.kind === "image" && candidate.id.trim().length > 0);
  if (imageOnly.length === 0) return null;
  const ranked = [...imageOnly].sort((a, b) => {
    const priorityA = a.priority ?? Number.POSITIVE_INFINITY;
    const priorityB = b.priority ?? Number.POSITIVE_INFINITY;
    if (priorityA !== priorityB) return priorityA - priorityB;
    const byRevision = compareImageModelVersions(b.revision, a.revision);
    if (byRevision !== 0) return byRevision;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
  return ranked[0]!.id;
}

/** 제공자가 응답에서 모델 이름을 되돌려 줬으면 그 값, 아니면 null. */
export function reportedImageModel(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
