// Dumps the built Astra Horizon project to tmp/astra-pres/astra.project.json (input of lineup_fixture.py and the astra-resolution scenario).
import { mkdirSync, writeFileSync } from "node:fs";
import { createFlagshipDemoProject } from "@/project/flagship";
const { project } = createFlagshipDemoProject("emerald-crown" as never);
mkdirSync("tmp/astra-pres", { recursive: true });
writeFileSync("tmp/astra-pres/astra.project.json", JSON.stringify(project));
const s = project.system as Record<string, unknown>;
console.log(JSON.stringify({ playResolution: s.playResolution, cameraZoom: s.cameraZoom, playSurfaceScale: s.playSurfaceScale, maps: Object.values(project.maps).map((m) => `${m.id}:${m.width}x${m.height}`) }));
