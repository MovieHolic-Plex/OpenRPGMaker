import { defineHarness } from "../_core/manifest";

/** EasyRPG 24×32 12프레임 도트 저작이 검증된 유일한 권장 LLM 계열. */
export const RECOMMENDED_CHARSET_LLMS = ["carbon", "fable"] as const;

const RECOMMENDED_CHARSET_LLM_PATTERN = /(?:^|[^a-z])(carbon|fable)(?:$|[^a-z])/iu;

export const CHARSET_LLM_WARNING_KO =
  "권장 LLM은 Carbon(gemini-4-carbon 계열)과 Fable(fable 계열)뿐입니다. 이외의 LLM에서는 24×32 12프레임 보행 역학·옆모습 C구역(귀+볼살)·목 수축(ey+3)·중심축 대칭이 무너져 잘 작동하지 않습니다.";

/** 모델 id/표시명이 권장 계열(Carbon 또는 Fable)에 해당하는지 판정한다. */
export function isRecommendedCharsetLlm(model: string | null | undefined): boolean {
  if (!model || !model.trim()) return false;
  return RECOMMENDED_CHARSET_LLM_PATTERN.test(model.trim());
}

/**
 * 비권장 LLM이 지정되었을 때 사용자·에이전트에게 표시할 경고 문구를 돌려준다.
 * 권장 모델(`Carbon` / `Fable`)이면 `null`을 반환한다.
 */
export function charsetLlmWarning(model: string | null | undefined): string | null {
  const trimmed = model?.trim() ?? "";
  if (!trimmed) {
    return `[주의] 모델 미지정 — ${CHARSET_LLM_WARNING_KO}`;
  }
  if (isRecommendedCharsetLlm(trimmed)) return null;
  return `[경고: 비권장 LLM '${trimmed}'] ${CHARSET_LLM_WARNING_KO}`;
}

export const EASYRPG_CHARSET_HARNESS = defineHarness({
  id: "easyrpg-charset",
  title: "EasyRPG 24×32 캐릭터 배치·2단계 관문 (Carbon·Fable 전용)",
  summary:
    "공식 EasyRPG RTP 2등신 뼈대(doll12·partedit·full12) + Carbon/Fable 도트 저작 + 1단계 12프레임 기계 관문 + 2단계 독립 블라인드 시각 QA(SHA-256 잠금)로 RM2000 288×256 캐릭터셋 및 에디터 기본 세트(FantasyPeople 200종)를 제작·설치한다. ※ 권장 LLM: Carbon·Fable 전용(이외 LLM은 잘 작동하지 않음).",
  scope: {},
  triggers: [
    "EasyRPG/RM2000 24×32(288×256) 보행 캐릭터칩을 Nude-Doll(doll12)·부위편집(partedit)으로 신규 양산하거나 FantasyPeople 에디터 기본 세트를 증설·검증할 때 (권장 LLM: Carbon·Fable 전용)",
  ],
  seed: "harness-data/easyrpg-charset/seed.json",
  doc: "openwiki/harnesses/easyrpg-charset.md",
  stages: [
    {
      id: "check-model",
      title: "권장 LLM 점검",
      summary: "[모델명] [--strict] 로 Carbon·Fable 권장 계열 여부를 검사하고, 이외의 LLM이면 오작동 경고를 출력한다.",
    },
    {
      id: "seed",
      title: "작업장 시드 생성",
      summary: "--spec batch.json --out DIR [--model gemini-4-carbon|fable] 로 슬롯별 RTP 마네킹·헤어 교본·작업 지시서(prompt.md)를 생성한다.",
    },
    {
      id: "doll-check",
      title: "단일 슬롯 정밀 관문",
      summary: "--dir SLOT_DIR 로 단일 캐릭터의 12프레임 기계 관문·12배 두상 대조판·8배 보행 역학 대조판을 생성하고 gate.json(SHA-256)을 기록한다.",
    },
    {
      id: "verify",
      title: "배치 1단계 기계 관문",
      summary: "--out DIR 로 배치 전체 슬롯의 눈 대칭·목 수축(ey+3)·옆모습 4대 비례·12프레임 양손/발 접지 관문을 일괄 검사한다.",
    },
    {
      id: "qa-prep",
      title: "2단계 독립 시각 QA 보드",
      summary: "--out DIR 로 1단계 통과 슬롯들의 5배 12프레임 전수 + 1x/2x 비교 보드와 독립 검수관 브리프(critic_prompt.md)를 만든다.",
    },
    {
      id: "qa-verdict",
      title: "해시 잠금 QA 판정 기록",
      summary: "--dir SLOT_DIR --verdict PASS|FAIL --by CRITIC --notes ... 로 독립 시각 QA 판정을 out.chr.txt SHA-256에 묶어 기록한다.",
    },
    {
      id: "pack",
      title: "해시 잠금 시트·GIF 패킹",
      summary: "--out DIR 로 1단계 기계 관문 + 2단계 독립 QA PASS 해시가 모두 일치하는 슬롯만 288×256 시트와 잔디 퍼레이드 GIF로 묶는다.",
    },
    {
      id: "install",
      title: "에디터 기본 세트 설치·검증",
      summary: "[--check] 로 승인된 FantasyPeople 픽셀 격자(기본 200종, FantasyPeople1~25)를 에디터 기본 세트로 굽거나 바이트 일치를 확인한다.",
    },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
