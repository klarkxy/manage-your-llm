// Shared URL for the per-provider setup guides served from the web app's
// public folder. Centralising the path keeps preset files and the docs
// directory in sync without scattering string literals.
export function providerGuideUrl(presetId: string): string {
  return `/docs/provider-guides/${presetId}.md`;
}
