import { renderGeographyRaster } from "@/editor/panels/spatialGeographyRaster";
import type { GeographyDesign } from "@/editor/panels/spatialGeographyDraft";
import { geographyControllerFault, type GeographyControllerFault } from "./spatialGeographyControllerFixture";
import { geographyRecipeFixture } from "./spatialGeographyRecipes";

function regionOf(project: { spatialAuthoring?: { library: { regions: Record<string, GeographyDesign> } } }): GeographyDesign {
  const region = Object.values(project.spatialAuthoring?.library.regions ?? {})[0];
  if (!region) throw new TypeError("Missing region design");
  return region;
}

function paintSettled(painted: string | undefined): painted is "atlas" | "error" {
  return painted === "atlas" || painted === "error";
}

function waitPainted(host: HTMLElement): Promise<HTMLCanvasElement> {
  const canvas = host.querySelector("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError("Missing geography raster");
  if (paintSettled(canvas.dataset.painted)) return Promise.resolve(canvas);
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (!paintSettled(canvas.dataset.painted)) return;
      cleanup();
      resolve(canvas);
    });
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`raster paint did not settle: ${canvas.dataset.painted ?? "none"}`));
    }, 15_000);
    const cleanup = (): void => {
      clearTimeout(timeout);
      observer.disconnect();
    };
    observer.observe(canvas, { attributes: true, attributeFilter: ["data-painted"] });
    if (paintSettled(canvas.dataset.painted)) {
      cleanup();
      resolve(canvas);
    }
  });
}

export async function mountLakeCountry(host: HTMLElement): Promise<HTMLCanvasElement> {
  const project = geographyRecipeFixture("lake-country");
  const region = project.spatialAuthoring?.library.regions["lake-country"];
  if (!region) throw new TypeError("Missing lake-country");
  host.append(renderGeographyRaster(project, region).node);
  return waitPainted(host);
}

export async function mountPreviewFault(host: HTMLElement, fault: GeographyControllerFault): Promise<HTMLCanvasElement> {
  const project = geographyControllerFault(fault);
  host.append(renderGeographyRaster(project, regionOf(project)).node);
  return waitPainted(host);
}
