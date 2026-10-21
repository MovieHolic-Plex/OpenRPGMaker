import { syncTeamReadOnlyUi } from './teamReadOnlyUi';
import { setTeamRole } from '@/project/teamAccess';
import { store } from '@/project/store';
import type { TeamStatus } from '../../electron/shared/team';
import { TEAM_COLLAB_ENABLED } from '../../electron/shared/teamCollab';

let latest: TeamStatus | null = null;
export function teamSessionStatus(): TeamStatus | null { return latest; }

export async function initializeTeamAccess(): Promise<void> {
  if (!window.oprn?.team) return;
  setTeamRole(null);
  try { latest = await window.oprn.team.status(); setTeamRole(latest.member.role); }
  catch { latest = null; }
}

/**
 * Poll the durable revision, not PRAGMA data_version (same-connection writes do not change it).
 *
 * 리비전 폴링·역할 읽기는 혼자 쓰는 호스트 프로젝트에도 필요하다(다른 탭·창이 저장한 변경을 받아 온다) — 그대로 둔다.
 * 위에 얹힌 사람 팀 협업 표면(팀 이름·팀원 이름 막대, 「팀 관리 ↗」)은
 * @deprecated multi-user team collaboration is not supported yet (2026-10-21).
 * TEAM_COLLAB_ENABLED 가 꺼져 있으면 막대는 호스트 연결이 끊겼을 때만 「호스트 연결 끊김」으로 뜬다.
 */
export function startTeamSession(): void {
  const bridge = window.oprn?.team;
  if (!bridge) return;
  // `initializeTeamAccess()` already fetched the revision immediately before the
  // project boot. Starting at -1 makes the first poll call refreshFromHost(),
  // which downloads and deserializes the same multi-megabyte project a second
  // time before the editor has even painted its first frame.
  //
  // Keep the earlier revision as the baseline so a write that lands during boot
  // is still detected: the next status response will differ and trigger the
  // normal clean-editor refresh path.
  let seen = latest?.revision ?? -1, running = false;
  const bar = document.createElement('aside');
  bar.className = 'oprn-team-session-bar';
  bar.setAttribute('aria-label', TEAM_COLLAB_ENABLED ? '팀 연결 상태' : '호스트 연결 상태');
  Object.assign(bar.style, { position: 'fixed', bottom: '14px', left: 'min(340px, 24vw)', maxWidth: 'calc(100vw - 360px)', zIndex: '90', display: 'flex', alignItems: 'center', gap: '10px', background: '#fffdf8', color: '#625b4e', border: '1px solid #ddd4c4', borderRadius: '10px', boxShadow: '0 3px 12px #3027190d', padding: '9px 12px', fontSize: '11px' });
  const text = document.createElement('span');
  bar.append(text);
  // 팀 협업을 접어 둔 동안에는 평소 막대를 숨기고, 연결이 끊겼을 때만 보인다.
  // 인라인 display:flex 가 hidden 속성을 이기므로 display 로 직접 끈다.
  const showBar = (visible: boolean): void => { bar.hidden = !visible; bar.style.display = visible ? 'flex' : 'none'; };
  if (!TEAM_COLLAB_ENABLED) showBar(false);
  if (TEAM_COLLAB_ENABLED && !window.oprn?.closeIsHostDriven) {
    const link = document.createElement('a'); link.href = '/__oprn/team' + (new URLSearchParams(location.search).has('hostProject') ? '?hostProject=' + encodeURIComponent(new URLSearchParams(location.search).get('hostProject')!) : ''); link.target = '_blank'; link.rel = 'noopener';
    Object.assign(link.style, { color: '#596c50', fontWeight: '600', whiteSpace: 'nowrap', textDecoration: 'none' });
    link.textContent = '팀 관리 ↗'; bar.append(link);
  }
  document.body.append(bar);
  syncTeamReadOnlyUi();
  const poll = async () => {
    if (running) return;
    running = true;
    try {
      latest = await bridge.status();
      setTeamRole(latest.member.role);
      syncTeamReadOnlyUi();
      // Our own autosave bumps the revision too; refetching it downloaded and re-hashed
      // the whole project a few seconds after every save.
      if (latest.revision !== seen && store.isOwnSavedHostRevision(latest.revision)) seen = latest.revision;
      if (latest.revision !== seen && await store.refreshFromHost()) seen = latest.revision;
      if (!TEAM_COLLAB_ENABLED) { showBar(false); return; }
      text.textContent = `${latest.team.name} · ${latest.member.label}${latest.member.role === 'viewer' ? ' · 보기 전용 — 변경할 수 없습니다' : ''}${seen >= 0 && latest.revision !== seen && store.hasUnsavedChanges() ? ' · 저장 후 팀 변경 반영' : ''}`;
    } catch {
      // 팀 협업이 꺼져 있으면 연결이 끊겨도 역할을 지우지 않는다 — 편집은 계속되고, 저장은 자동 저장 재시도가 맡는다.
      if (TEAM_COLLAB_ENABLED) { setTeamRole(null); syncTeamReadOnlyUi(); }
      latest = null;
      showBar(true);
      text.textContent = TEAM_COLLAB_ENABLED ? '팀 연결 끊김 · 저장 상태를 확인하세요' : '호스트 연결 끊김 · 편집은 계속됩니다. 다시 연결되면 자동 저장합니다';
    }
    finally { running = false; }
  };
  void poll();
  const timer = window.setInterval(() => { void poll(); }, 3000);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
}
