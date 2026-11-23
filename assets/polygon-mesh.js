/* Standalone polygon triangulation and low-poly mesh generation; no dependencies. */
window.CityfallPolygonMesh = (() => {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  function area(vertices) {
    let sum = 0;
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i], b = vertices[(i + 1) % vertices.length];
      sum += a.x * b.y - a.y * b.x;
    }
    return sum * .5;
  }
  function containsTriangle(p, a, b, c) {
    const x = cross(a, b, p), y = cross(b, c, p), z = cross(c, a, p);
    return x >= -1e-7 && y >= -1e-7 && z >= -1e-7;
  }
  function triangulate(vertices) {
    if (!vertices || vertices.length < 3) return [];
    const v = vertices.map((_, i) => i);
    if (area(vertices) < 0) v.reverse();
    const out = [];
    let attempts = 0;
    while (v.length > 3 && attempts++ < vertices.length ** 2) {
      let clipped = false;
      for (let j = 0; j < v.length; j++) {
        const a = v[(j + v.length - 1) % v.length], b = v[j], c = v[(j + 1) % v.length];
        if (cross(vertices[a], vertices[b], vertices[c]) <= 1e-5) continue;
        let blocked = false;
        for (const k of v) {
          if (k !== a && k !== b && k !== c && containsTriangle(vertices[k], vertices[a], vertices[b], vertices[c])) { blocked = true; break; }
        }
        if (blocked) continue;
        out.push(a, b, c); v.splice(j, 1); clipped = true; break;
      }
      if (!clipped) break;
    }
    if (v.length === 3) out.push(v[0], v[1], v[2]);
    if (!out.length && vertices.length >= 3) for (let j = 1; j < vertices.length - 1; j++) out.push(0, j, j + 1);
    return out;
  }
  function* buildSteps(buildings) {
    const output = [];
    const emit = (p, z, col) => output.push(p.x, p.y, z, ...col);
    const pale = [0.79, 0.84, 0.83], gray = [0.62, 0.65, 0.66];
    let visits = 0;
    for (const b of buildings) {
      if (++visits % 90 === 0) yield visits;
      if (!b.verts || b.verts.length < 3 || b.collapsing) continue;
      const polygon = b.verts, h = b.collapsed ? 4 : 14 + b.height * 13;
      const roof = b.locked ? gray : pale;
      const indices = triangulate(polygon);
      for (let i = 0; i < indices.length; i += 3) {
        emit(polygon[indices[i]], h, roof); emit(polygon[indices[i + 1]], h, roof); emit(polygon[indices[i + 2]], h, roof);
      }
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], c = polygon[(i + 1) % polygon.length];
        const shade = b.locked ? [.40, .43, .44] : [.48, .57, .61];
        emit(a, -1, shade); emit(c, -1, shade); emit(c, h, shade);
        emit(a, -1, shade); emit(c, h, shade); emit(a, h, shade);
      }
    }
    return new Float32Array(output);
  }
  function build(buildings) { const iterator = buildSteps(buildings); let step; do { step = iterator.next(); } while (!step.done); return step.value; }
  return { triangulate, build, buildSteps, area };
})();
