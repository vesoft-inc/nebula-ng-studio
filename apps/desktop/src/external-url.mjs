/**
 * Validate STUDIO_DESKTOP_URL. The desktop shell can load a development Vite
 * server (or an existing Studio deployment) instead of spawning the sidecar.
 */
export function parseExternalStudioUrl(value) {
  const candidate = String(value ?? '').trim();
  if (!candidate) return null;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`STUDIO_DESKTOP_URL is not a valid URL: ${candidate}`);
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(`STUDIO_DESKTOP_URL must use http or https: ${candidate}`);
  }

  return { url: parsed.toString(), origin: parsed.origin };
}
