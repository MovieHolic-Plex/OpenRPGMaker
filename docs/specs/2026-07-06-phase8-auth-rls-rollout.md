# Phase 8 Auth/RLS Rollout Draft

Date: 2026-07-06

Status: draft only. Do not apply the paired `supabase/migrations/DRAFT_20260706_auth_rls.sql` to a live database without rehearsal, owner backfill, and client auth work.

## Goal

Move RPG ZZU from the current "anon key has full CRUD and RLS is off" model to Supabase Auth plus project membership RLS. Browser writes should happen under a signed-in human user's session. Server-side automation may write only through a service-role context owned by the Phase 7B job server design.

## Rollout Stages

1. Auth activation and login UI

   Enable Supabase Auth providers and add app login/logout/session handling before tightening database access. The REST client must keep the public anon key in `apikey`, but `Authorization` must become `Bearer <user access token>` after sign-in. Anonymous app state should be read-only or explicitly blocked from remote sync.

2. Existing project owner backfill script design

   Write a one-off service-role script that creates/updates `rpg_zzu.profiles` and inserts one `rpg_zzu.project_members` owner row per existing project. The script must be dry-run first, print project counts and proposed owner assignments, and avoid storing service-role keys in the repo or evidence. Single shared projects need a human decision for the first owner.

3. Dual mode

   Apply membership tables, helper function, RLS enablement, authenticated grants, and policies in a disposable environment first. For production rollout, keep anon grants until the app has shipped auth headers and all existing projects have owner rows. During this window RLS protects authenticated traffic, but anon grants still allow legacy clients, so it is compatibility mode rather than the final security boundary.

4. anon REVOKE switchover

   After the shipped app uses user access tokens and telemetry/logs show no legacy anon-only writers, run only the switch-over block from the draft migration:

   - `REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA rpg_zzu FROM anon`
   - `REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA rpg_zzu FROM anon`
   - `REVOKE USAGE ON SCHEMA rpg_zzu FROM anon`
   - matching `ALTER DEFAULT PRIVILEGES ... REVOKE ... FROM anon`

5. Incident rollback

   If the switchover blocks legitimate users, first restore anon grants to recover availability. If policy logic itself is bad, drop policies before disabling RLS so the rollback order is explicit and reviewable:

   - Restore emergency grants to `anon` only if needed for immediate recovery.
   - Drop policies on dependent tables first: `project_changes`, `project_commits`, `map_edit_locks`, `ai_analysis_runs`, `sync_verification_runs`, `maps`, `tilesets`, `terrain_templates`, `projects`.
   - Drop `project_members` policies next, then `profiles` policies.
   - Disable RLS on the same tables only after policy drops are confirmed.
   - Keep `profiles`, `project_members`, and `is_project_member` in place unless their presence is the incident trigger; they are needed for a corrected rollout.

## Client Impact

`src/project/supabaseProjectConfig.ts` currently models only `{ url, anonKey, projectId }`. Phase 8 needs a session-aware config shape or request helper that can supply both `apikey: anonKey` and `Authorization: Bearer <access_token>`. The current local storage field named `anonKey` should remain public-key-only; user tokens must come from Supabase Auth session state, not saved in the existing custom config blob.

`src/project/supabaseProjectSync.ts` calls affected by auth headers:

| Function | Current REST behavior | Phase 8 impact |
| --- | --- | --- |
| `listSupabaseProjects` | `GET /rest/v1/projects` with anon bearer | Must list only projects visible to `auth.uid()` through `project_members`; signed-in token required. |
| `loadProjectFromSupabase` / `loadProjectSnapshotFromSupabase` | `GET /rest/v1/projects?project_id=eq...` with anon bearer | Viewer or higher membership required; unauthenticated users should get a login/read-only path instead of an empty-project ambiguity. |
| `saveProjectToSupabase` | `POST /rest/v1/projects?on_conflict=project_id` with anon bearer | Editor or owner required by `projects` policy; write must use signed-in user access token. |
| `saveProjectMapPatchToSupabase` | Reads latest snapshot, checks conflicts, then writes project/maps | Every internal read/write in the patch loop must carry the same user token so conflict resolution sees the member-visible canonical state. |
| `recordSupabaseAiAnalysisRun` | `POST /rest/v1/ai_analysis_runs` with anon bearer | Editor or owner required; the run records a human-session action even if the assistant generated the analysis. |
| `saveProjectSnapshotToSupabase` | `POST` for new row or conditional `PATCH` by sha | Editor or owner required; conditional update failures must still distinguish conflict from auth denial. |
| `saveProjectChildRows`, `replaceRows`, `saveChangedMapRows`, `saveChangedMapRowsFromCanonical` | Delete/upsert child rows for maps and tilesets | Child table deletes/upserts require editor or owner; partial failures need user-facing auth errors because RLS can reject child rows after project snapshot success. |
| `deleteProjectRows`, `deleteMapRows`, `upsertRows` | Shared low-level DELETE/POST helpers | Must use token-aware headers and preserve `Accept-Profile` / `Content-Profile: rpg_zzu`. |
| `supabaseJsonHeaders` | Sets `apikey` and `Authorization` to `anonKey` | Must become the single place that separates public `apikey` from user/session `Authorization`. |

Adjacent client surface: `src/editor/mapEditLocks.ts` has its own `supabaseLockHeaders` helper and performs `GET`, `POST`, and `DELETE` against `map_edit_locks`. It must receive the same Auth session token, because lock rows are protected by project membership in the RLS draft.

## Agent Identity

Do not add browser assistants as separate rows in `project_members`. The membership table answers "which human or service principal can access this project," while editor provenance answers "who or what authored this change." In browser-agent mode, the assistant acts under the signed-in human's session, so RLS should see the human user. Commit history and audit records should distinguish assistant work through `author.kind` or equivalent provenance fields, not through a fake Supabase user that would own database permissions.

Server-side job agents are different: Phase 7B job infrastructure may use a service-role context for controlled writes. Those writes must be isolated to server code with key management outside the browser and should still stamp commit/run provenance as an agent action.

## RLS Design Notes

The draft helper `rpg_zzu.is_project_member(project_id, min_role)` maps `viewer < editor < owner` and checks the current `auth.uid()`. It is `SECURITY DEFINER` so policies can use it consistently, including `project_members` policies, without relying on caller visibility of membership rows.

Existing project-scoped tables follow the same model: `SELECT` requires project membership, and `INSERT` / `UPDATE` / `DELETE` require `editor` or `owner`. `project_changes` resolves membership through `project_commits.commit_id` because it does not store `project_id` directly.

`project_members` allows members to read membership for their projects, but only owners can insert, update, or delete membership rows. Initial owner rows must therefore be created by the backfill script or service-role admin flow.

`profiles` are self-managed, with peer visibility for users who share a project. This supports member lists without making every profile globally readable.

## Open Questions

- Login method: email magic link/password, OAuth, or both?
- Who is the initial owner for the current single shared canonical project?
- Should viewers be able to open the editor in strict read-only mode, or should non-editors be routed away from authoring surfaces?
- Do project creators become owners through a server RPC, a service-role endpoint, or a client insert after a pre-created membership row?
- Should `project_commits` get explicit author columns before Auth/RLS switchover, or remain outside this migration?
- What is the minimum telemetry/logging needed before anon grant revocation is considered safe?
- How should inactive or expired Supabase users be removed from `project_members` without deleting audit history?

## Static SQL Validation Limit

This draft was locally checked without connecting to Supabase or Postgres. The check can catch missing files, unbalanced `$...$` blocks, rough parenthesis imbalance, and missing semicolon terminators; it cannot prove extension availability (`gen_random_uuid()`), policy recursion behavior under the actual owner role, grant ownership, or query plans.

---

## 결정 사항 (2026-07-06, 감독 판단 — 사용자 위임)

1. **commit_identity 마이그레이션**: 실 DB 적용 완료(2026-07-06). supabase-db(postgres)에 신원/리뷰 컬럼 6종 + CHECK(NOT VALID) + 인덱스. PostgREST 읽기 스모크 통과. 커밋 이력 기록은 이제 라이브.
2. **로그인 방식**: 이메일(매직링크 포함) 우선 도입. OAuth는 필요 시 후속(사용자 요구 발생 시).
3. **기존 공유 프로젝트 최초 owner**: hyeonseokoh94@gmail.com 계정으로 백필.
4. **viewer 역할**: read-only 에디터 허용(리뷰 워크플로 지원 목적). 뮤테이션은 RLS가 차단.
5. 신규 프로젝트 owner 부여: RPC(SECURITY DEFINER) 방식 채택 예정 — client 사전 멤버십 삽입은 RLS와 순환 문제, service-role은 7B 잡 서버 이후 가능하므로.
