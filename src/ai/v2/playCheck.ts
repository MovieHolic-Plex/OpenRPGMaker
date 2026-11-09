// 조수 v2 끝맺음 관문의 「끝까지 플레이되는가」 — 엔진 게임 검사(runGameCheck)의 자동 플레이 결과 중 엔딩에 못 가는 막힘(autoplay-failed)만 관문 문제로 올린다.
//
// 왜(2026-11-09 assistant-reward 기준선 16판): 몬스터 수집 두 판은 자동 플레이가 「걸어갈 길이 없다」로 엔딩에 못 닿았는데 «완료»로 끝났다.
// 끝맺음 관문(v2GateProblems)은 정적 출하 검사만 보고 자동 플레이를 부르지 않았다. 경고·판정 보류(autoplay-script-gated)는 막지 않는다 — 거짓 막힘으로 조수를 세우지 않는다.
// 자동 플레이 시간 상한 초과는 «게임이 막혔다»는 증거가 아니라 검사기 쪽 한계라 올리지 않는다. 시간 상한은 엔진 기본(몬스터 캠페인 240초)을 그대로 쓴다.
// 비용: 기준선 16판에서 한 번 70~600ms(몬스터 캠페인 한 판 6초).
import { runGameCheck } from "@/qa/gameCheck";
import { whereText } from "@/qa/gameCheck/types";
import type { Project } from "@/project/types";

export const AUTOPLAY_GATE_PREFIX = "game:autoplay:";
const TIMED_OUT = "자동 플레이 시간 상한 초과";
const FAILED_RUN = /^자동 플레이\((.+?)\)가 「(.+?)」에서 실패했습니다/u;

export interface PlayProblem {
  readonly key: string;
  readonly text: string;
}

const cache = new WeakMap<object, readonly PlayProblem[]>();

export function playProblems(project: Project): readonly PlayProblem[] {
  const hit = cache.get(project);
  if (hit) return hit;
  let out: PlayProblem[] = [];
  try {
    const report = runGameCheck(project);
    out = report.findings.filter((finding) => finding.code === "autoplay-failed" && !finding.message.includes(TIMED_OUT)).map((finding) => {
      const where = whereText(finding.where);
      const run = FAILED_RUN.exec(finding.message);
      return {
        key: run ? `${run[1]}|${run[2]}` : finding.message.slice(0, 80),
        text: `[끝까지 플레이 불가] ${finding.message}${where ? ` (${where})` : ""} — 플레이어가 엔딩까지 걸어서 갈 수 있어야 «완성»이다: 막힌 곳의 길(문·길 잇기·이동 칸)이나 그 단계의 스위치를 켜는 이벤트를 고친 뒤 다시 확인한다. 고치지 못하면 «완성»이라고 쓰지 말고 막힌 곳을 보고에 적는다.`,
      };
    });
  } catch { out = []; }
  cache.set(project, out);
  return out;
}
