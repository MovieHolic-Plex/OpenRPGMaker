// 공포 효과음·환경음 기본 패치 — 음원 묶음에 비명·심장 소리·삐걱임·물방울·웅웅거림이 없다(2026-10-25 공포 트랙 조사:
// searchResources('se','scream'|'heartbeat'|'creak') 가 빈 결과). 없는 소리를 «없는 리소스»로 빼 버리면 깜짝 놀람이 무음이 된다.
// 낱말이 맞으면 generate_original_se(내장 합성)로 한 번 만들고, 같은 이름의 생성음이 이미 있으면 그것을 다시 쓴다. 순수 데이터.
import type { SoundLayer, SoundPatch } from "@/assets/originalSound";

type Preset = { readonly key: string; readonly words: RegExp; readonly name: string; readonly brief: string; readonly patch: SoundPatch };
const L = (wave: SoundLayer["wave"], at: number, duration: number, frequency: number, endFrequency: number, gain: number, attack = 0.01, release = Math.min(0.2, duration / 2), pan = 0): SoundLayer =>
  ({ wave, at, duration, frequency, endFrequency, attack, release, gain, pan });

export const HORROR_SOUNDS: readonly Preset[] = [
  { key: "scream", words: /비명|scream|shriek|절규|울부짖/iu, name: "공포 — 비명", brief: "깜짝 놀람 장면의 날카로운 비명. 높게 치솟았다가 갈라지며 떨어진다.",
    patch: { duration: 1.4, layers: [L("triangle", 0, 0.3, 900, 1650, 0.8, 0.02, 0.05), L("triangle", 0.28, 1.1, 1650, 650, 0.8, 0.02, 0.5), L("square", 0, 1.38, 520, 330, 0.25, 0.03, 0.5), L("noise", 0, 1.3, 3000, 3000, 0.22, 0.01, 0.6), L("sine", 0.05, 1.2, 1700, 1100, 0.3, 0.05, 0.5, 0.3)] } },
  { key: "heartbeat", words: /심장|두근|고동|heart ?beat|heartbeat|pulse/iu, name: "공포 — 심장 고동", brief: "숨어 있을 때 깔리는 낮은 심장 고동 두 번(쿵-쿵). 반복 재생용.",
    patch: { duration: 1.0, layers: [L("sine", 0, 0.16, 75, 42, 1, 0.004, 0.12), L("sine", 0.26, 0.16, 70, 40, 0.8, 0.004, 0.12), L("noise", 0, 0.05, 200, 200, 0.08, 0.002, 0.04)] } },
  { key: "creak", words: /삐걱|끼익|creak|squeak|문 열리는 소리|낡은 문/iu, name: "공포 — 삐걱임", brief: "낡은 문·마룻바닥이 천천히 삐걱이는 소리.",
    patch: { duration: 1.1, layers: [L("square", 0, 0.5, 170, 260, 1, 0.05, 0.2), L("square", 0.45, 0.6, 250, 150, 1, 0.05, 0.3), L("triangle", 0, 1.05, 340, 300, 0.4, 0.1, 0.4, -0.3)] } },
  { key: "drip", words: /물방울|똑똑|drip|water ?drop/iu, name: "공포 — 물방울", brief: "어두운 지하에서 떨어지는 물방울 두 번.",
    patch: { duration: 1.2, layers: [L("sine", 0, 0.09, 1900, 800, 0.7, 0.002, 0.07, -0.4), L("sine", 0.7, 0.09, 1700, 750, 0.5, 0.002, 0.07, 0.4)] } },
  { key: "drone", words: /웅웅|으스스|환경음|공기|불길|ambient|drone|eerie|ominous|저음/iu, name: "공포 — 낮은 웅웅거림", brief: "공포 장소 환경음: 아주 낮게 깔리는 웅웅거림과 바람결. 반복 재생용.",
    patch: { duration: 5, layers: [L("sine", 0, 5, 55, 55, 0.9, 1.2, 1.2), L("triangle", 0, 5, 82, 79, 0.35, 1.5, 1.5, -0.5), L("sine", 0, 5, 110, 113, 0.18, 2, 2, 0.5), L("noise", 0, 5, 300, 300, 0.05, 2, 2)] } },
  { key: "whisper", words: /속삭|수군|whisper/iu, name: "공포 — 속삭임", brief: "어디선가 들리는 알아들을 수 없는 속삭임.",
    patch: { duration: 2.2, layers: [L("noise", 0, 0.35, 2000, 2000, 1, 0.08, 0.2, -0.6), L("noise", 0.5, 0.25, 2000, 2000, 0.85, 0.06, 0.15, -0.4), L("noise", 0.95, 0.45, 2000, 2000, 1, 0.1, 0.25, 0.5), L("noise", 1.6, 0.4, 2000, 2000, 0.7, 0.1, 0.25, 0.7)] } },
  { key: "bang", words: /쾅|쿵|부딪|bang|slam|thud|knock/iu, name: "공포 — 쾅", brief: "문이 세게 닫히거나 무언가 부딪치는 둔탁한 소리.",
    patch: { duration: 0.9, layers: [L("noise", 0, 0.45, 300, 300, 0.8, 0.002, 0.4), L("sine", 0, 0.6, 85, 38, 1, 0.002, 0.5)] } },
  { key: "footsteps", words: /발소리|발걸음|footstep|steps/iu, name: "공포 — 다가오는 발소리", brief: "복도 저편에서 천천히 다가오는 무거운 발소리 네 번.",
    patch: { duration: 2.4, layers: [L("noise", 0, 0.08, 300, 300, 0.25, 0.003, 0.06), L("sine", 0, 0.1, 90, 60, 0.4, 0.003, 0.08), L("noise", 0.6, 0.08, 300, 300, 0.35, 0.003, 0.06), L("sine", 0.6, 0.1, 90, 60, 0.55, 0.003, 0.08), L("noise", 1.2, 0.08, 300, 300, 0.5, 0.003, 0.06), L("sine", 1.2, 0.1, 90, 60, 0.75, 0.003, 0.08), L("noise", 1.8, 0.08, 300, 300, 0.65, 0.003, 0.06), L("sine", 1.8, 0.1, 90, 60, 1, 0.003, 0.08)] } },
];

export function horrorSoundFor(query: string): Preset | undefined {
  return HORROR_SOUNDS.find((s) => s.words.test(query) || s.key === query.trim().toLowerCase());
}
