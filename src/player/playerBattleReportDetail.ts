import { battleReportResultLabel, normalizeBattleReports, BATTLE_REPORT_LIMIT } from "@/project/battleReports";
import type { StatusMenuDetail, StatusMenuDetailOptions } from "@/player/playerStatusMenuDetailTypes";

export function battleReportDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const reports = normalizeBattleReports(options.session.battleReports);
  const report = options.battleReportIndex === undefined ? undefined : reports[options.battleReportIndex];
  if (!report) return {
    title: `전투 기록 · 최근 ${BATTLE_REPORT_LIMIT}전투`,
    hint: `최근 ${BATTLE_REPORT_LIMIT}전투 보관 · 결정으로 보고서 열기`,
    emptyLabel: "아직 완료한 전투가 없습니다",
    entries: reports.map((entry, index) => ({
      label: entry.troopName, value: battleReportResultLabel(entry.result),
      description: `${entry.turns}턴 · EXP ${entry.exp} · 돈 ${entry.gold}`,
      testId: `status-menu-battle-report-${index}`,
      onActivate: () => options.onSelectBattleReport?.(index),
    })).reverse(),
  };
  return {
    title: `${report.troopName} · ${battleReportResultLabel(report.result)}`,
    hint: report.omittedLines ? `앞선 ${report.omittedLines}개 기록 생략 · 최근 ${report.lines.length}개 표시` : "실제 전투 기록 · ↑↓로 읽기 · Esc 목록",
    entries: [
      { label: "목록으로", value: "", testId: "status-menu-battle-report-back", onActivate: () => options.onSelectBattleReport?.(undefined) },
      { label: "결과", value: `${report.turns}턴`, description: `EXP ${report.exp} · 돈 ${report.gold} · 획득: ${report.items.join(", ") || "없음"}`, testId: "status-menu-battle-report-summary", onActivate: () => {} },
      ...(report.omittedLines ? [{ label: "이전 기록 생략", value: `${report.omittedLines}행`, description: `저장 용량 제한으로 가장 최근 ${report.lines.length}개 기록을 보관합니다.`, onActivate: () => {} }] : []),
      ...report.lines.map(line => ({ label: `#${line.sequence}`, value: line.text, description: line.text, testId: `status-menu-battle-report-line-${line.sequence}`, onActivate: () => {} })),
      ...(report.lines.length ? [] : [{ label: "행동 기록 없음", value: "", description: "이 전투는 기록된 행동 없이 종료되었습니다." }]),
    ],
  };
}
