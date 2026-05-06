export function getBaseAddonUrl(api) {
  return api.replace(/\/manifest\.json$/i, "").replace(/\/$/, "");
}
