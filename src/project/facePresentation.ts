/** Resource naming contract shared by dialogue, editor preview, and AI discovery. */
export function facePresentationForResource(resourceId: string): "face" | "bust" | "full" {
  const id = resourceId.trim().toLowerCase();
  if (id.includes("-full") || id.includes("fullbody") || id.includes("-body") || id.endsWith("/full")) return "full";
  if (id.includes("-bust") || id.includes("-portrait") || id.startsWith("generated-face-") || id.endsWith("/bust")) return "bust";
  return "face";
}
