// editor/tools/genreLockTools.ts
// check_genre_lock — 장르 칩셋 잠금(project/genreLock.ts) 상태와 위반 맵을 보고한다. 읽기 전용.
// 얼굴·전투 그림(2026-10-16): 쓰이는 허용 밖 그림(가장 가까운 허용 그림 포함)과 그림이 비어 「생성 대기」인 칸(트레이너 전투 그림·몬스터 전투 그림)도 같이 보고한다.
// 「잠금을 켠 뒤에 생긴 허용 밖 맵」(고쳐야 할 것)과 「잠금 이전부터 있던 허용 밖 맵」(막지 않음, 사용자가 옮길지 정함)을 나눠 보고한다.

import { genreLockAlternative, genreLockReport } from "@/project/genreLock";
import { CHARSET_FAMILY_LABELS, charsetFamilyOf } from "@/project/charsetFamily";
import { genreLockVisualReport } from "@/project/genreLockVisuals";
import { monsterAssetStatus } from "@/project/genreLockMonsterAssets";
import { activeMonsterTurn } from "@/project/genreLockMonsterAssets";
import { tilesetFamilyLabel } from "@/project/tilesetFamily";
import type { ToolDefinition, ToolExecResult } from "./types";

const checkGenreLock: ToolDefinition = {
  name: "check_genre_lock",
  description: "장르 칩셋 잠금 상태를 확인한다 — 잠금 여부·모드·허용 칩셋 목록, 허용 계열 밖 칩셋을 쓰는 맵(잠금 이후에 생긴 것 / 잠금 이전부터 있던 것을 나눠서)과 맵마다 가장 가까운 허용 칩셋 대안. "
    + "얼굴·전투 그림(몬스터·트레이너·전투 배경) 쪽 허용 밖 그림과 그림이 비어 「생성 대기」인 칸도 같이 보고한다. "
    + "허용 밖 캐릭터 칩(맵 이벤트·동료/파티 명령이 부르는 배우·전투 그림 — 잠금 이후/이전부터를 나눠서)도 센다. 몬스터 수집·연애 게임을 만든 뒤·맵을 여럿 만든 뒤 마지막에 부른다. 이 도구는 읽기만 하며 맵을 고치지 않는다.",
  mode: "read",
  domains: ["core", "map", "system"],
  parameters: { type: "object", properties: {}, additionalProperties: false },
  run(project): ToolExecResult {
    const report = genreLockReport(project);
    if (!report.active) {
      // 몬스터 수집 게임이 아닌 프로젝트에는 몬스터 도구 이름을 광고하지 않는다 — 잠금 이름도 「몬스터 자산 잠금」 상태만 알린다.
      const monsterAssets = monsterAssetStatus(project, activeMonsterTurn());
      const hint = monsterAssets.allowed ? " 몬스터 수집 게임이면 configure_monster_system(enabled:true) 가 켠다." : "";
      return { summary: `장르 잠금이 꺼져 있다 — 칩셋 계열 제한이 없다.${hint} 몬스터 자산: ${monsterAssets.allowed ? "허용" : "막힘"} — ${monsterAssets.reason}.`, data: { active: false, monsterAssets } };
    }
    const describe = (v: (typeof report.violations)[number]) => ({
      mapId: v.mapId, mapName: v.mapName, tilesetId: v.tilesetId, family: tilesetFamilyLabel(project, v.family),
      nearestAllowed: genreLockAlternative(project, `${v.tilesetId} ${v.mapName}`)?.tilesetId ?? null,
    });
    const issues = report.violations.map((v) => ({
      severity: "warning" as const, code: "opt-in:genre-lock-violation", mapId: v.mapId,
      message: `맵 ${v.mapId}「${v.mapName}」이 장르 잠금 밖 칩셋 ${v.tilesetId}(${tilesetFamilyLabel(project, v.family)})를 쓴다.`,
    }));
    // 허용 밖 캐릭터 칩(잠금 이후 / 이전부터) — 이벤트 걷기 그림·배우·동료/파티 명령이 가리키는 배우·전투 그림·옛 sprite·종 필드 그림(2026-10-16 잠금 누수 감사 #3·#4·#9·#10).
    const chipLine = (chip: (typeof report.charsetViolations)[number]) => ({
      where: chip.where, chip: chip.resourceId ? `${chip.resourceId}#${chip.characterIndex}` : `appearanceId ${chip.unresolved}`,
      family: chip.resourceId ? CHARSET_FAMILY_LABELS[charsetFamilyOf(project, chip.resourceId)] : "알 수 없는 외형 id",
      ...(chip.viaActor ? { via: `동료·파티 명령 → 배우 ${chip.viaActor}` } : {}), ...(chip.battler ? { via: `전투 그림 ${chip.battler}` } : {}),
    });
    const chipIssues = report.charsetViolations.slice(0, 20).map((chip) => ({
      severity: "warning" as const, code: "opt-in:genre-lock-charset-violation",
      message: `${chip.where} 이 장르 잠금 밖 캐릭터 칩을 쓴다: ${chipLine(chip).chip} (${chipLine(chip).family})${chip.viaActor ? ` — 동료·파티 명령이 배우 ${chip.viaActor} 를 가리킨다` : ""}.`,
    }));
    const visual = genreLockVisualReport(project);
    const visualText = visual.active
      ? ` 얼굴·전투 그림: 허용 밖 ${visual.outsiders.length}곳, 생성 대기 ${visual.pending.length}칸.`
      : "";
    const chipText = report.charsetViolations.length || report.charsetPreexisting.length
      ? ` 캐릭터 칩: 잠금 이후 허용 밖 ${report.charsetViolations.length}곳, 잠금 이전부터 있던 허용 밖 ${report.charsetPreexisting.length}곳(막지 않았다 — 사용자가 시킬 때만 허용 칩으로 바꾼다).`
      : "";
    return {
      summary: `장르 잠금 ${report.mode === "warn" ? "경고 모드" : "강제"} — 허용 칩셋 ${report.allowedTilesets.length}개. `
        + `잠금 이후 위반 맵 ${report.violations.length}개, 잠금 이전부터 있던 허용 밖 맵 ${report.preexisting.length}개(막지 않았다).${visualText}${chipText}`,
      ...(issues.length || chipIssues.length ? { issues: [...issues, ...chipIssues] } : {}),
      data: {
        active: true, monsterAssets: monsterAssetStatus(project, activeMonsterTurn()), preset: report.preset, mode: report.mode, allowedFamilies: report.allowedFamilies, allowedTilesets: report.allowedTilesets,
        violations: report.violations.map(describe), preexisting: report.preexisting.map(describe),
        ...(report.charsetViolations.length || report.charsetPreexisting.length ? { charsets: { violations: report.charsetViolations.slice(0, 40).map(chipLine), preexisting: report.charsetPreexisting.slice(0, 40).map(chipLine) } } : {}),
        ...(visual.active ? { visuals: { faceFamilies: visual.faceFamilies, battleFamilies: visual.battleFamilies, outsiders: visual.outsiders.slice(0, 40), pending: visual.pending.slice(0, 40) } } : {}),
      },
    };
  },
};

export const GENRE_LOCK_TOOLS: readonly ToolDefinition[] = [checkGenreLock];
