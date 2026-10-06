import type { Project, UploadedAsset } from './types';
import cast from '../../public/assets/emerald-monster/cast/uploaded-cast.json';
import { charsetFrameIndex } from '@/assets/easyrpgRtp';
import { DEFAULT_ACTOR_ID } from './defaults/constants';

const STOCK_CHARSETS = new Set(['tex_easyrpg_charset_people1', 'tex_scarloxy_charset_people1', 'tex_scarloxy_charset_people2', 'oprn_emerald_field_cast_1', 'oprn_emerald_field_cast_2', 'oprn_emerald_signpost']);
const STOCK_HEROES = new Set(['easyrpg-charset-actor1', 'scarloxy-charset-people1', 'oprn_emerald_field_cast_1']);
const SHEETS = ['oprn_emerald_field_cast_1', 'oprn_emerald_field_cast_2'] as const;

/** Replaces stock campaign graphics; authored positions, pages, movement and session remain intact. */
export function configureEmeraldMonsterCast(project: Project): void {
  for (const asset of Object.values(cast) as UploadedAsset[]) {
    project.assets.uploaded[asset.id] = { ...asset, meta: { ...asset.meta } };
  }
  const hero = project.database.actors.find(a => a.id === DEFAULT_ACTOR_ID);
  // 이미 같은 칸이면 손대지 않는다 — 저장소에서 다시 읽은 문서는 characterIndex 0 을 빼고 오는데, 보수가 매번 0 을 다시 써서
  // 문서 지문이 바뀌었고 「마지막 변경 뒤 read_monster_game」 완료 검사가 끝나지 않았다(2026-10-07 사막 기획서 실편집기 녹화).
  if (hero && STOCK_HEROES.has(hero.characterResourceId ?? '') && (hero.characterResourceId !== SHEETS[0] || (hero.characterIndex ?? 0) !== 0)) {
    hero.characterResourceId = SHEETS[0];
    hero.characterIndex = 0;
  }
  for (const map of Object.values(project.maps)) for (const event of map.events) {
    const role = event.id;
    let sheet: 0 | 1 = 0;
    let index = 6;
    if (role.endsWith('_professor') || role.endsWith('_teacher') || role.endsWith('_curator') || role.endsWith('_guide')) index = 2;
    else if (role.endsWith('_rival')) index = 1;
    else if (role.endsWith('_nurse')) index = 3;
    else if (role.endsWith('_shop')) index = 4;
    else if (role.endsWith('_mom') || role.endsWith('_resident') && map.id.endsWith('_home')) index = 5;
    else if (role.endsWith('_local') && map.id.endsWith('_home')) index = 5;
    else if (role.includes('_company_') || role.endsWith('_boss')) { sheet = 1; index = 0; }
    else if (role.endsWith('_captain')) { sheet = 1; index = 1; }
    else if (role.endsWith('_researcher')) { sheet = 1; index = 3; }
    else if (role.endsWith('_leader') && map.id.includes('moon')) { sheet = 1; index = 6; }
    else if (role.endsWith('_leader')) index = 7;
    else if (role.includes('_ambient_resident_') && map.id.endsWith('_home')) {
      sheet = role.endsWith('_2') ? 1 : 0; index = role.endsWith('_2') ? 4 : 6;
    }
    else if (role.includes('_trainer_')) {
      sheet = 1; index = role.endsWith('_0') ? 4 : role.endsWith('_1') ? 5 : 7;
    } else {
      // Stable variety for stock background people, independent of authoring order.
      let hash = 0; for (const char of role) hash = Math.imul(hash, 31) + char.charCodeAt(0);
      if ((hash >>> 0) % 3 === 0) { sheet = 1; index = [2, 4, 5, 7][(hash >>> 0) % 4]!; }
    }
    for (const page of event.pages ?? []) {
      if (!page.graphic.sprite || !STOCK_CHARSETS.has(page.graphic.sprite.id)) continue;
      // Route signs are objects, even though the original campaign used the NPC helper.
      if (role.includes('_sign_')) {
        page.graphic = { ...page.graphic, sprite: { type: 'uploaded', id: 'oprn_emerald_signpost' },
          pattern: charsetFrameIndex({ characterIndex: 0, direction: page.graphic.direction ?? 'down', pattern: 1 }) };
        continue;
      }
      page.graphic = { ...page.graphic, sprite: { type: 'uploaded', id: SHEETS[sheet] },
        pattern: charsetFrameIndex({ characterIndex: index, direction: page.graphic.direction ?? 'down', pattern: 1 }) };
    }
  }
}
