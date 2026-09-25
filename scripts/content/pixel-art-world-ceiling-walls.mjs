// Authored PAW interiors: every exposed south edge has a complete wall face.
// Consecutive ceiling cells form one solid mass; only its bottom edge projects.
export function ceilingWallFaces(scene, ceilingIds, wallTiles) {
  const ids = new Set(ceilingIds), faces = new Map();
  for (let y = 0; y < scene.height; y++) for (let x = 0; x < scene.width; x++) {
    if (!ids.has(scene.lowerTiles[y * scene.width + x])) continue;
    if (y + 1 < scene.height && ids.has(scene.lowerTiles[(y + 1) * scene.width + x])) continue;
    for (let row = 0; row < wallTiles.length; row++) {
      const yy = y + row + 1;
      if (yy >= scene.height) throw Error(`CEILING_WALL_OUT_OF_BOUNDS at ${x},${y}`);
      const i = yy * scene.width + x;
      if (ids.has(scene.lowerTiles[i])) throw Error(`CEILING_WALL_COLLISION at ${x},${yy}`);
      const face = {x, y: yy, tile: wallTiles[row], ceilingX: x, ceilingY: y};
      if (faces.has(i) && faces.get(i).tile !== face.tile) throw Error(`CEILING_WALL_CONFLICT at ${x},${yy}`);
      faces.set(i, face);
    }
  }
  return [...faces.values()];
}

export function applyCeilingWallFaces(scene, ceilingIds, wallTiles) {
  const faces = ceilingWallFaces(scene, ceilingIds, wallTiles);
  for (const face of faces) scene.lowerTiles[face.y * scene.width + face.x] = face.tile;
  scene.wallFaceCells = faces;
  return faces;
}

export function inspectCeilingWallFaces(scene, ceilingIds, wallTiles) {
  return ceilingWallFaces(scene, ceilingIds, wallTiles)
    .filter(face => scene.lowerTiles[face.y * scene.width + face.x] !== face.tile)
    .map(face => ({code: 'CEILING_WALL_MISSING', ...face}));
}
