import path from "node:path";
import { getGame } from "~/lib/db";
import { createCommunityPlayRouteHandler } from "~/lib/playRoute";
import { EDITOR_PUBLIC, serveStaticFile } from "~/lib/staticFile";
import { readGamePackageProjectJson } from "~/lib/validate";

export const dynamic = "force-dynamic";

const SITE_PUBLIC = path.join(process.cwd(), "public", "player-static");

async function serveFile(root: string, rel: string): Promise<Response | null> {
  return serveStaticFile(root, rel);
}

const handlePlayRoute = createCommunityPlayRouteHandler({
  loadGame: async (slug) => {
    const game = await getGame(slug);
    return game ? { packageBase64: game.package_base64 } : null;
  },
  loadPlayerFile: (relativePath) => serveFile(SITE_PUBLIC, relativePath),
  loadRuntimeFile: (relativePath) => serveFile(EDITOR_PUBLIC, relativePath),
  readProjectJson: readGamePackageProjectJson,
  validateProjectJson: validateWithEditorSchema,
});

function validateWithEditorSchema(json: string): void {
  const editorProjectIo: unknown = require("@/project/io/serialize");
  if (typeof editorProjectIo !== "object" || editorProjectIo === null) {
    throw new Error("editor project validator unavailable");
  }
  const deserializeProject: unknown = Reflect.get(editorProjectIo, "deserialize");
  if (typeof deserializeProject !== "function") throw new Error("editor project validator unavailable");
  Reflect.apply(deserializeProject, undefined, [json]);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; path?: string[] }> },
) {
  return handlePlayRoute(request, await params);
}
