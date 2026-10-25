import catalog from '../../assets/beodeulMassingCatalog.json';
import references from '../../assets/beodeulMassingReferences.json';
import {defineBuildingBundle,type BuildingCatalog} from './buildingBundle';

/**
 * 버들항 · 중세 건물(building-kit massing — bk-massing-100 덩어리 모형을 손 도트로). 위임 허용(object-gate + 독립 검수 둘)한 그림만
 * 이 시트에 들어온다(beodeul-building-review install.py --profile building-kit-massing). 설정은 profiles.json 의 같은 프로필.
 */
const bundle=defineBuildingBundle({
 tilesetId:'beodeul_massing',texture:'tex_beodeul_massing',name:'버들항 · 중세 건물(덩어리 모형)',label:'버들항 중세 건물',
 catalog:catalog as unknown as BuildingCatalog,references,hostTilesetId:'beodeul_city',hostTexture:'tex_beodeul_city',
 ids:{house:'bd-house-mk-',shadow:'bd-mk-shadow-',foundation:'bd-mk-foundation-',docs:'bd-mk-'},tags:['버들항','3/4 탑뷰','중세'],
 approval:{tag:'검수 통과',text:'3/4 관문 영수증과 독립 검수 둘을 통과하고 사용자 위임으로 허용한 그림'},
});
export const BEODEUL_MASSING_TEXTURE=bundle.TEXTURE;
export const createBeodeulMassingTileset=bundle.createTileset;
export const createBeodeulMassingStandalone=bundle.createStandalone;
export const ensureBeodeulMassingTileset=bundle.ensureTileset;
export const ensureBeodeulMassing=bundle.ensureHost;
/** 호스트(beodeul_city)에 심는 참고문서 원본 — 읽기 전용. */
export const beodeulMassingHostReferences=bundle.hostReferences;
