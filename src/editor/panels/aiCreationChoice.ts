import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { treeKitForTileset, stampTree } from "@/editor/tools/village/treeKit";
import { defaultOutdoorTilesetId } from "@/project/defaults/forestHarmony";
import { el } from '@/util/dom';
import type { GameMap, Project, TilesetDef } from '@/project/types';
import { stampRectHouseKit, type HouseKitId } from '@/editor/houseKit';
import { drawMapTileLayers, loadTilesetImage } from '@/editor/mapTileDraw';
import { loadKeyedCharsetImage } from '@/ai/toolImageCanvas';
import { isCombinedTownCompatibleTileset } from '@/project/tilesetHarness';

/** Bounded creation intent; questions, negation and small edits must not open a choice gate. */
export function creationSubject(text: string): string | null {
  if (/(방법|어떻게|설명|알려|가능|계획|만들지\s*마|짓지\s*마|수정|고쳐|옮겨|바꿔|추가|how\b|explain|don't|do not|fix\b|move\b|add\b)/iu.test(text)) return null;
  if (!/(만들|지어|짓고|생성|꾸며|조성|build\b|create\b|make\b)/iu.test(text)) return null;
  if (/(마을|도시|정착지|village|town|city)/iu.test(text)) return '마을';
  if (/(집|주택|house|cottage)/iu.test(text)) return '집';
  return null;
}

const styles: readonly { kit: HouseKitId; name: string; detail: string }[] = [
  { kit: 'bright-plaster', name: '햇살 드는 시골', detail: '따뜻한 지붕 · 밝은 벽' },
  { kit: 'blue-stone', name: '모험이 시작되는 마을', detail: '푸른 기와 · 밝은 벽' },
  { kit: 'amber-wood', name: '숲속의 작은 정착지', detail: '따뜻한 지붕 · 나무 벽' },
];
const characters = [
  { name: '마을 주민', sheet: 'People1', resource: 'easyrpg-charset-people1', indices: [0, 1] },
  { name: '모험가', sheet: 'Actor1', resource: 'easyrpg-charset-actor1', indices: [0, 1] },
  { name: '숲의 주민', sheet: 'People1', resource: 'easyrpg-charset-people1', indices: [4, 6] },
] as const;

async function characterCanvas(index: number): Promise<HTMLCanvasElement> {
  const set = characters[index]!;
  const image = await loadKeyedCharsetImage(`${import.meta.env.BASE_URL}assets/easyrpg/charset/${set.sheet}.png`);
  const canvas = el('canvas'); canvas.width = 88; canvas.height = 48;
  const c = canvas.getContext('2d'); if (!c) throw new Error('이미지를 그릴 수 없습니다.');
  c.imageSmoothingEnabled = false;
  set.indices.forEach((n, i) => c.drawImage(image, (n % 4) * 72 + 24, Math.floor(n / 4) * 128, 24, 32, 8 + i * 40, 8, 24, 32));
  return canvas;
}

/** A disposable sample, never inserted into store or offered as a completed game map. */
async function scene(tileset: TilesetDef, style: number, people: number): Promise<HTMLCanvasElement> {
  const map: GameMap = { id: 'graphic-choice-preview', name: '그래픽 비교용 집', width: 20, height: 15, tileSize: 16,
    tilesetId: tileset.id, lowerTiles: Array(300).fill(240), upperTiles: Array(300).fill(-1), events: [] };
  const house = stampRectHouseKit(map, { x: 6, y: 3, width: 8, stories: 1, roofBodyRows: 2, kitId: styles[style]!.kit });
  if (!house.ok || !house.doorAt) throw new Error('집 미리보기를 만들 수 없습니다.');
  const door = house.doorAt;
  map.lowerTiles[(door.y - 1) * map.width + door.x] = 116;
  map.lowerTiles[door.y * map.width + door.x] = 146;
  for (let y = door.y + 1; y < map.height; y++) for (let x = door.x; x <= door.x + 1; x++) map.lowerTiles[y * map.width + x] = 360;
  const road = autotileGroupsForTileset(tileset).find(group => group.memberTileIds.includes(360));
  if (road) shapeAutotileGroupAround(map, road, map.lowerTiles.flatMap((tile, i) => tile === 360
    ? [{ x: i % map.width, y: Math.floor(i / map.width) }] : []));
  const tree = treeKitForTileset(tileset).medium;
  for (const x of [2, 16]) stampTree(map, tree, x, 6);
  const [atlas, sprites] = await Promise.all([loadTilesetImage(tileset), characterCanvas(people)]);
  const canvas = el('canvas'); canvas.width = 320; canvas.height = 240;
  const c = canvas.getContext('2d'); if (!c) throw new Error('이미지를 그릴 수 없습니다.');
  c.imageSmoothingEnabled = false;
  drawMapTileLayers(c, atlas, map, tileset, 1);
  c.drawImage(sprites, 111, 164);
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${styles[style]!.name}, ${characters[people]!.name} 조합 예시`);
  return canvas;
}

export interface CreationChoiceResult { instruction: string; label: string; image: string }
export function createCreationChoice(project: Project, subject: string): {
  root: HTMLElement; reference: HTMLElement; result: Promise<CreationChoiceResult | null>; cancel(): void;
} | null {
  const tilesets = Object.values(project.tilesets).filter(isCombinedTownCompatibleTileset);
  if (!tilesets.length) return null;
  const preferred = defaultOutdoorTilesetId(project);
  tilesets.sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred));
  let tileset = tilesets[0]!, selected: number | null = null, people = 0, revision = 0, settled = false;
  let resolve!: (value: CreationChoiceResult | null) => void;
  const result = new Promise<CreationChoiceResult | null>(r => { resolve = r; });
  const cache = new Map<string, Promise<HTMLCanvasElement>>();
  const preview = (style: number, chars: number) => {
    const key = `${tileset.id}:${style}:${chars}`;
    let p = cache.get(key); if (!p) { p = scene(tileset, style, chars); cache.set(key, p); p.catch(() => cache.delete(key)); }
    return p;
  };
  const root = el('section', { class: 'ai-creation-choice', dataset: { testid: 'ai-creation-choice' }, attrs: { 'aria-label': '제작 전 그래픽 선택' } });
  const reference = el('section', { class: 'ai-creation-reference', dataset: { testid: 'ai-creation-reference' } });
  const finish = (value: CreationChoiceResult | null) => { if (settled) return; settled = true; revision++; root.remove(); reference.remove(); resolve(value); };
  const button = (text: string, action: () => void, cls = '', testid = '') => el('button', { text, class: cls, attrs: { type: 'button' }, dataset: testid ? { testid } : {}, on: { click: action } });
  const imageNode = (canvas: HTMLCanvasElement) => el('img', { attrs: { src: canvas.toDataURL(), alt: canvas.getAttribute('aria-label') ?? '그래픽 예시' } });
  const render = async () => {
    const token = ++revision;
    const title = el('h2', { text: selected === null ? `어떤 모습의 ${subject}로 만들까요?` : '집과 캐릭터, 이 조합은 어떤가요?', attrs: { tabindex: '-1' } });
    const body = el('div', { class: 'ai-creation-body' });
    const feedback = el('p', { class: 'ai-creation-feedback', attrs: { role: 'status' } });
    const start = button(`이 조합으로 ${subject} 만들기 →`, () => {
      if (selected === null || start.disabled) return;
      const s = styles[selected]!, chars = characters[people]!;
      const image = body.querySelector('img')?.src ?? '';
      finish({ label: `${s.name} · ${chars.name}`, image,
        instruction: `[사용자가 확인한 그래픽 조합]\n칩셋: ${tileset.id} (${tileset.name}). 집 키트: ${s.kit} (${s.detail}). 캐릭터 리소스: ${chars.resource}, 캐릭터 인덱스: ${chars.indices.join(', ')}.\n이 리소스와 키트를 제작 기준으로 사용하라. 필요하면 제공된 도구로 리소스를 조회하라. 샘플은 집 하나의 그래픽 비교용이며 마을 전체 배치나 규모는 원래 요청을 따른다. 다른 칩셋으로 바꾸거나 기존 맵의 칩셋을 일괄 교체하지 마라. 선택한 조합을 사용할 수 없다면 대체 실행하지 말고 이유를 보고하라.` });
    }, 'is-primary', 'ai-creation-start');
    start.disabled = true;
    root.replaceChildren(el('div', { class: 'ai-creation-steps', text: '01  그래픽 선택    /    02  제작 시작' }), title,
      el('p', { class: 'ai-creation-intro', text: '작은 집 한 채로 분위기를 비교해 보세요. 실제 칩셋과 캐릭터로 그린 예시입니다.' }), body, feedback,
      el('footer', { children: [button('요청 수정', () => finish(null), '', 'ai-creation-cancel'), ...(selected === null ? [button('추천 조합 선택', () => { selected = 0; people = 0; void render(); }, '', 'ai-creation-recommend')] : []), start] }));
    reference.replaceChildren(el('span', { class: 'ai-creation-eyebrow', text: '제작 기준' }), el('h3', { text: '그래픽 선택을 기다리고 있어요' }), el('p', { text: '조합을 확정하면 이 기준으로 조수가 제작을 시작합니다.' }));
    try {
      if (selected === null) {
        body.classList.add('is-grid');
        const canvases = await Promise.all(styles.map((_, i) => preview(i, i)));
        if (settled || token !== revision) return;
        styles.forEach((style, i) => {
          const choose = () => { selected = i; people = i; void render(); };
          const enlarge = button('', choose, 'ai-creation-picture', `ai-creation-preview-${i}`);
          enlarge.setAttribute('aria-label', `${style.name} 크게 보고 조합하기`); enlarge.append(imageNode(canvases[i]!), el('span', { text: '크게 보고 조합하기 ↗' }));
          body.append(el('article', { class: 'ai-creation-option', children: [enlarge, el('div', { class: 'ai-creation-caption', children: [el('small', { text: i === 0 ? '01  추천' : `0${i + 1}` }), el('h3', { text: style.name }), el('p', { text: `${style.detail} · ${characters[i]!.name}` }), button('이 조합 선택', choose, '', `ai-creation-select-${i}`)] })] }));
        });
      } else {
        const styleIndex = selected, charsIndex = people;
        const controls = el('div', { class: 'ai-creation-controls' });
        const large = el('div', { class: 'ai-creation-large' });
        body.classList.add('is-customize');
        body.append(large, controls);
        controls.append(button('← 세 가지 다시 비교', () => { selected = null; void render(); }, '', 'ai-creation-back'));
        const chips = el('select', { attrs: { 'aria-label': '칩셋' }, dataset: { testid: 'ai-creation-tileset' }, children: tilesets.map(t => el('option', { text: t.name, attrs: { value: t.id } })) });
        chips.value = tileset.id; chips.addEventListener('change', () => { tileset = tilesets.find(t => t.id === chips.value)!; void render(); });
        controls.append(el('label', { text: '칩셋', children: [chips] }));
        const kits = el('select', { attrs: { 'aria-label': '집 외관' }, children: styles.map((s, i) => el('option', { text: s.detail, attrs: { value: String(i) } })) });
        kits.value = String(selected); kits.addEventListener('change', () => { selected = Number(kits.value); void render(); });
        controls.append(el('label', { text: '집 외관', children: [kits] }), el('strong', { text: '함께 살아갈 캐릭터' }));
        const charButtons = characters.map((set, i) => {
          const b = button(set.name, () => { people = i; void render(); }, 'ai-creation-character', `ai-creation-character-${i}`);
          b.setAttribute('aria-pressed', String(people === i)); controls.append(b); return b;
        });
        const [canvas, ...sprites] = await Promise.all([preview(styleIndex, charsIndex), ...characters.map((_, i) => characterCanvas(i))]);
        if (settled || token !== revision) return;
        large.append(imageNode(canvas!), el('p', { text: '집 한 채를 이용한 그래픽 예시 · 실제 배치는 요청에 맞춰 제작' }));
        sprites.forEach((c, i) => charButtons[i]!.prepend(c));
        reference.replaceChildren(el('span', { class: 'ai-creation-eyebrow', text: '선택한 그래픽' }), imageNode(canvas!), el('h3', { text: styles[styleIndex]!.name }), el('p', { text: `${tileset.name}\n${characters[charsIndex]!.name}` }), el('p', { text: '선택 대기 · 아직 제작하지 않았어요' }));
        start.disabled = false;
      }
      feedback.textContent = selected === null ? `${tileset.name} · 집 외관과 캐릭터는 따로 바꿀 수 있어요.` : '마음에 들면 제작을 시작하세요. 선택만으로 프로젝트가 바뀌지는 않아요.';
    } catch {
      if (settled || token !== revision) return;
      feedback.replaceChildren('이미지를 불러오지 못했어요. ', button('다시 불러오기', () => { cache.clear(); void render(); }));
    }
  };
  void render();
  return { root, reference, result, cancel: () => finish(null) };
}
