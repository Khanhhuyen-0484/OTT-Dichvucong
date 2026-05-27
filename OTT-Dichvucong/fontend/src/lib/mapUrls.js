export function getGoogleMapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/** OSM embed (openstreetmap.org) — thay staticmap.openstreetmap.de đã ngừng resolve DNS. */
export function getOsmEmbedUrl(lat, lng, padding = 0.01) {
  const bbox = `${lng - padding},${lat - padding},${lng + padding},${lat + padding}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`;
}
