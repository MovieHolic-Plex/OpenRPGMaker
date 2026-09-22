import {afterEach,describe,expect,it,vi} from 'vitest';
import {createBlankProject} from '@/project/defaults/blankProject';
import {createNewProjectSeed} from '@/editor/genrePacks';
import {deserialize,serialize} from '@/project/io';
import {listOpeningStillPackIds,findOpeningStillPackEntry} from '@/assets/openingStillPackRuntime';
import {listOpeningStillMoods} from '@/assets/openingStillMoods';
import {listDatabaseResourceOptions} from '@/editor/resourceOptions';
import {collectResourceIds} from '@/project/io/resourceReferenceValidation';
import {collectWebExportAssets} from '@/project/webExportAssets';
import {fetchLicenseNotices} from '@/player/titleLicenseNotice';
import {registerExportAssetBase,registerInlineAssets} from '@/assets/inlineAssetStore';

afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();registerExportAssetBase(null);registerInlineAssets(null);});
describe('opening delivery across authoring, persistence and export',()=>{
  it('uses the interview title for the first opening card',()=>{
    for(const pack of [null,'farm-life'] as const){
      const p=createNewProjectSeed(pack,'달빛 모험');
      expect(p.meta.title).toBe('달빛 모험');
      expect(p.system.opening?.scenes.at(-1)?.narration).toBe('— 달빛 모험 —');
    }
  });
  it('keeps deleted and disabled openings through real store normalization',async()=>{
    const {store}=await import('@/project/store');
    const p=createBlankProject();delete p.system.opening;
    await store.loadFallbackProject(deserialize(serialize(p)));
    expect(store.getCurrent().system.opening).toBeUndefined();
    const disabled=createBlankProject();disabled.system.opening!.enabled=false;
    await store.loadFallbackProject(deserialize(serialize(disabled)));
    expect(store.getCurrent().system.opening?.enabled).toBe(false);
  });
  it('every delivered pack still is searchable and survives save/load',()=>{
    const p=createBlankProject(), ids=listOpeningStillPackIds();
    expect(ids.length).toBeGreaterThan(0);
    const options=listDatabaseResourceOptions('still',p);
    const known=collectResourceIds(p);
    for(const id of ids){expect(known.has(id)).toBe(true);expect(listOpeningStillMoods().some(m=>m.id===id)).toBe(true);expect(options.some(o=>o.id===id)).toBe(true);}
    p.system.opening!.scenes=ids.map((id,i)=>({id:'pack-'+i,kind:'image',resourceId:id,narration:'검증',durationMs:1000,motion:'pan'}));
    expect(deserialize(serialize(p)).system.opening).toEqual(p.system.opening);
  });
  it('downloads CDN stills into local export paths, including disabled sequences',()=>{
    vi.stubEnv('VITE_STILL_CDN_BASE','https://cdn.example.test');
    const p=createBlankProject(), id=listOpeningStillPackIds()[0]!;
    const name=findOpeningStillPackEntry(id)!.fileName;
    p.system.opening={enabled:false,skippable:true,scenes:[{id:'one',kind:'image',resourceId:id,narration:'',durationMs:1000,motion:'none'}]};
    expect(collectWebExportAssets(p)).toContainEqual({kind:'public',resourceId:id,sourcePath:'https://cdn.example.test/stills/v1/'+name,zipPath:'assets/stills/pack/'+name});
  });
  it('resolves attribution in subdirectory and standalone exports',async()=>{
    const fetchMock=vi.fn().mockResolvedValue(new Response('Credits'));
    vi.stubGlobal('fetch',fetchMock);
    registerExportAssetBase(new URL('https://games.example.test/moon/'));
    expect(await fetchLicenseNotices()).toBe('Credits');
    expect(fetchMock).toHaveBeenCalledWith('https://games.example.test/moon/assets/ATTRIBUTION.md');
    fetchMock.mockResolvedValue(new Response('Embedded credits'));
    registerInlineAssets({'assets/ATTRIBUTION.md':'data:text/plain,Embedded%20credits'});
    expect(await fetchLicenseNotices()).toBe('Embedded credits');
    expect(fetchMock).toHaveBeenLastCalledWith('data:text/plain,Embedded%20credits');
  });
});
