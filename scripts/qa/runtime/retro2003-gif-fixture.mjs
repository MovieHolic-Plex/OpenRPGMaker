// 정본·원본 픽스처는 건드리지 않는다. 녹화에 건네는 사본에만 걷기 칩 시트를 연결한다.
import { readFile } from 'node:fs/promises';
import { createRetro2003Fixture } from './retro2003-fixture.mjs';

export async function recordingFixture(projectPath) {
  const base = projectPath ? null : createRetro2003Fixture();
  try {
    const input = projectPath ? JSON.parse(await readFile(projectPath, 'utf8')) : base.project;
    const project = structuredClone(input.project ?? input);
    project.system.battleUiStyle = 'retro2003';
    project.system.battleFlow = 'gauge';
    const replacements = [];
    for (const actor of project.database.actors) {
      // 이미 통합된 걷기 칩 배틀러는 보존한다. 옛 생성 영웅과 빈 배틀러만 교체한다.
      if (actor.battleCharacterResourceId && !/^(hero|generated-actor-hero-\d+-battle)$/.test(actor.battleCharacterResourceId)) continue;
      const sheet = actor.characterResourceId?.match(/actor([1-4])/i)?.[1] ?? '1';
      const index = Math.max(0, Math.min(7, actor.characterIndex ?? 0));
      const id = `actor${sheet}-${index}`;
      const resourceId = `generated-actor-charset-${id}-battle`;
      const bytes = await readFile(new URL(`../../../public/assets/generated/charset-battlers/${id}.png`, import.meta.url));
      project.assets.uploaded[resourceId] = {
        id: resourceId, name: `걷기 칩 전투 ${id}`, kind: 'battleCharset',
        dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
        meta: { width: 144, height: 384, frameWidth: 48, frameHeight: 48, frames: 24 },
      };
      actor.battleCharacterResourceId = resourceId;
      actor.characterResourceId = `easyrpg-charset-actor${sheet}`;
      replacements.push({ actor: actor.id, sheet: id });
    }
    // 데모 적의 원래 HP 18은 첫 공격에 사라진다. 모든 수동 구간을 찍을 만큼만 늘린다.
    if (!projectPath) for (const enemy of project.database.enemies) {
      if (['enemy_slime', 'enemy_cave_bat'].includes(enemy.id)) enemy.stats.maxHp = 220;
    }
    // 마법마다 시전 동작이 다르다 — 녹화에서 마도사가 화염(fire)과 비전(arcane)을 둘 다 쓸 수 있게 한다.
    const mage = project.database.actors.find((actor) => actor.id === 'actor_mage');
    if (mage && project.database.skills.some((skill) => skill.id === 'skill_fire') && !mage.learnedSkills.some((row) => row.skillId === 'skill_fire')) {
      mage.learnedSkills = [...mage.learnedSkills, { level: 1, skillId: 'skill_fire' }];
    }
    const candidates = [];
    for (const [mapId, map] of Object.entries(project.maps)) for (const event of map.events ?? []) {
      for (const page of event.pages?.length ? event.pages : [event]) {
        const battle = page.commands?.find((command) => command.kind === 'battleProcessing');
        if (battle && !(page.conditions?.length) && (page.trigger ?? event.trigger)?.kind === 'action') {
          candidates.push({ mapId, x: event.x, y: event.y + 1, troopId: battle.troopId, eventId: event.id });
        }
      }
    }
    const entry = candidates.find((candidate) => candidate.eventId === 'ev_map_moonwell_forest_seal') ?? candidates[0];
    if (!entry) throw new Error('--project에는 조건 없는 결정키 전투 이벤트가 필요합니다.');
    return { project, entry, replacements, cleanup: () => base?.cleanup() };
  } catch (error) { base?.cleanup(); throw error; }
}
