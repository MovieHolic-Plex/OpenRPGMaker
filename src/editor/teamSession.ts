import { syncTeamReadOnlyUi } from './teamReadOnlyUi';
import { setTeamRole } from '@/project/teamAccess';
import { store } from '@/project/store';
import type { TeamStatus } from '../../electron/shared/team';

let latest: TeamStatus | null = null;
export function teamSessionStatus(): TeamStatus | null { return latest; }

export async function initializeTeamAccess(): Promise<void> {
  if (!window.oprn?.team) return;
  setTeamRole(null);
  try { latest = await window.oprn.team.status(); setTeamRole(latest.member.role); }
  catch { latest = null; }
}

/** Poll the durable revision, not PRAGMA data_version (same-connection writes do not change it). */
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
  bar.setAttribute('aria-label', '팀 연결 상태');
  Object.assign(bar.style, { position: 'fixed', bottom: '14px', left: 'min(340px, 24vw)', maxWidth: 'calc(100vw - 360px)', zIndex: '90', display: 'flex', alignItems: 'center', gap: '10px', background: '#fffdf8', color: '#625b4e', border: '1px solid #ddd4c4', borderRadius: '10px', boxShadow: '0 3px 12px #3027190d', padding: '9px 12px', fontSize: '11px' });
  const text = document.createElement('span');
  bar.append(text);
  if (!window.oprn?.closeIsHostDriven) {
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
      if (latest.revision !== seen && await store.refreshFromHost()) seen = latest.revision;
      text.textContent = `${latest.team.name} · ${latest.member.label}${latest.member.role === 'viewer' ? ' · 보기 전용 — 변경할 수 없습니다' : ''}${seen >= 0 && latest.revision !== seen && store.hasUnsavedChanges() ? ' · 저장 후 팀 변경 반영' : ''}`;
    } catch { setTeamRole(null); syncTeamReadOnlyUi(); latest = null; text.textContent = '팀 연결 끊김 · 저장 상태를 확인하세요'; }
    finally { running = false; }
  };
  void poll();
  const timer = window.setInterval(() => { void poll(); }, 3000);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
}
