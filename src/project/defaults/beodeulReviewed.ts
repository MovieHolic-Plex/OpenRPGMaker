import catalog from '../../assets/beodeulReviewedCatalog.json';
import references from '../../assets/beodeulReviewedReferences.json';
import {defineBuildingBundle,type BuildingCatalog} from './buildingBundle';

/**
 * 버들항 · 사람이 허용한 건물(beodeul-building-review → install.py). 허용한 그림만 이 시트에 들어온다.
 * 설정은 src/harnesses/beodeul-building-review/profiles.json 과 같아야 한다(prepare-building-references 가 대조한다).
 */
const bundle=defineBuildingBundle({
 tilesetId:'beodeul_reviewed',texture:'tex_beodeul_reviewed',name:'버들항 · 사람이 허용한 건물',label:'버들항',
 catalog:catalog as unknown as BuildingCatalog,references,hostTilesetId:'beodeul_city',hostTexture:'tex_beodeul_city',
 ids:{house:'bd-house-rv-',shadow:'bd-rv-shadow-',foundation:'bd-rv-foundation-',docs:'bd-rv-'},tags:['버들항','3/4 탑뷰'],
});
export const BEODEUL_REVIEWED_TEXTURE=bundle.TEXTURE;
export const createBeodeulReviewedTileset=bundle.createTileset;
export const createBeodeulReviewedStandalone=bundle.createStandalone;
export const ensureBeodeulReviewedTileset=bundle.ensureTileset;
export const ensureBeodeulReviewed=bundle.ensureHost;
