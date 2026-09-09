
import { buildSpatialCatalogLibrary, buildOutdoorObjectKits } from "@/editor/content/spatial/catalogSeed";
import { validateSpatialAuthoring } from "@/project/spatial/guards";
import { emptySpatialDocument } from "../../../../test/support/spatialSchemaFixture";
const library=buildSpatialCatalogLibrary();
console.log("objects="+Object.keys(library.objects).length+" spaces="+Object.keys(library.spaces).length+" places="+Object.keys(library.places).length+" regions="+Object.keys(library.regions).length+" worlds="+Object.keys(library.worlds).length);
const kits=buildOutdoorObjectKits();
console.log("kits="+kits.length);
// 실제 검증기를 통과해야 한다. 통과 못 하면 카탈로그가 스키마와 어긋난 것이다.
const document=validateSpatialAuthoring({ ...emptySpatialDocument(), library });
console.log("validated: objects="+Object.keys(document.library.objects).length+" worlds="+Object.keys(document.library.worlds).length);
console.log("VALIDATOR OK");
