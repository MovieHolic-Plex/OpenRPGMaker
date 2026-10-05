import themeCatalog from '@/assets/worldmapThemeCatalog.json';
import { WORLD_MAP_MODES, preferredWorldmapMode, worldmapAuthoringRequest, type WorldmapMode } from '@/project/worldmapModes';
import { store } from '@/project/store';
import { getTool } from '@/editor/tools';
import { applyToolToStore } from '@/editor/tools/applyChangesetToStore';
import { selectEditorMap } from '@/editor/mapSelection';
import { openEventSubdialog } from './eventEditor/subdialog';
import { el } from '@/util/dom';
import { genId } from '@/util/id';
import { toast } from '@/util/toast';

export function openWorldAtlasCreateDialog(): void {
  openEventSubdialog({
    title: '세계 지도 만들기', subtitle: '기본 월드맵 또는 게임에 맞는 이동 방식을 고릅니다.',
    testId: 'world-atlas-create-dialog', width: 'narrow',
    render(body, close) {
      const initialMode = preferredWorldmapMode(store.getCurrent());
      const initial = WORLD_MAP_MODES.find(mode => mode.id === initialMode)!;
      const select = el('select', {
        attrs: { 'aria-label': '세계 지도 이동 방식' }, dataset: { testid: 'world-atlas-structure' },
      }) as HTMLSelectElement;
      WORLD_MAP_MODES.forEach(mode => select.append(el('option', { text: mode.name, attrs: { value: mode.id } })));
      select.value = initialMode;
      const name = el('input', {
        value: initial.name, attrs: { type: 'text', 'aria-label': '세계 지도 이름' },
      }) as HTMLInputElement;
      const seed = el('input', {
        value: '7', attrs: { type: 'number', 'aria-label': '배치 번호', min: '0', max: '2147483647' },
      }) as HTMLInputElement;
      const seedField = el('label', { text: '배치 번호', children: [seed] });
      const theme = el('select', {
        attrs: { 'aria-label': '세계관' }, dataset: { testid: 'world-atlas-theme' },
      }) as HTMLSelectElement;
      themeCatalog.forEach(entry => theme.append(el('option', { text: entry.name, attrs: { value: entry.id } })));
      theme.value = 'fantasy';
      const themeField = el('label', { text: '세계관', children: [theme] });
      const help = el('p', { text: initial.description });
      const status = el('p', { attrs: { 'aria-live': 'polite' }, dataset: { testid: 'world-atlas-create-status' } });
      const create = el('button', {
        class: 'btn', attrs: { type: 'button' }, dataset: { testid: 'world-atlas-create-confirm' },
      }) as HTMLButtonElement;
      const updateMode = () => {
        const mode = WORLD_MAP_MODES.find(candidate => candidate.id === select.value)!;
        help.textContent = mode.description;
        themeField.hidden = mode.id !== 'default';
        seedField.hidden = mode.id === 'default';
        create.textContent = mode.id === 'default' ? '세계 지도 만들기' : '지도와 장소 만들기';
      };
      select.onchange = () => {
        name.value = WORLD_MAP_MODES.find(mode => mode.id === select.value)!.name;
        updateMode();
      };
      updateMode();
      create.onclick = async () => {
        const mode = select.value as WorldmapMode;
        const value = Number(seed.value);
        if (mode !== 'default' && (!Number.isSafeInteger(value) || value < 0 || value > 2147483647)) {
          status.textContent = '배치 번호를 0~2147483647 정수로 입력하세요.';
          return;
        }
        const id = genId(mode === 'default' ? 'world_map' : 'atlas');
        const { toolName, args } = worldmapAuthoringRequest(mode, id, name.value.trim() || '세계 지도', value, theme.value);
        create.disabled = select.disabled = name.disabled = seed.disabled = theme.disabled = true;
        status.textContent = mode === 'default' ? '세계 지도를 만들고 있습니다…' : '지도와 장소를 만들고 있습니다…';
        try {
          await getTool(toolName)!.prepare?.(args, store.getCurrent());
          if (!body.isConnected) return;
          const result = applyToolToStore(toolName, args);
          if (!result.ok) throw new Error(result.summary);
          const project = store.getCurrent();
          const atlas = mode === 'default' ? undefined : project.worldAtlases!.find(candidate => candidate.id === id)!;
          const mapId = atlas ? atlas.overviewMapId ?? atlas.nodes.find(node => node.id === atlas.startNodeId)!.mapId : id;
          selectEditorMap(mapId);
          toast(result.summary, 'ok');
          close();
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : String(error);
          create.disabled = select.disabled = name.disabled = seed.disabled = theme.disabled = false;
        }
      };
      body.append(el('label', { text: '이동 방식', children: [select] }), help,
        el('label', { text: '지도 이름', children: [name] }), themeField, seedField, create, status);
    },
  });
}
