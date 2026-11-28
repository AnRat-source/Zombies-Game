import { readFile, writeFile } from 'node:fs/promises';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/build-nyc-shore-data.mjs input.geojson output.js');

const source = JSON.parse(await readFile(input, 'utf8'));
const SCALE = 1_000_000;
const TOLERANCE = 0.00009; // about ten metres: accurate 2D coastline and land checks.
const RENDER_TOLERANCE = 0.00085; // about ninety metres: cheap, smooth 3D land mesh.
const ORDER = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

const squaredDistance = (a, b) => {
  const dx = a[0] - b[0], dy = a[1] - b[1];
  return dx * dx + dy * dy;
};
const squaredSegmentDistance = (p, a, b) => {
  let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
  if (dx || dy) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x; dy = p[1] - y;
  return dx * dx + dy * dy;
};
function simplify(points, tolerance) {
  const open = points.slice(0, -1);
  if (open.length < 4) return open;
  const keep = new Uint8Array(open.length); keep[0] = keep[open.length - 1] = 1;
  const stack = [[0, open.length - 1]], limit = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop(); let best = limit, pick = -1;
    for (let i = first + 1; i < last; i++) {
      const distance = squaredSegmentDistance(open[i], open[first], open[last]);
      if (distance > best) { best = distance; pick = i; }
    }
    if (pick >= 0) { keep[pick] = 1; stack.push([first, pick], [pick, last]); }
  }
  return open.filter((_, i) => keep[i]);
}
function polygonArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return Math.abs(area);
}

const boroughs = [];
for (const feature of source.features ?? []) {
  const name = feature.properties?.boroname;
  const polygons = feature.geometry?.type === 'MultiPolygon' ? feature.geometry.coordinates : [feature.geometry?.coordinates];
  const outer = polygons.filter(Boolean).map(polygon => polygon[0]).filter(Boolean).sort((a, b) => polygonArea(b) - polygonArea(a))[0];
  if (!name || !outer?.length) continue;
  const packed = [], renderPacked = [];
  for (const point of simplify(outer, TOLERANCE)) packed.push(Math.round(point[0] * SCALE), Math.round(point[1] * SCALE));
  for (const point of simplify(outer, RENDER_TOLERANCE)) renderPacked.push(Math.round(point[0] * SCALE), Math.round(point[1] * SCALE));
  if (packed.length >= 6 && renderPacked.length >= 6) boroughs.push([name, packed, renderPacked]);
}
boroughs.sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
const sourceLabel = 'NYC Borough Boundaries (water areas excluded) © City of New York / DCP';
const payload = { source: sourceLabel, scale: SCALE, boroughs };
await writeFile(output, `/* Generated from ${sourceLabel}. Do not hand-edit. */\nwindow.CityfallNYCShoreData=${JSON.stringify(payload)};\n`);
