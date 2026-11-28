import { readFile, writeFile } from 'node:fs/promises';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('Usage: node scripts/build-nyc-road-data.mjs input.geojson output.js');
}

const source = JSON.parse(await readFile(input, 'utf8'));
const scale = 1_000_000;
const roads = [];

function appendRoad(coords, widthFeet) {
  const packed = [];
  for (const coordinate of coords ?? []) {
    const lon = Math.round(Number(coordinate[0]) * scale);
    const lat = Math.round(Number(coordinate[1]) * scale);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const previous = packed.length - 2;
    if (previous >= 0 && packed[previous] === lon && packed[previous + 1] === lat) continue;
    packed.push(lon, lat);
  }
  if (packed.length >= 4) roads.push([Math.max(12, Math.min(180, Math.round(Number(widthFeet) || 36))), packed]);
}

for (const feature of source.features ?? []) {
  const geometry = feature.geometry;
  if (geometry?.type === 'LineString') appendRoad(geometry.coordinates, feature.properties?.streetwidth);
  if (geometry?.type === 'MultiLineString') {
    for (const line of geometry.coordinates) appendRoad(line, feature.properties?.streetwidth);
  }
}

const banner = '/* Generated from NYC Street Centerline (CSCL), NYC Open Data. Do not hand-edit. */' + String.fromCharCode(10);
const payload = { source: 'NYC Street Centerline (CSCL) © City of New York', scale, roads };
await writeFile(output, `${banner}window.CityfallNYCRoadData=${JSON.stringify(payload)};${String.fromCharCode(10)}`);
