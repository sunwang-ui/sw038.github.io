const EPSILON = 1e-10;

const edgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;

function triangleArea2(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1])
      - (b[1] - a[1]) * (c[0] - a[0]);
}

function barycentric2(point, a, b, c) {
  const denominator = triangleArea2(a, b, c);

  if (Math.abs(denominator) < EPSILON) {
    return null;
  }

  const w0 = triangleArea2(point, b, c) / denominator;
  const w1 = triangleArea2(point, c, a) / denominator;
  return [w0, w1, 1 - w0 - w1];
}

function barycentricPoint(weights, a, b, c) {
  return [
    weights[0] * a[0] + weights[1] * b[0] + weights[2] * c[0],
    weights[0] * a[1] + weights[1] * b[1] + weights[2] * c[1],
    weights[0] * a[2] + weights[1] * b[2] + weights[2] * c[2]
  ];
}

function barycentric3(point, a, b, c) {
  const v0 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const v2 = [point[0] - a[0], point[1] - a[1], point[2] - a[2]];
  const d00 = v0[0] * v0[0] + v0[1] * v0[1] + v0[2] * v0[2];
  const d01 = v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2];
  const d11 = v1[0] * v1[0] + v1[1] * v1[1] + v1[2] * v1[2];
  const d20 = v2[0] * v0[0] + v2[1] * v0[1] + v2[2] * v0[2];
  const d21 = v2[0] * v1[0] + v2[1] * v1[1] + v2[2] * v1[2];
  const denominator = d00 * d11 - d01 * d01;

  if (Math.abs(denominator) < EPSILON) {
    return null;
  }

  const w1 = (d11 * d20 - d01 * d21) / denominator;
  const w2 = (d00 * d21 - d01 * d20) / denominator;
  return [1 - w1 - w2, w1, w2];
}

function segmentIntersectionParameter(a, b, c, d) {
  const rx = b[0] - a[0];
  const ry = b[1] - a[1];
  const sx = d[0] - c[0];
  const sy = d[1] - c[1];
  const denominator = rx * sy - ry * sx;

  if (Math.abs(denominator) < EPSILON) {
    return null;
  }

  const qx = c[0] - a[0];
  const qy = c[1] - a[1];
  const t = (qx * sy - qy * sx) / denominator;
  const u = (qx * ry - qy * rx) / denominator;

  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) {
    return null;
  }

  return Math.max(0, Math.min(1, t));
}

function uniqueSorted(values, tolerance = 1e-8) {
  const sorted = [...values].sort((a, b) => a - b);
  const result = [];

  for (const value of sorted) {
    if (result.length === 0 || Math.abs(value - result[result.length - 1]) > tolerance) {
      result.push(value);
    }
  }

  return result;
}

function solvePCG(rows, rhs, {
  tolerance = 1e-10,
  maxIterations = Math.max(64, rows.length * 8)
} = {}) {
  const n = rows.length;
  const x = new Float64Array(n);

  if (n === 0) {
    return { solution: x, iterations: 0, relativeResidual: 0 };
  }

  const r = Float64Array.from(rhs);
  const z = new Float64Array(n);
  const p = new Float64Array(n);
  const ap = new Float64Array(n);
  let rhsNormSquared = 0;
  let rz = 0;

  for (let i = 0; i < n; ++i) {
    const diagonal = rows[i].get(i) ?? 0;

    if (!(diagonal > EPSILON)) {
      throw new Error(`Harmonic matrix has a non-positive diagonal at row ${i}.`);
    }

    z[i] = r[i] / diagonal;
    p[i] = z[i];
    rz += r[i] * z[i];
    rhsNormSquared += rhs[i] * rhs[i];
  }

  const rhsNorm = Math.sqrt(rhsNormSquared);

  if (rhsNorm < EPSILON) {
    return { solution: x, iterations: 0, relativeResidual: 0 };
  }

  let relativeResidual = 1;

  for (let iteration = 0; iteration < maxIterations; ++iteration) {
    ap.fill(0);

    for (let row = 0; row < n; ++row) {
      for (const [column, value] of rows[row]) {
        ap[row] += value * p[column];
      }
    }

    let denominator = 0;

    for (let i = 0; i < n; ++i) {
      denominator += p[i] * ap[i];
    }

    if (!(denominator > 1e-24)) {
      throw new Error("Harmonic PCG lost positive definiteness.");
    }

    const alpha = rz / denominator;
    let residualSquared = 0;

    for (let i = 0; i < n; ++i) {
      x[i] += alpha * p[i];
      r[i] -= alpha * ap[i];
      residualSquared += r[i] * r[i];
    }

    relativeResidual = Math.sqrt(residualSquared) / rhsNorm;

    if (relativeResidual <= tolerance) {
      return {
        solution: x,
        iterations: iteration + 1,
        relativeResidual
      };
    }

    let nextRz = 0;

    for (let i = 0; i < n; ++i) {
      z[i] = r[i] / (rows[i].get(i) ?? 1);
      nextRz += r[i] * z[i];
    }

    const beta = nextRz / rz;

    for (let i = 0; i < n; ++i) {
      p[i] = z[i] + beta * p[i];
    }

    rz = nextRz;
  }

  throw new Error(
      `Harmonic PCG did not reach ${tolerance}; residual=${relativeResidual}.`
  );
}

function orderedBoundary(mesh, faces) {
  const faceSet = new Set(faces);
  const graph = mesh._faceDualGraph ?? mesh.buildFaceDualGraph();
  const boundaryEdges = graph.primalEdges.filter(edge => {
    const inside = edge.faces.filter(face => faceSet.has(face));
    return inside.length === 1;
  });
  const neighbors = new Map();
  const edgeByKey = new Map();

  for (const edge of boundaryEdges) {
    const [a, b] = edge.vertices;

    if (!neighbors.has(a)) {
      neighbors.set(a, []);
    }

    if (!neighbors.has(b)) {
      neighbors.set(b, []);
    }

    neighbors.get(a).push(b);
    neighbors.get(b).push(a);
    edgeByKey.set(edgeKey(a, b), edge);
  }

  if (neighbors.size < 3
      || Array.from(neighbors.values()).some(items => items.length !== 2)) {
    throw new Error("Voronoi tile boundary is not one simple cycle.");
  }

  const start = Math.min(...neighbors.keys());
  const vertices = [start];
  let previous = -1;
  let current = start;

  while (true) {
    const candidates = neighbors.get(current);
    const next = candidates[0] === previous ? candidates[1] : candidates[0];

    if (next === start) {
      break;
    }

    if (vertices.includes(next)) {
      throw new Error("Voronoi tile boundary repeats a vertex.");
    }

    vertices.push(next);
    previous = current;
    current = next;
  }

  const edges = vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return edgeByKey.get(edgeKey(vertex, next));
  });

  return { vertices, edges };
}

function outsideOwnerForBoundaryEdge(voronoi, edge, owner) {
  const outside = edge.faces
      .map(face => voronoi.owners[face])
      .find(candidate => candidate >= 0 && candidate !== owner);
  return outside ?? -1;
}

function rotateArray(values, offset) {
  return values.map((_, index) => values[(index + offset) % values.length]);
}

function buildTile(mesh, voronoi, owner) {
  const faces = voronoi.tiles[owner];
  const boundary = orderedBoundary(mesh, faces);
  let neighborOwners = boundary.edges.map(
      edge => outsideOwnerForBoundaryEdge(voronoi, edge, owner)
  );
  const transition = neighborOwners.findIndex(
      (value, index) => value
          !== neighborOwners[(index - 1 + neighborOwners.length) % neighborOwners.length]
  );

  if (transition < 0) {
    throw new Error(`Voronoi tile ${owner} has no boundary cut transitions.`);
  }

  boundary.vertices = rotateArray(boundary.vertices, transition);
  boundary.edges = rotateArray(boundary.edges, transition);
  neighborOwners = rotateArray(neighborOwners, transition);
  const cuts = [];

  for (let index = 0; index < boundary.edges.length;) {
    const neighbor = neighborOwners[index];
    const start = index;
    let length = 0;

    while (index < boundary.edges.length && neighborOwners[index] === neighbor) {
      const edge = boundary.edges[index];
      length += mesh.distanceBetweenVertices(edge.vertices[0], edge.vertices[1]);
      index += 1;
    }

    cuts.push({
      neighbor,
      start,
      end: index,
      length,
      edgeIndices: Array.from({ length: index - start }, (_, offset) => start + offset)
    });
  }

  const vertexSet = new Set();

  for (const face of faces) {
    for (const vertex of mesh._triangles[face]) {
      vertexSet.add(vertex);
    }
  }

  const boundarySet = new Set(boundary.vertices);
  const cutCorners = cuts.map(cut => boundary.vertices[cut.start]);
  const tileNeighbors = new Map();
  const tileEdges = [];
  const tileEdgeKeys = new Set();

  for (const face of faces) {
    const triangle = mesh._triangles[face];

    for (let edge = 0; edge < 3; ++edge) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % 3];
      const key = edgeKey(a, b);

      if (!tileEdgeKeys.has(key)) {
        tileEdgeKeys.add(key);
        tileEdges.push([a, b]);
      }

      if (!tileNeighbors.has(a)) {
        tileNeighbors.set(a, new Set());
      }

      if (!tileNeighbors.has(b)) {
        tileNeighbors.set(b, new Set());
      }

      tileNeighbors.get(a).add(b);
      tileNeighbors.get(b).add(a);
    }
  }

  const cutCornerSet = new Set(cutCorners);
  const lowDegreeBoundaryVertices = boundary.vertices.filter(
      vertex => !cutCornerSet.has(vertex)
          && (tileNeighbors.get(vertex)?.size ?? 0) < 3
  );

  return {
    owner,
    faces,
    boundary,
    cuts,
    corners: cutCorners,
    harmonicCorners: cutCorners,
    lowDegreeBoundaryVertices,
    boundaryCornerMode: "paper-cut-corners",
    traceEdges: tileEdges,
    vertices: Array.from(vertexSet),
    interiorVertices: Array.from(vertexSet).filter(vertex => !boundarySet.has(vertex))
  };
}

function tileQuality(tile, shortCutRatio) {
  const boundaryLength = tile.cuts.reduce((sum, cut) => sum + cut.length, 0);
  const shortPairs = [];

  for (let index = 0; index < tile.cuts.length; ++index) {
    const next = (index + 1) % tile.cuts.length;

    if (tile.cuts[index].length + tile.cuts[next].length
        < shortCutRatio * boundaryLength) {
      shortPairs.push([index, next]);
    }
  }

  return {
    cornerCount: tile.corners.length,
    boundaryLength,
    shortPairs,
    isValid: tile.corners.length >= 3
        && shortPairs.length === 0
  };
}

export function selectHarmonicReadyFaceSites(mesh, {
  initialSiteCount = 1,
  firstFace = 0,
  maxSites = mesh._numT,
  minTileCorners = 3,
  rejectShortCuts = true,
  shortCutRatio = 0.10,
  batchViolationSites = false
} = {}) {
  const siteFaces = mesh.selectFarthestFaceSites(initialSiteCount, firstFace);
  const siteSet = new Set(siteFaces);
  let refinementSteps = 0;
  let voronoi;
  let validation;
  let tiles = [];
  let qualityViolations = [];

  while (siteFaces.length <= Math.min(maxSites, mesh._numT)) {
    voronoi = mesh.computeFaceVoronoi(siteFaces);
    validation = mesh.validateFaceVoronoiTopology(voronoi);
    qualityViolations = [];
    tiles = [];

    if (validation.isValid) {
      for (let owner = 0; owner < voronoi.tiles.length; ++owner) {
        const tile = buildTile(mesh, voronoi, owner);
        const quality = tileQuality(tile, shortCutRatio);
        tiles.push(tile);

        if (quality.cornerCount < minTileCorners
            || (rejectShortCuts && quality.shortPairs.length > 0)) {
          qualityViolations.push({ owner, tile, quality });
        }
      }
    }

    if (validation.isValid && qualityViolations.length === 0) {
      return {
        siteFaces,
        voronoi,
        validation: {
          ...validation,
          isHarmonicReady: true,
          qualityViolations: []
        },
        tiles,
        refinementSteps,
        reachedSiteLimit: false
      };
    }

    if (siteFaces.length >= Math.min(maxSites, mesh._numT)) {
      break;
    }

    const candidates = validation.isValid
        ? qualityViolations.flatMap(violation => violation.tile.faces)
        : validation.violatingFaces;
    if (batchViolationSites) {
      const remainingSlots = Math.min(maxSites, mesh._numT) - siteFaces.length;
      const rankedCandidates = Array.from(new Set(candidates))
          .filter(face => face >= 0 && !siteSet.has(face))
          .sort((a, b) => (voronoi.distances[b] ?? -Infinity)
              - (voronoi.distances[a] ?? -Infinity))
          .slice(0, remainingSlots);

      if (rankedCandidates.length > 0) {
        for (const site of rankedCandidates) {
          siteFaces.push(site);
          siteSet.add(site);
        }

        refinementSteps += rankedCandidates.length;
        continue;
      }
    }

    let nextSite = mesh.farthestCandidateFace(
        candidates,
        voronoi.distances,
        siteSet
    );

    if (nextSite < 0) {
      nextSite = mesh.farthestCandidateFace(
          Array.from({ length: mesh._numT }, (_, face) => face),
          voronoi.distances,
          siteSet
      );
    }

    if (nextSite < 0) {
      break;
    }

    siteFaces.push(nextSite);
    siteSet.add(nextSite);
    refinementSteps += 1;
  }

  return {
    siteFaces,
    voronoi,
    validation: {
      ...validation,
      isValid: false,
      isHarmonicReady: false,
      qualityViolations
    },
    tiles,
    refinementSteps,
    reachedSiteLimit: true
  };
}

function boundaryUV(mesh, tile) {
  const uv = new Map();
  const cornerIndices = tile.harmonicCorners.map(
      corner => tile.boundary.vertices.indexOf(corner)
  );
  const segments = cornerIndices.map((start, segmentIndex) => {
    const end = cornerIndices[(segmentIndex + 1) % cornerIndices.length];
    const edgeIndices = [];
    let index = start;
    let length = 0;

    while (index !== end) {
      edgeIndices.push(index);
      const edge = tile.boundary.edges[index];
      length += mesh.distanceBetweenVertices(
          edge.vertices[0],
          edge.vertices[1]
      );
      index = (index + 1) % tile.boundary.edges.length;
    }

    return { start, end, edgeIndices, length };
  });
  const totalLength = segments.reduce(
      (sum, segment) => sum + segment.length,
      0
  );
  const cornerUV = [];
  let angle = 0;

  for (const segment of segments) {
    cornerUV.push([Math.cos(angle), Math.sin(angle)]);
    angle += 2 * Math.PI * segment.length / totalLength;
  }

  for (let segmentIndex = 0; segmentIndex < segments.length; ++segmentIndex) {
    const segment = segments[segmentIndex];
    const startUV = cornerUV[segmentIndex];
    const endUV = cornerUV[(segmentIndex + 1) % cornerUV.length];
    let traversed = 0;

    for (const edgeIndex of segment.edgeIndices) {
      const vertex = tile.boundary.vertices[edgeIndex];
      const t = segment.length > EPSILON
          ? traversed / segment.length
          : 0;
      uv.set(vertex, [
        startUV[0] * (1 - t) + endUV[0] * t,
        startUV[1] * (1 - t) + endUV[1] * t
      ]);
      const edge = tile.boundary.edges[edgeIndex];
      traversed += mesh.distanceBetweenVertices(edge.vertices[0], edge.vertices[1]);
    }
  }

  return { uv, cornerUV };
}

function cotangentWeight(mesh, i, j, opposite) {
  const lij = mesh.distanceBetweenVertices(i, j);
  const lik = mesh.distanceBetweenVertices(i, opposite);
  const ljk = mesh.distanceBetweenVertices(j, opposite);
  const area = mesh.triangleAreaFromIndices(i, j, opposite);
  return area > EPSILON
      ? (lik * lik + ljk * ljk - lij * lij) / (4 * area)
      : 0;
}

function buildSpringWeights(mesh, tile, uniform) {
  const weights = new Map();

  for (const face of tile.faces) {
    const triangle = mesh._triangles[face];

    for (let edge = 0; edge < 3; ++edge) {
      const i = triangle[edge];
      const j = triangle[(edge + 1) % 3];
      const opposite = triangle[(edge + 2) % 3];
      const key = edgeKey(i, j);

      if (!weights.has(key)) {
        weights.set(key, { vertices: [i, j], weight: 0 });
      }

      weights.get(key).weight += uniform
          ? 1
          : cotangentWeight(mesh, i, j, opposite);
    }
  }

  return Array.from(weights.values());
}

function solveTile(mesh, tile, uniform, solverOptions) {
  const boundary = boundaryUV(mesh, tile);
  const interiorIndex = new Map(
      tile.interiorVertices.map((vertex, index) => [vertex, index])
  );
  const rows = tile.interiorVertices.map(() => new Map());
  const rhsX = new Float64Array(tile.interiorVertices.length);
  const rhsY = new Float64Array(tile.interiorVertices.length);

  for (const spring of buildSpringWeights(mesh, tile, uniform)) {
    const [a, b] = spring.vertices;
    const weight = spring.weight;

    if (!Number.isFinite(weight) || Math.abs(weight) < EPSILON) {
      continue;
    }

    for (const [vertex, neighbor] of [[a, b], [b, a]]) {
      const row = interiorIndex.get(vertex);

      if (row === undefined) {
        continue;
      }

      rows[row].set(row, (rows[row].get(row) ?? 0) + weight);
      const column = interiorIndex.get(neighbor);

      if (column !== undefined) {
        rows[row].set(column, (rows[row].get(column) ?? 0) - weight);
      }
      else {
        const fixed = boundary.uv.get(neighbor);

        if (!fixed) {
          throw new Error(`Tile ${tile.owner} has an unclassified boundary vertex.`);
        }

        rhsX[row] += weight * fixed[0];
        rhsY[row] += weight * fixed[1];
      }
    }
  }

  const resultX = solvePCG(rows, rhsX, solverOptions);
  const resultY = solvePCG(rows, rhsY, solverOptions);
  const uv = new Map(boundary.uv);

  for (let index = 0; index < tile.interiorVertices.length; ++index) {
    uv.set(tile.interiorVertices[index], [
      resultX.solution[index],
      resultY.solution[index]
    ]);
  }

  let flippedTriangles = 0;
  let degenerateTriangles = 0;
  let mappedArea = 0;

  for (const face of tile.faces) {
    const triangle = mesh._triangles[face];
    const signedArea = triangleArea2(
        uv.get(triangle[0]),
        uv.get(triangle[1]),
        uv.get(triangle[2])
    );

    if (Math.abs(signedArea) < 1e-18) {
      degenerateTriangles += 1;
    }

    mappedArea += Math.abs(signedArea) / 2;
  }

  let polygonArea = 0;

  for (let index = 0; index < boundary.cornerUV.length; ++index) {
    const a = boundary.cornerUV[index];
    const b = boundary.cornerUV[(index + 1) % boundary.cornerUV.length];
    polygonArea += a[0] * b[1] - a[1] * b[0];
  }

  polygonArea = Math.abs(polygonArea) / 2;

  if (Math.abs(mappedArea - polygonArea)
      > 1e-5 * Math.max(1, polygonArea)) {
    flippedTriangles += 1;
  }
  const embeddedTile = {
    ...tile,
    uv,
    cornerUV: boundary.cornerUV
  };

  return {
    ...embeddedTile,
    solver: uniform ? "uniform" : "paper",
    iterations: Math.max(resultX.iterations, resultY.iterations),
    relativeResidual: Math.max(
        resultX.relativeResidual,
        resultY.relativeResidual
    ),
    flippedTriangles,
    degenerateTriangles,
    mappedArea,
    polygonArea
  };
}

function makeSurface(vertices, triangles, parentFaces = null) {
  return {
    _vertices: vertices,
    _triangles: triangles,
    _numV: vertices.length,
    _numT: triangles.length,
    _parentFaces: parentFaces,

    getVertexPosition(index) {
      return this._vertices[index];
    },

    distanceBetweenVertices(a, b) {
      const pa = this._vertices[a];
      const pb = this._vertices[b];
      return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
    },

    triangleAreaFromIndices(a, b, c) {
      const pa = this._vertices[a];
      const pb = this._vertices[b];
      const pc = this._vertices[c];
      const ab = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
      const ac = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
      const cross = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0]
      ];
      return Math.hypot(cross[0], cross[1], cross[2]) / 2;
    }
  };
}

function boundaryUVFromCycle(surface, boundaryVertices, harmonicCorners) {
  const uv = new Map();
  const cornerIndices = harmonicCorners.map(corner => {
    const index = boundaryVertices.indexOf(corner);

    if (index < 0) {
      throw new Error("A harmonic corner is not on the disk boundary.");
    }

    return index;
  });
  const segments = cornerIndices.map((start, segmentIndex) => {
    const end = cornerIndices[(segmentIndex + 1) % cornerIndices.length];
    const edgeIndices = [];
    let index = start;
    let length = 0;

    while (index !== end) {
      const next = (index + 1) % boundaryVertices.length;
      edgeIndices.push(index);
      length += surface.distanceBetweenVertices(
          boundaryVertices[index],
          boundaryVertices[next]
      );
      index = next;
    }

    return { start, end, edgeIndices, length };
  });
  const totalLength = segments.reduce(
      (sum, segment) => sum + segment.length,
      0
  );
  const cornerUV = [];
  let angle = 0;

  if (!(totalLength > EPSILON)) {
    throw new Error("Harmonic disk boundary has zero length.");
  }

  for (const segment of segments) {
    cornerUV.push([Math.cos(angle), Math.sin(angle)]);
    angle += 2 * Math.PI * segment.length / totalLength;
  }

  for (let segmentIndex = 0; segmentIndex < segments.length; ++segmentIndex) {
    const segment = segments[segmentIndex];
    const startUV = cornerUV[segmentIndex];
    const endUV = cornerUV[(segmentIndex + 1) % cornerUV.length];
    let traversed = 0;

    for (const edgeIndex of segment.edgeIndices) {
      const vertex = boundaryVertices[edgeIndex];
      const next = (edgeIndex + 1) % boundaryVertices.length;
      const t = segment.length > EPSILON
          ? traversed / segment.length
          : 0;
      uv.set(vertex, [
        startUV[0] * (1 - t) + endUV[0] * t,
        startUV[1] * (1 - t) + endUV[1] * t
      ]);
      traversed += surface.distanceBetweenVertices(
          boundaryVertices[edgeIndex],
          boundaryVertices[next]
      );
    }
  }

  return { uv, cornerUV };
}

function boundaryCycleForFaces(surface, faceIndices) {
  const use = new Map();
  const directed = new Map();

  for (const face of faceIndices) {
    const triangle = surface._triangles[face];

    for (let edge = 0; edge < 3; ++edge) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % 3];
      const key = edgeKey(a, b);
      use.set(key, (use.get(key) ?? 0) + 1);
      directed.set(key, [a, b]);
    }
  }

  const boundaryEdges = Array.from(use)
      .filter(([, count]) => count === 1)
      .map(([key]) => directed.get(key));
  const cycle = orderCycle(boundaryEdges);

  if (!cycle) {
    throw new Error("The straightening patch boundary is not one cycle.");
  }

  return cycle;
}

function diskTraceEdges(surface, faceIndices) {
  const edges = [];
  const seen = new Set();

  for (const face of faceIndices) {
    const triangle = surface._triangles[face];

    for (let edge = 0; edge < 3; ++edge) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % 3];
      const key = edgeKey(a, b);

      if (!seen.has(key)) {
        seen.add(key);
        edges.push([a, b]);
      }
    }
  }

  return edges;
}

function solveDiskHarmonicMap(
    surface,
    faceIndices,
    boundaryVertices,
    harmonicCorners,
    uniform,
    solverOptions
) {
  const boundary = boundaryUVFromCycle(
      surface,
      boundaryVertices,
      harmonicCorners
  );
  const vertexSet = new Set();

  for (const face of faceIndices) {
    for (const vertex of surface._triangles[face]) {
      vertexSet.add(vertex);
    }
  }

  const boundarySet = new Set(boundaryVertices);
  const interiorVertices = Array.from(vertexSet)
      .filter(vertex => !boundarySet.has(vertex));
  const interiorIndex = new Map(
      interiorVertices.map((vertex, index) => [vertex, index])
  );
  const rows = interiorVertices.map(() => new Map());
  const rhsX = new Float64Array(interiorVertices.length);
  const rhsY = new Float64Array(interiorVertices.length);

  for (const spring of buildSpringWeights(
      surface,
      { faces: faceIndices },
      uniform
  )) {
    const [a, b] = spring.vertices;
    const weight = spring.weight;

    if (!Number.isFinite(weight) || Math.abs(weight) < EPSILON) {
      continue;
    }

    for (const [vertex, neighbor] of [[a, b], [b, a]]) {
      const row = interiorIndex.get(vertex);

      if (row === undefined) {
        continue;
      }

      rows[row].set(row, (rows[row].get(row) ?? 0) + weight);
      const column = interiorIndex.get(neighbor);

      if (column !== undefined) {
        rows[row].set(column, (rows[row].get(column) ?? 0) - weight);
      }
      else {
        const fixed = boundary.uv.get(neighbor);

        if (!fixed) {
          throw new Error("Straightening disk has an unclassified boundary vertex.");
        }

        rhsX[row] += weight * fixed[0];
        rhsY[row] += weight * fixed[1];
      }
    }
  }

  const resultX = solvePCG(rows, rhsX, solverOptions);
  const resultY = solvePCG(rows, rhsY, solverOptions);
  const uv = new Map(boundary.uv);

  for (let index = 0; index < interiorVertices.length; ++index) {
    uv.set(interiorVertices[index], [
      resultX.solution[index],
      resultY.solution[index]
    ]);
  }

  let mappedArea = 0;
  let degenerateTriangles = 0;

  for (const face of faceIndices) {
    const triangle = surface._triangles[face];
    const signedArea = triangleArea2(
        uv.get(triangle[0]),
        uv.get(triangle[1]),
        uv.get(triangle[2])
    );

    if (Math.abs(signedArea) < 1e-18) {
      degenerateTriangles += 1;
    }

    mappedArea += Math.abs(signedArea) / 2;
  }

  let polygonArea = 0;

  for (let index = 0; index < boundary.cornerUV.length; ++index) {
    const a = boundary.cornerUV[index];
    const b = boundary.cornerUV[(index + 1) % boundary.cornerUV.length];
    polygonArea += a[0] * b[1] - a[1] * b[0];
  }

  polygonArea = Math.abs(polygonArea) / 2;

  const flippedTriangles = Math.abs(mappedArea - polygonArea)
      > 1e-5 * Math.max(1, polygonArea)
      ? 1
      : 0;

  return {
    faces: faceIndices,
    boundary: boundaryVertices,
    harmonicCorners,
    uv,
    cornerUV: boundary.cornerUV,
    traceEdges: diskTraceEdges(surface, faceIndices),
    solver: uniform ? "uniform" : "paper",
    iterations: Math.max(resultX.iterations, resultY.iterations),
    relativeResidual: Math.max(
        resultX.relativeResidual,
        resultY.relativeResidual
    ),
    flippedTriangles,
    degenerateTriangles,
    mappedArea,
    polygonArea
  };
}

function containingDiskFace(surface, disk, point) {
  let closest = null;
  let closestMinimum = -Infinity;

  for (const face of disk.faces) {
    const triangle = surface._triangles[face];
    const weights = barycentric2(
        point,
        disk.uv.get(triangle[0]),
        disk.uv.get(triangle[1]),
        disk.uv.get(triangle[2])
    );

    if (!weights) {
      continue;
    }

    const minimum = Math.min(...weights);

    if (minimum > closestMinimum) {
      closestMinimum = minimum;
      closest = { face, triangle, weights };
    }

    if (weights.every(weight => weight >= -1e-7 && weight <= 1 + 1e-7)) {
      return { face, triangle, weights };
    }
  }

  return closestMinimum >= -1e-5 ? closest : null;
}

function inverseMapInDiskFace(surface, disk, face, point) {
  const triangle = surface._triangles[face];
  const weights = barycentric2(
      point,
      disk.uv.get(triangle[0]),
      disk.uv.get(triangle[1]),
      disk.uv.get(triangle[2])
  );

  if (!weights) {
    throw new Error(`Straightened path reached a degenerate UV face ${face}.`);
  }

  return {
    face,
    barycentric: weights,
    position: barycentricPoint(
        weights,
        surface.getVertexPosition(triangle[0]),
        surface.getVertexPosition(triangle[1]),
        surface.getVertexPosition(triangle[2])
    )
  };
}

function traceDiskSegment(surface, disk, start, end) {
  const parameters = [0, 1];

  for (const [a, b] of disk.traceEdges) {
    const parameter = segmentIntersectionParameter(
        start,
        end,
        disk.uv.get(a),
        disk.uv.get(b)
    );

    if (parameter !== null) {
      parameters.push(parameter);
    }
  }

  const ordered = uniqueSorted(parameters);
  const segments = [];

  for (let index = 0; index < ordered.length - 1; ++index) {
    const parameter = (ordered[index] + ordered[index + 1]) / 2;
    const midpoint = [
      start[0] * (1 - parameter) + end[0] * parameter,
      start[1] * (1 - parameter) + end[1] * parameter
    ];
    const hit = containingDiskFace(surface, disk, midpoint);

    if (!hit) {
      continue;
    }

    const startParameter = ordered[index];
    const endParameter = ordered[index + 1];
    const startUV = [
      start[0] * (1 - startParameter) + end[0] * startParameter,
      start[1] * (1 - startParameter) + end[1] * startParameter
    ];
    const endUV = [
      start[0] * (1 - endParameter) + end[0] * endParameter,
      start[1] * (1 - endParameter) + end[1] * endParameter
    ];
    const segment = {
      face: hit.face,
      start: {
        parameter: startParameter,
        uv: startUV,
        ...inverseMapInDiskFace(surface, disk, hit.face, startUV)
      },
      end: {
        parameter: endParameter,
        uv: endUV,
        ...inverseMapInDiskFace(surface, disk, hit.face, endUV)
      }
    };
    const previous = segments[segments.length - 1];

    if (previous && previous.face === segment.face) {
      previous.end = segment.end;
    }
    else {
      segments.push(segment);
    }
  }

  if (segments.length === 0) {
    throw new Error("Could not trace a straightened Delaunay edge through its harmonic quadrilateral.");
  }

  return {
    segments,
    points: [
      segments[0].start,
      ...segments.map(segment => segment.end)
    ],
    facePath: segments.map(segment => segment.face)
  };
}

function containingFace(mesh, tile, point) {
  let closest = null;
  let closestMinimum = -Infinity;

  for (const face of tile.faces) {
    const triangle = mesh._triangles[face];
    const weights = barycentric2(
        point,
        tile.uv.get(triangle[0]),
        tile.uv.get(triangle[1]),
        tile.uv.get(triangle[2])
    );

    if (!weights) {
      continue;
    }

    const minimum = Math.min(...weights);

    if (minimum > closestMinimum) {
      closestMinimum = minimum;
      closest = { face, triangle, weights };
    }

    if (weights.every(weight => weight >= -1e-7 && weight <= 1 + 1e-7)) {
      return { face, triangle, weights };
    }
  }

  return closestMinimum >= -1e-5 ? closest : null;
}

function inverseMapInFace(mesh, tile, face, point) {
  const triangle = mesh._triangles[face];
  const weights = barycentric2(
      point,
      tile.uv.get(triangle[0]),
      tile.uv.get(triangle[1]),
      tile.uv.get(triangle[2])
  );

  if (!weights) {
    throw new Error(`Harmonic path reached a degenerate UV face ${face}.`);
  }

  return {
    face,
    barycentric: weights,
    position: barycentricPoint(
        weights,
        mesh.getVertexPosition(triangle[0]),
        mesh.getVertexPosition(triangle[1]),
        mesh.getVertexPosition(triangle[2])
    )
  };
}

function tracePlanarSegment(mesh, tile, start, end) {
  const parameters = [0, 1];

  for (const [a, b] of tile.traceEdges) {
    const parameter = segmentIntersectionParameter(
        start,
        end,
        tile.uv.get(a),
        tile.uv.get(b)
    );

    if (parameter !== null) {
      parameters.push(parameter);
    }
  }

  const ordered = uniqueSorted(parameters);
  const segments = [];

  for (let index = 0; index < ordered.length - 1; ++index) {
    const parameter = (ordered[index] + ordered[index + 1]) / 2;
    const midpoint = [
      start[0] * (1 - parameter) + end[0] * parameter,
      start[1] * (1 - parameter) + end[1] * parameter
    ];
    const hit = containingFace(mesh, tile, midpoint);

    if (!hit) {
      continue;
    }

    const startParameter = ordered[index];
    const endParameter = ordered[index + 1];
    const startUV = [
      start[0] * (1 - startParameter) + end[0] * startParameter,
      start[1] * (1 - startParameter) + end[1] * startParameter
    ];
    const endUV = [
      start[0] * (1 - endParameter) + end[0] * endParameter,
      start[1] * (1 - endParameter) + end[1] * endParameter
    ];
    const segment = {
      face: hit.face,
      start: {
        parameter: startParameter,
        uv: startUV,
        ...inverseMapInFace(mesh, tile, hit.face, startUV)
      },
      end: {
        parameter: endParameter,
        uv: endUV,
        ...inverseMapInFace(mesh, tile, hit.face, endUV)
      }
    };
    const previous = segments[segments.length - 1];

    if (previous && previous.face === segment.face) {
      previous.end = segment.end;
    }
    else {
      segments.push(segment);
    }
  }

  if (segments.length === 0) {
    throw new Error(`Could not trace a segment through harmonic tile ${tile.owner}.`);
  }

  return {
    segments,
    points: [
      segments[0].start,
      ...segments.map(segment => segment.end)
    ],
    facePath: segments.map(segment => segment.face)
  };
}

function cutForNeighbor(tile, neighbor) {
  return tile.cuts.find(cut => cut.neighbor === neighbor) ?? null;
}

function surfaceCutMidpoint(mesh, tile, cut, boundaryUVMap = tile.uv) {
  let remaining = cut.length / 2;

  for (const edgeIndex of cut.edgeIndices) {
    const edge = tile.boundary.edges[edgeIndex];
    const startVertex = tile.boundary.vertices[edgeIndex];
    const endVertex = tile.boundary.vertices[
      (edgeIndex + 1) % tile.boundary.vertices.length
    ];
    const length = mesh.distanceBetweenVertices(startVertex, endVertex);

    if (remaining <= length + 1e-12) {
      const t = length > EPSILON
          ? Math.max(0, Math.min(1, remaining / length))
          : 0;
      const face = edge.faces.find(candidate => tile.faces.includes(candidate));
      const triangle = mesh._triangles[face];
      const weights = [0, 0, 0];
      weights[triangle.indexOf(startVertex)] = 1 - t;
      weights[triangle.indexOf(endVertex)] = t;
      const startUV = boundaryUVMap.get(startVertex);
      const endUV = boundaryUVMap.get(endVertex);
      return {
        parameter: 1,
        uv: [
          startUV[0] * (1 - t) + endUV[0] * t,
          startUV[1] * (1 - t) + endUV[1] * t
        ],
        face,
        barycentric: weights,
        position: barycentricPoint(
            weights,
            mesh.getVertexPosition(triangle[0]),
            mesh.getVertexPosition(triangle[1]),
            mesh.getVertexPosition(triangle[2])
        )
      };
    }

    remaining -= length;
  }

  throw new Error(`Could not locate the midpoint of tile ${tile.owner}'s cut.`);
}

function polygonCentroid(points) {
  let areaTwice = 0;
  let x = 0;
  let y = 0;

  for (let index = 0; index < points.length; ++index) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const cross = a[0] * b[1] - b[0] * a[1];
    areaTwice += cross;
    x += (a[0] + b[0]) * cross;
    y += (a[1] + b[1]) * cross;
  }

  if (Math.abs(areaTwice) < EPSILON) {
    throw new Error("Harmonic tile polygon has zero area.");
  }

  return [
    x / (3 * areaTwice),
    y / (3 * areaTwice)
  ];
}

function polygonArea2(indices, coordinates) {
  let area = 0;

  for (let index = 0; index < indices.length; ++index) {
    const a = coordinates.get(indices[index]);
    const b = coordinates.get(indices[(index + 1) % indices.length]);
    area += a[0] * b[1] - a[1] * b[0];
  }

  return area;
}

function addGraphEdge(graph, a, b) {
  if (a === b) {
    return;
  }

  if (!graph.has(a)) {
    graph.set(a, new Set());
  }

  if (!graph.has(b)) {
    graph.set(b, new Set());
  }

  graph.get(a).add(b);
  graph.get(b).add(a);
}

function extractPlanarRegions(graph, coordinates) {
  const orderedNeighbors = new Map();

  for (const [vertex, neighbors] of graph) {
    const center = coordinates.get(vertex);
    orderedNeighbors.set(vertex, Array.from(neighbors).sort((a, b) => {
      const pa = coordinates.get(a);
      const pb = coordinates.get(b);
      return Math.atan2(pa[1] - center[1], pa[0] - center[0])
          - Math.atan2(pb[1] - center[1], pb[0] - center[0]);
    }));
  }

  const visited = new Set();
  const regions = [];

  for (const [start, neighbors] of orderedNeighbors) {
    for (const first of neighbors) {
      const startKey = `${start}>${first}`;

      if (visited.has(startKey)) {
        continue;
      }

      const cycle = [];
      let from = start;
      let to = first;

      while (true) {
        const key = `${from}>${to}`;

        if (visited.has(key)) {
          break;
        }

        visited.add(key);
        cycle.push(from);
        const nextNeighbors = orderedNeighbors.get(to);
        const reverseIndex = nextNeighbors.indexOf(from);
        const next = nextNeighbors[
          (reverseIndex - 1 + nextNeighbors.length) % nextNeighbors.length
        ];
        from = to;
        to = next;

        if (from === start && to === first) {
          break;
        }
      }

      if (cycle.length >= 3 && polygonArea2(cycle, coordinates) > 1e-12) {
        regions.push(cycle);
      }
    }
  }

  return regions;
}

function orderCycle(edges) {
  const neighbors = new Map();

  for (const [a, b] of edges) {
    if (!neighbors.has(a)) {
      neighbors.set(a, []);
    }

    if (!neighbors.has(b)) {
      neighbors.set(b, []);
    }

    neighbors.get(a).push(b);
    neighbors.get(b).push(a);
  }

  if (neighbors.size < 3
      || Array.from(neighbors.values()).some(items => items.length !== 2)) {
    return null;
  }

  const start = neighbors.keys().next().value;
  const cycle = [start];
  let previous = -1;
  let current = start;

  while (true) {
    const next = neighbors.get(current).find(vertex => vertex !== previous);

    if (next === undefined) {
      return null;
    }

    if (next === start) {
      break;
    }

    if (cycle.includes(next)) {
      return null;
    }

    cycle.push(next);
    previous = current;
    current = next;
  }

  return cycle.length === neighbors.size ? cycle : null;
}

function buildCyclePatches(triangulation, triangles, paths) {
  const edgeTriangles = new Map();
  const vertexTriangles = new Map();

  for (let triangleIndex = 0; triangleIndex < triangles.length; ++triangleIndex) {
    const triangle = triangles[triangleIndex];

    for (const vertex of triangle) {
      if (!vertexTriangles.has(vertex)) {
        vertexTriangles.set(vertex, []);
      }

      vertexTriangles.get(vertex).push(triangleIndex);
    }

    for (let edge = 0; edge < 3; ++edge) {
      const key = edgeKey(
          triangle[edge],
          triangle[(edge + 1) % 3]
      );

      if (!edgeTriangles.has(key)) {
        edgeTriangles.set(key, []);
      }

      edgeTriangles.get(key).push(triangleIndex);
    }
  }

  const pathsBySites = new Map(
      paths.map(path => [
        [...path.sites].sort((a, b) => a - b).join(":"),
        path
      ])
  );

  return triangulation.triangles.map((baseTriangle, baseFace) => {
    const boundaryEdgeMap = new Map();

    for (let edge = 0; edge < 3; ++edge) {
      const a = baseTriangle.sites[edge];
      const b = baseTriangle.sites[(edge + 1) % 3];
      const path = pathsBySites.get(
          [a, b].sort((x, y) => x - y).join(":")
      );

      if (!path) {
        throw new Error(`Base face ${baseFace} is missing path ${a}:${b}.`);
      }

      for (let segment = 0; segment < path.vertexPath.length - 1; ++segment) {
        const vertices = [
          path.vertexPath[segment],
          path.vertexPath[segment + 1]
        ];
        boundaryEdgeMap.set(
            edgeKey(vertices[0], vertices[1]),
            vertices
        );
      }
    }

    const boundaryEdges = Array.from(boundaryEdgeMap.values());
    const boundaryCycle = orderCycle(boundaryEdges);

    if (!boundaryCycle) {
      throw new Error(`Base face ${baseFace} paths do not form one cycle.`);
    }

    const boundaryKeys = new Set(boundaryEdgeMap.keys());
    let seed = -1;

    for (const junctionVertex of baseTriangle.meshVertices) {
      seed = vertexTriangles.get(junctionVertex)?.[0] ?? -1;

      if (seed >= 0) {
        break;
      }
    }

    if (seed < 0) {
      throw new Error(`Base face ${baseFace} has no refined junction seed.`);
    }

    const patchTriangles = [];
    const visited = new Set([seed]);
    const stack = [seed];

    while (stack.length > 0) {
      const triangleIndex = stack.pop();
      const triangle = triangles[triangleIndex];
      patchTriangles.push(triangleIndex);

      for (let edge = 0; edge < 3; ++edge) {
        const key = edgeKey(
            triangle[edge],
            triangle[(edge + 1) % 3]
        );

        if (boundaryKeys.has(key)) {
          continue;
        }

        for (const neighbor of edgeTriangles.get(key) ?? []) {
          if (neighbor !== triangleIndex && !visited.has(neighbor)) {
            visited.add(neighbor);
            stack.push(neighbor);
          }
        }
      }
    }

    const patchVertices = new Set(
        patchTriangles.flatMap(triangle => triangles[triangle])
    );

    return {
      baseFace,
      sites: [...baseTriangle.sites],
      triangles: patchTriangles,
      vertices: Array.from(patchVertices),
      boundaryEdges,
      boundaryCycle
    };
  });
}

function buildConstrainedRefinement(mesh, paths, tiles, triangulation) {
  const sourceGraph = mesh._faceDualGraph ?? mesh.buildFaceDualGraph();
  const sourceEdgeFaces = new Map(
      sourceGraph.primalEdges.map(edge => [
        edgeKey(edge.vertices[0], edge.vertices[1]),
        edge.faces
      ])
  );
  const vertices = mesh._vertices.map(vertex => [
    vertex[0],
    vertex[1],
    vertex[2]
  ]);
  const vertexKeys = new Map(
      vertices.map((_, index) => [`v:${index}`, index])
  );
  const faceCoordinates = Array.from({ length: mesh._numT }, () => new Map());
  const faceSegments = Array.from({ length: mesh._numT }, () => []);
  const constrainedEdges = new Set();
  const refinedPaths = [];
  const siteVertexIndices = new Array(tiles.length);

  for (let face = 0; face < mesh._numT; ++face) {
    const triangle = mesh._triangles[face];
    faceCoordinates[face].set(triangle[0], [0, 0]);
    faceCoordinates[face].set(triangle[1], [1, 0]);
    faceCoordinates[face].set(triangle[2], [0, 1]);
  }

  const pointVertex = (tile, point, face) => {
    const triangle = mesh._triangles[face];
    const weights = barycentric2(
        point.uv,
        tile.uv.get(triangle[0]),
        tile.uv.get(triangle[1]),
        tile.uv.get(triangle[2])
    );

    if (!weights) {
      throw new Error(`Could not locate a harmonic path point in face ${face}.`);
    }

    let key;
    let index;
    const vertexCorner = weights.findIndex(weight => weight > 1 - 1e-5);

    if (vertexCorner >= 0) {
      index = triangle[vertexCorner];
      key = `v:${index}`;
    }
    else {
      const zeroCorner = weights.findIndex(weight => Math.abs(weight) < 1e-5);

      if (zeroCorner >= 0) {
        const aCorner = (zeroCorner + 1) % 3;
        const bCorner = (zeroCorner + 2) % 3;
        const a = triangle[aCorner];
        const b = triangle[bCorner];
        const denominator = weights[aCorner] + weights[bCorner];
        const t = denominator > EPSILON ? weights[bCorner] / denominator : 0;
        const canonicalT = a < b ? t : 1 - t;
        const sourceEdgeKey = edgeKey(a, b);
        key = `e:${sourceEdgeKey}:${canonicalT.toFixed(8)}`;

        if (!vertexKeys.has(key)) {
          vertexKeys.set(key, vertices.length);
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          const loPosition = mesh.getVertexPosition(lo);
          const hiPosition = mesh.getVertexPosition(hi);
          vertices.push([
            loPosition[0] * (1 - canonicalT) + hiPosition[0] * canonicalT,
            loPosition[1] * (1 - canonicalT) + hiPosition[1] * canonicalT,
            loPosition[2] * (1 - canonicalT) + hiPosition[2] * canonicalT
          ]);
        }

        index = vertexKeys.get(key);

        for (const incidentFace of sourceEdgeFaces.get(sourceEdgeKey) ?? []) {
          const incidentTriangle = mesh._triangles[incidentFace];
          const incidentWeights = [0, 0, 0];
          incidentWeights[incidentTriangle.indexOf(Math.min(a, b))] =
              1 - canonicalT;
          incidentWeights[incidentTriangle.indexOf(Math.max(a, b))] =
              canonicalT;
          faceCoordinates[incidentFace].set(
              index,
              [incidentWeights[1], incidentWeights[2]]
          );
        }
      }
      else {
        key = `f:${face}:${weights.map(value => value.toFixed(12)).join(":")}`;
      }

      if (index === undefined && !vertexKeys.has(key)) {
        vertexKeys.set(key, vertices.length);
        vertices.push(barycentricPoint(
            weights,
            mesh.getVertexPosition(triangle[0]),
            mesh.getVertexPosition(triangle[1]),
            mesh.getVertexPosition(triangle[2])
        ));
      }

      index ??= vertexKeys.get(key);
    }

    if (!faceCoordinates[face].has(index)) {
      faceCoordinates[face].set(index, [weights[1], weights[2]]);
    }

    return index;
  };
  const mergeRefinedVertex = (from, to) => {
    if (from === to) {
      return;
    }

    for (let face = 0; face < faceCoordinates.length; ++face) {
      const coordinates = faceCoordinates[face];

      if (coordinates.has(from)) {
        if (!coordinates.has(to)) {
          coordinates.set(to, coordinates.get(from));
        }

        coordinates.delete(from);
      }

      for (const segment of faceSegments[face]) {
        for (let endpoint = 0; endpoint < 2; ++endpoint) {
          if (segment[endpoint] === from) {
            segment[endpoint] = to;
          }
        }
      }
    }
  };

  for (const path of paths) {
    const halves = [];

    for (let halfIndex = 0; halfIndex < 2; ++halfIndex) {
      const half = path.halfPaths[halfIndex];
      const tile = tiles[path.sites[halfIndex]];
      const indices = [];

      for (const segment of half.segments) {
        const face = segment.face;
        let a = pointVertex(tile, segment.start, face);
        const b = pointVertex(tile, segment.end, face);

        if (indices.length > 0 && indices[indices.length - 1] !== a) {
          const previous = indices[indices.length - 1];
          const duplicate = a;
          faceCoordinates[face].set(
              previous,
              faceCoordinates[face].get(a)
          );
          a = previous;

          if (duplicate >= mesh._numV) {
            faceCoordinates[face].delete(duplicate);
          }
        }

        if (indices.length === 0) {
          indices.push(a);
        }

        if (a !== b) {
          indices.push(b);
          faceSegments[face].push([a, b]);
        }
      }

      const site = path.sites[halfIndex];
      const existingSiteVertex = siteVertexIndices[site];

      if (existingSiteVertex === undefined) {
        siteVertexIndices[site] = indices[0];
      }
      else if (indices[0] !== existingSiteVertex) {
        const distance = Math.hypot(
            vertices[indices[0]][0] - vertices[existingSiteVertex][0],
            vertices[indices[0]][1] - vertices[existingSiteVertex][1],
            vertices[indices[0]][2] - vertices[existingSiteVertex][2]
        );

        if (distance > 1e-6) {
          throw new Error(
              `Harmonic paths disagree at site ${site} by ${distance}.`
          );
        }

        mergeRefinedVertex(indices[0], existingSiteVertex);
        indices[0] = existingSiteVertex;
      }

      halves.push(indices);
    }

    const cutA = halves[0][halves[0].length - 1];
    const cutB = halves[1][halves[1].length - 1];

    if (cutA !== cutB) {
      const distance = Math.hypot(
          vertices[cutB][0] - vertices[cutA][0],
          vertices[cutB][1] - vertices[cutA][1],
          vertices[cutB][2] - vertices[cutA][2]
      );

      if (distance > 1e-6) {
        throw new Error(
            `Harmonic paths ${path.sites.join(":")} disagree at their cut by ${distance}.`
        );
      }

      mergeRefinedVertex(cutB, cutA);
      halves[1][halves[1].length - 1] = cutA;
    }

    refinedPaths.push({
      ...path,
      vertexPath: [
        ...halves[0],
        ...halves[1].slice(0, -1).reverse()
      ]
    });
  }

  for (const segments of faceSegments) {
    for (const [a, b] of segments) {
      constrainedEdges.add(edgeKey(a, b));
    }
  }

  const activeConstraintVertices = new Set(
      faceSegments.flatMap(segments => segments.flat())
  );

  for (const coordinates of faceCoordinates) {
    for (const vertex of Array.from(coordinates.keys())) {
      if (vertex >= mesh._numV && !activeConstraintVertices.has(vertex)) {
        coordinates.delete(vertex);
      }
    }
  }

  const triangles = [];
  const parentFaces = [];
  const appendTriangle = (triangle, face, coordinates) => {
    if (new Set(triangle).size !== 3
        || Math.abs(triangleArea2(
            coordinates.get(triangle[0]),
            coordinates.get(triangle[1]),
            coordinates.get(triangle[2])
        )) < 1e-14) {
      return;
    }

    triangles.push(triangle);
    parentFaces.push(face);
  };

  for (let face = 0; face < mesh._numT; ++face) {
    const source = mesh._triangles[face];
    const coordinates = faceCoordinates[face];
    const graph = new Map();
    const edgePoints = [
      { a: source[0], b: source[1], values: [] },
      { a: source[1], b: source[2], values: [] },
      { a: source[2], b: source[0], values: [] }
    ];

    for (const vertex of coordinates.keys()) {
      const point = coordinates.get(vertex);

      if (Math.abs(point[1]) < 1e-6) {
        edgePoints[0].values.push([point[0], vertex]);
      }

      if (Math.abs(point[0] + point[1] - 1) < 1e-6) {
        edgePoints[1].values.push([point[1], vertex]);
      }

      if (Math.abs(point[0]) < 1e-6) {
        edgePoints[2].values.push([1 - point[1], vertex]);
      }
    }

    for (const edge of edgePoints) {
      edge.values.sort((a, b) => a[0] - b[0]);

      for (let index = 0; index < edge.values.length - 1; ++index) {
        addGraphEdge(graph, edge.values[index][1], edge.values[index + 1][1]);
      }
    }

    for (const segment of faceSegments[face]) {
      addGraphEdge(graph, segment[0], segment[1]);
    }

    const regions = extractPlanarRegions(graph, coordinates);

    if (regions.length === 0) {
      if (faceSegments[face].length === 0) {
        appendTriangle([...source], face, coordinates);
        continue;
      }

      throw new Error(
          `Constrained refinement produced no regions in face ${face}: ${JSON.stringify({
            segments: faceSegments[face].map(segment => segment.map(
                vertex => [vertex, coordinates.get(vertex)]
            )),
            graph: Array.from(graph, ([vertex, neighbors]) => [
              vertex,
              coordinates.get(vertex),
              Array.from(neighbors)
            ])
          })}`
      );
    }

    for (const region of regions) {
      if (region.length === 3
          && Math.abs(triangleArea2(
              coordinates.get(region[0]),
              coordinates.get(region[1]),
              coordinates.get(region[2])
          )) > 1e-12) {
        appendTriangle([...region], face, coordinates);
        continue;
      }

      const centerUV = region.reduce((sum, vertex) => {
        const point = coordinates.get(vertex);
        sum[0] += point[0] / region.length;
        sum[1] += point[1] / region.length;
        return sum;
      }, [0, 0]);
      const centerWeights = [
        1 - centerUV[0] - centerUV[1],
        centerUV[0],
        centerUV[1]
      ];
      const centerVertex = vertices.length;
      vertices.push(barycentricPoint(
          centerWeights,
          mesh.getVertexPosition(source[0]),
          mesh.getVertexPosition(source[1]),
          mesh.getVertexPosition(source[2])
      ));
      coordinates.set(centerVertex, centerUV);

      for (let edge = 0; edge < region.length; ++edge) {
        const a = region[edge];
        const b = region[(edge + 1) % region.length];

        if (Math.abs(triangleArea2(
            coordinates.get(a),
            coordinates.get(b),
            centerUV
        )) > 1e-12) {
          appendTriangle([a, b, centerVertex], face, coordinates);
        }
      }
    }
  }

  const cyclePatches = buildCyclePatches(
      triangulation,
      triangles,
      refinedPaths
  );
  const usedVertices = new Set();
  const refinedEdgeUse = new Map();

  for (const triangle of triangles) {
    for (const vertex of triangle) {
      usedVertices.add(vertex);
    }

    for (let edge = 0; edge < 3; ++edge) {
      const key = edgeKey(
          triangle[edge],
          triangle[(edge + 1) % 3]
      );
      refinedEdgeUse.set(key, (refinedEdgeUse.get(key) ?? 0) + 1);
    }
  }

  const refinementValidation = {
    eulerCharacteristic: usedVertices.size
        - refinedEdgeUse.size
        + triangles.length,
    boundaryEdges: Array.from(refinedEdgeUse.values())
        .filter(count => count === 1).length,
    nonManifoldEdges: Array.from(refinedEdgeUse.values())
        .filter(count => count > 2).length,
    boundaryEdgeKinds: Array.from(refinedEdgeUse)
        .filter(([, count]) => count === 1)
        .reduce((counts, [key]) => {
          const [a, b] = key.split(":").map(Number);
          const kind = a < mesh._numV && b < mesh._numV
              ? "original-original"
              : a >= mesh._numV && b >= mesh._numV
                  ? "new-new"
                  : "original-new";
          counts[kind] = (counts[kind] ?? 0) + 1;
          return counts;
        }, {}),
    boundarySamples: Array.from(refinedEdgeUse)
        .filter(([, count]) => count === 1)
        .slice(0, 8)
        .map(([key]) => key),
    incidenceHistogram: Array.from(refinedEdgeUse.values())
        .reduce((histogram, count) => {
          histogram[count] = (histogram[count] ?? 0) + 1;
          return histogram;
        }, {}),
    usedVertices: usedVertices.size,
    edges: refinedEdgeUse.size,
    faces: triangles.length
  };

  return {
    vertices,
    triangles,
    parentFaces,
    siteVertexIndices,
    paths: refinedPaths,
    barrierEdges: constrainedEdges,
    patchComplex: {
      subdivision: {
        vertices,
        triangles,
        parentFaces,
        faceCentroidIndices: []
      },
      patches: cyclePatches
    },
    refinement: {
      vertices,
      triangles,
      parentFaces,
      siteVertexIndices,
      surfaceConstrainedEdges: Array.from(constrainedEdges),
      mode: "harmonic-constrained-refinement",
      validation: refinementValidation
    }
  };
}

function buildConstrainedRefinementOnSurface(
    surface,
    paths,
    triangulation,
    siteVertexIndices,
    {
      originalVertexCount = surface._numV,
      mode = "harmonic-straightened-refinement"
    } = {}
) {
  const sourceEdgeFaces = new Map();

  for (let face = 0; face < surface._numT; ++face) {
    const triangle = surface._triangles[face];

    for (let edge = 0; edge < 3; ++edge) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % 3];
      const key = edgeKey(a, b);

      if (!sourceEdgeFaces.has(key)) {
        sourceEdgeFaces.set(key, []);
      }

      sourceEdgeFaces.get(key).push(face);
    }
  }

  const vertices = surface._vertices.map(vertex => [
    vertex[0],
    vertex[1],
    vertex[2]
  ]);
  const vertexKeys = new Map(
      vertices.map((_, index) => [`v:${index}`, index])
  );
  const faceCoordinates = Array.from({ length: surface._numT }, () => new Map());
  const faceSegments = Array.from({ length: surface._numT }, () => []);
  const constrainedEdges = new Set();
  const refinedPaths = [];

  for (let face = 0; face < surface._numT; ++face) {
    const triangle = surface._triangles[face];
    faceCoordinates[face].set(triangle[0], [0, 0]);
    faceCoordinates[face].set(triangle[1], [1, 0]);
    faceCoordinates[face].set(triangle[2], [0, 1]);
  }

  const pointVertex = (point, face) => {
    const triangle = surface._triangles[face];
    const weights = point.barycentric;
    let key;
    let index;
    const vertexCorner = weights.findIndex(weight => weight > 1 - 1e-5);

    if (vertexCorner >= 0) {
      index = triangle[vertexCorner];
      key = `v:${index}`;
    }
    else {
      const zeroCorner = weights.findIndex(weight => Math.abs(weight) < 1e-5);

      if (zeroCorner >= 0) {
        const aCorner = (zeroCorner + 1) % 3;
        const bCorner = (zeroCorner + 2) % 3;
        const a = triangle[aCorner];
        const b = triangle[bCorner];
        const denominator = weights[aCorner] + weights[bCorner];
        const t = denominator > EPSILON ? weights[bCorner] / denominator : 0;
        const canonicalT = a < b ? t : 1 - t;
        const sourceEdgeKey = edgeKey(a, b);
        key = `e:${sourceEdgeKey}:${canonicalT.toFixed(8)}`;

        if (!vertexKeys.has(key)) {
          vertexKeys.set(key, vertices.length);
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          const loPosition = surface.getVertexPosition(lo);
          const hiPosition = surface.getVertexPosition(hi);
          vertices.push([
            loPosition[0] * (1 - canonicalT) + hiPosition[0] * canonicalT,
            loPosition[1] * (1 - canonicalT) + hiPosition[1] * canonicalT,
            loPosition[2] * (1 - canonicalT) + hiPosition[2] * canonicalT
          ]);
        }

        index = vertexKeys.get(key);

        for (const incidentFace of sourceEdgeFaces.get(sourceEdgeKey) ?? []) {
          const incidentTriangle = surface._triangles[incidentFace];
          const incidentWeights = [0, 0, 0];
          incidentWeights[incidentTriangle.indexOf(Math.min(a, b))] =
              1 - canonicalT;
          incidentWeights[incidentTriangle.indexOf(Math.max(a, b))] =
              canonicalT;
          faceCoordinates[incidentFace].set(
              index,
              [incidentWeights[1], incidentWeights[2]]
          );
        }
      }
      else {
        key = `f:${face}:${weights.map(value => value.toFixed(12)).join(":")}`;
      }

      if (index === undefined && !vertexKeys.has(key)) {
        vertexKeys.set(key, vertices.length);
        vertices.push(barycentricPoint(
            weights,
            surface.getVertexPosition(triangle[0]),
            surface.getVertexPosition(triangle[1]),
            surface.getVertexPosition(triangle[2])
        ));
      }

      index ??= vertexKeys.get(key);
    }

    if (!faceCoordinates[face].has(index)) {
      faceCoordinates[face].set(index, [weights[1], weights[2]]);
    }

    return index;
  };
  const mergeRefinedVertex = (from, to) => {
    if (from === to) {
      return;
    }

    const distance = Math.hypot(
        vertices[from][0] - vertices[to][0],
        vertices[from][1] - vertices[to][1],
        vertices[from][2] - vertices[to][2]
    );

    if (distance > 1e-6) {
      throw new Error(
          `Refined vertex merge would collapse distinct points by ${distance}.`
      );
    }

    for (let face = 0; face < faceCoordinates.length; ++face) {
      const coordinates = faceCoordinates[face];

      if (coordinates.has(from)) {
        if (!coordinates.has(to)) {
          coordinates.set(to, coordinates.get(from));
        }

        coordinates.delete(from);
      }

      for (const segment of faceSegments[face]) {
        for (let endpoint = 0; endpoint < 2; ++endpoint) {
          if (segment[endpoint] === from) {
            segment[endpoint] = to;
          }
        }
      }
    }
  };

  for (const path of paths) {
    const indices = [];

    for (const segment of path.segments) {
      const face = segment.face;
      let a = pointVertex(segment.start, face);
      const b = pointVertex(segment.end, face);

      if (indices.length > 0 && indices[indices.length - 1] !== a) {
        const previous = indices[indices.length - 1];
        mergeRefinedVertex(a, previous);
        a = previous;
      }

      if (indices.length === 0) {
        indices.push(a);
      }

      if (a !== b) {
        indices.push(b);
        faceSegments[face].push([a, b]);
      }
    }

    const startSite = path.sites[0];
    const endSite = path.sites[1];

    if (indices[0] !== siteVertexIndices[startSite]) {
      mergeRefinedVertex(indices[0], siteVertexIndices[startSite]);
      indices[0] = siteVertexIndices[startSite];
    }

    if (indices[indices.length - 1] !== siteVertexIndices[endSite]) {
      mergeRefinedVertex(
          indices[indices.length - 1],
          siteVertexIndices[endSite]
      );
      indices[indices.length - 1] = siteVertexIndices[endSite];
    }

    refinedPaths.push({
      ...path,
      vertexPath: indices
    });
  }

  for (const segments of faceSegments) {
    for (const [a, b] of segments) {
      constrainedEdges.add(edgeKey(a, b));
    }
  }

  const activeConstraintVertices = new Set(
      faceSegments.flatMap(segments => segments.flat())
  );

  for (const coordinates of faceCoordinates) {
    for (const vertex of Array.from(coordinates.keys())) {
      if (vertex >= surface._numV && !activeConstraintVertices.has(vertex)) {
        coordinates.delete(vertex);
      }
    }
  }

  const triangles = [];
  const parentFaces = [];
  const appendTriangle = (triangle, face, coordinates) => {
    if (new Set(triangle).size !== 3
        || Math.abs(triangleArea2(
            coordinates.get(triangle[0]),
            coordinates.get(triangle[1]),
            coordinates.get(triangle[2])
        )) < 1e-14) {
      return;
    }

    triangles.push(triangle);
    parentFaces.push(surface._parentFaces?.[face] ?? face);
  };

  for (let face = 0; face < surface._numT; ++face) {
    const source = surface._triangles[face];
    const coordinates = faceCoordinates[face];
    const graph = new Map();
    const edgePoints = [
      { a: source[0], b: source[1], values: [] },
      { a: source[1], b: source[2], values: [] },
      { a: source[2], b: source[0], values: [] }
    ];

    for (const vertex of coordinates.keys()) {
      const point = coordinates.get(vertex);

      if (Math.abs(point[1]) < 1e-6) {
        edgePoints[0].values.push([point[0], vertex]);
      }

      if (Math.abs(point[0] + point[1] - 1) < 1e-6) {
        edgePoints[1].values.push([point[1], vertex]);
      }

      if (Math.abs(point[0]) < 1e-6) {
        edgePoints[2].values.push([1 - point[1], vertex]);
      }
    }

    for (const edge of edgePoints) {
      edge.values.sort((a, b) => a[0] - b[0]);

      for (let index = 0; index < edge.values.length - 1; ++index) {
        addGraphEdge(graph, edge.values[index][1], edge.values[index + 1][1]);
      }
    }

    for (const segment of faceSegments[face]) {
      addGraphEdge(graph, segment[0], segment[1]);
    }

    const regions = extractPlanarRegions(graph, coordinates);

    if (regions.length === 0) {
      if (faceSegments[face].length === 0) {
        appendTriangle([...source], face, coordinates);
        continue;
      }

      throw new Error(`Straightened constrained refinement produced no regions in face ${face}.`);
    }

    for (const region of regions) {
      if (region.length === 3
          && Math.abs(triangleArea2(
              coordinates.get(region[0]),
              coordinates.get(region[1]),
              coordinates.get(region[2])
          )) > 1e-12) {
        appendTriangle([...region], face, coordinates);
        continue;
      }

      const centerUV = region.reduce((sum, vertex) => {
        const point = coordinates.get(vertex);
        sum[0] += point[0] / region.length;
        sum[1] += point[1] / region.length;
        return sum;
      }, [0, 0]);
      const centerWeights = [
        1 - centerUV[0] - centerUV[1],
        centerUV[0],
        centerUV[1]
      ];
      const centerVertex = vertices.length;
      vertices.push(barycentricPoint(
          centerWeights,
          surface.getVertexPosition(source[0]),
          surface.getVertexPosition(source[1]),
          surface.getVertexPosition(source[2])
      ));
      coordinates.set(centerVertex, centerUV);

      for (let edge = 0; edge < region.length; ++edge) {
        const a = region[edge];
        const b = region[(edge + 1) % region.length];

        if (Math.abs(triangleArea2(
            coordinates.get(a),
            coordinates.get(b),
            centerUV
        )) > 1e-12) {
          appendTriangle([a, b, centerVertex], face, coordinates);
        }
      }
    }
  }

  const cyclePatches = buildCyclePatches(
      triangulation,
      triangles,
      refinedPaths
  );
  const usedVertices = new Set();
  const refinedEdgeUse = new Map();

  for (const triangle of triangles) {
    for (const vertex of triangle) {
      usedVertices.add(vertex);
    }

    for (let edge = 0; edge < 3; ++edge) {
      const key = edgeKey(
          triangle[edge],
          triangle[(edge + 1) % 3]
      );
      refinedEdgeUse.set(key, (refinedEdgeUse.get(key) ?? 0) + 1);
    }
  }

  const refinementValidation = {
    eulerCharacteristic: usedVertices.size
        - refinedEdgeUse.size
        + triangles.length,
    boundaryEdges: Array.from(refinedEdgeUse.values())
        .filter(count => count === 1).length,
    nonManifoldEdges: Array.from(refinedEdgeUse.values())
        .filter(count => count > 2).length,
    boundaryEdgeKinds: Array.from(refinedEdgeUse)
        .filter(([, count]) => count === 1)
        .reduce((counts, [key]) => {
          const [a, b] = key.split(":").map(Number);
          const kind = a < originalVertexCount && b < originalVertexCount
              ? "source-source"
              : a >= originalVertexCount && b >= originalVertexCount
                  ? "new-new"
                  : "source-new";
          counts[kind] = (counts[kind] ?? 0) + 1;
          return counts;
        }, {}),
    boundarySamples: Array.from(refinedEdgeUse)
        .filter(([, count]) => count === 1)
        .slice(0, 8)
        .map(([key]) => key),
    incidenceHistogram: Array.from(refinedEdgeUse.values())
        .reduce((histogram, count) => {
          histogram[count] = (histogram[count] ?? 0) + 1;
          return histogram;
        }, {}),
    usedVertices: usedVertices.size,
    edges: refinedEdgeUse.size,
    faces: triangles.length
  };

  return {
    vertices,
    triangles,
    parentFaces,
    siteVertexIndices,
    paths: refinedPaths,
    barrierEdges: constrainedEdges,
    patchComplex: {
      subdivision: {
        vertices,
        triangles,
        parentFaces,
        faceCentroidIndices: []
      },
      patches: cyclePatches
    },
    refinement: {
      vertices,
      triangles,
      parentFaces,
      siteVertexIndices,
      surfaceConstrainedEdges: Array.from(constrainedEdges),
      mode,
      validation: refinementValidation
    }
  };
}

function validateTriangleSoup(vertices, triangles) {
  const usedVertices = new Set();
  const edgeUse = new Map();
  let degenerateTriangles = 0;

  for (const triangle of triangles) {
    const unique = new Set(triangle);

    for (const vertex of triangle) {
      usedVertices.add(vertex);
    }

    if (unique.size !== 3) {
      degenerateTriangles += 1;
      continue;
    }

    const a = vertices[triangle[0]];
    const b = vertices[triangle[1]];
    const c = vertices[triangle[2]];
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0]
    ];

    if (Math.hypot(normal[0], normal[1], normal[2]) < 1e-12) {
      degenerateTriangles += 1;
    }

    for (let edge = 0; edge < 3; ++edge) {
      const key = edgeKey(triangle[edge], triangle[(edge + 1) % 3]);
      edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
    }
  }

  return {
    eulerCharacteristic: usedVertices.size - edgeUse.size + triangles.length,
    boundaryEdges: Array.from(edgeUse.values()).filter(count => count === 1).length,
    nonManifoldEdges: Array.from(edgeUse.values()).filter(count => count > 2).length,
    degenerateTriangles,
    usedVertices: usedVertices.size,
    edges: edgeUse.size,
    faces: triangles.length,
    incidenceHistogram: Array.from(edgeUse.values())
        .reduce((histogram, count) => {
          histogram[count] = (histogram[count] ?? 0) + 1;
          return histogram;
        }, {})
  };
}

function clampBarycentric(weights) {
  const clamped = weights.map(value => Math.max(0, Math.min(1, value)));
  const sum = clamped[0] + clamped[1] + clamped[2];

  if (sum < EPSILON) {
    return [1 / 3, 1 / 3, 1 / 3];
  }

  return clamped.map(value => value / sum);
}

function integerPointKey(point) {
  return `${point[0]}:${point[1]}`;
}

function integerGcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);

  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }

  return a;
}

function distance3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function meshBoundingDiameter(mesh) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let vertex = 0; vertex < mesh._numV; ++vertex) {
    const position = mesh.getVertexPosition(vertex);

    for (let axis = 0; axis < 3; ++axis) {
      min[axis] = Math.min(min[axis], position[axis]);
      max[axis] = Math.max(max[axis], position[axis]);
    }
  }

  return Math.hypot(
      max[0] - min[0],
      max[1] - min[1],
      max[2] - min[2]
  );
}

function baseEdgePointKey(baseSites, denominator, point) {
  const [a, b] = point;
  const c = denominator - a - b;

  if (b === 0) {
    const start = baseSites[0];
    const end = baseSites[1];
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    const t = start < end ? a / denominator : 1 - a / denominator;
    return `e:${lo}:${hi}:${t.toFixed(10)}`;
  }

  if (c === 0) {
    const start = baseSites[1];
    const end = baseSites[2];
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    const t = start < end ? b / denominator : 1 - b / denominator;
    return `e:${lo}:${hi}:${t.toFixed(10)}`;
  }

  if (a === 0) {
    const start = baseSites[0];
    const end = baseSites[2];
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    const t = start < end ? b / denominator : 1 - b / denominator;
    return `e:${lo}:${hi}:${t.toFixed(10)}`;
  }

  return null;
}

function subdivisionGridKey(baseSites, baseFace, denominator, a, b) {
  const c = denominator - a - b;

  if (a === 0 && b === 0) {
    return `s:${baseSites[0]}`;
  }

  if (a === denominator && b === 0) {
    return `s:${baseSites[1]}`;
  }

  if (a === 0 && b === denominator) {
    return `s:${baseSites[2]}`;
  }

  if (b === 0 || c === 0 || a === 0) {
    return baseEdgePointKey(baseSites, denominator, [a, b]);
  }

  return `f:${baseFace}:${a}:${b}`;
}

function splitIntegerTriangle(triangle) {
  const [p0, p1, p2] = triangle.points;
  const m01 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
  const m12 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  const m20 = [(p2[0] + p0[0]) / 2, (p2[1] + p0[1]) / 2];
  const level = triangle.level + 1;

  return [
    { points: [p0, m01, m20], level },
    { points: [m01, p1, m12], level },
    { points: [m20, m12, p2], level },
    { points: [m01, m12, m20], level }
  ];
}

function buildPatchHarmonicMap(patch, patchComplex, triangulation, siteVertexIndices) {
  const subdivision = patchComplex.subdivision;
  const baseSites = triangulation.triangles[patch.baseFace].sites;
  const cornerUVByOwner = new Map([
    [baseSites[0], [0, 0]],
    [baseSites[1], [1, 0]],
    [baseSites[2], [0, 1]]
  ]);
  const ownerBySiteVertex = new Map(
      baseSites.map(owner => [siteVertexIndices[owner], owner])
  );
  const boundary = patch.boundaryCycle;
  const cornerPositions = [];

  for (let index = 0; index < boundary.length; ++index) {
    if (ownerBySiteVertex.has(boundary[index])) {
      cornerPositions.push(index);
    }
  }

  if (cornerPositions.length !== 3) {
    throw new Error(
        `Remesh patch ${patch.baseFace} expected three base corners, found ${cornerPositions.length}.`
    );
  }

  const uvByVertex = new Map();
  const boundarySet = new Set(boundary);
  const setUV = (vertex, uv) => {
    const existing = uvByVertex.get(vertex);

    if (existing
        && Math.hypot(existing[0] - uv[0], existing[1] - uv[1]) > 1e-5) {
      throw new Error(
          `Inconsistent remesh boundary UV for vertex ${vertex} in patch ${patch.baseFace}.`
      );
    }

    uvByVertex.set(vertex, uv);
  };

  for (let corner = 0; corner < cornerPositions.length; ++corner) {
    const startIndex = cornerPositions[corner];
    const endIndex = cornerPositions[(corner + 1) % cornerPositions.length];
    const startVertex = boundary[startIndex];
    const endVertex = boundary[endIndex];
    const startOwner = ownerBySiteVertex.get(startVertex);
    const endOwner = ownerBySiteVertex.get(endVertex);
    const startUV = cornerUVByOwner.get(startOwner);
    const endUV = cornerUVByOwner.get(endOwner);
    const arc = [];
    let index = startIndex;

    while (true) {
      arc.push(boundary[index]);

      if (index === endIndex) {
        break;
      }

      index = (index + 1) % boundary.length;
    }

    const distances = [0];
    let length = 0;

    for (let i = 1; i < arc.length; ++i) {
      const a = subdivision.vertices[arc[i - 1]];
      const b = subdivision.vertices[arc[i]];
      length += Math.hypot(
          b[0] - a[0],
          b[1] - a[1],
          b[2] - a[2]
      );
      distances.push(length);
    }

    for (let i = 0; i < arc.length; ++i) {
      const t = length > EPSILON ? distances[i] / length : 0;
      setUV(arc[i], [
        startUV[0] * (1 - t) + endUV[0] * t,
        startUV[1] * (1 - t) + endUV[1] * t
      ]);
    }
  }

  const adjacency = new Map(patch.vertices.map(vertex => [vertex, new Set()]));

  for (const triangleIndex of patch.triangles) {
    const triangle = subdivision.triangles[triangleIndex];

    for (let edge = 0; edge < 3; ++edge) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % 3];
      adjacency.get(a)?.add(b);
      adjacency.get(b)?.add(a);
    }
  }

  const unknowns = patch.vertices.filter(vertex => !boundarySet.has(vertex));
  const center = patch.vertices.reduce((sum, vertex) => {
    const uv = uvByVertex.get(vertex);

    if (uv) {
      sum[0] += uv[0];
      sum[1] += uv[1];
      sum[2] += 1;
    }

    return sum;
  }, [0, 0, 0]);
  const initialUV = center[2] > 0
      ? [center[0] / center[2], center[1] / center[2]]
      : [1 / 3, 1 / 3];

  for (const vertex of unknowns) {
    uvByVertex.set(vertex, [...initialUV]);
  }

  let iterations = 0;
  let maxChange = Infinity;

  for (; iterations < 4000 && maxChange > 1e-9; ++iterations) {
    maxChange = 0;

    for (const vertex of unknowns) {
      const neighbors = Array.from(adjacency.get(vertex) ?? []);

      if (neighbors.length === 0) {
        continue;
      }

      const next = [0, 0];

      for (const neighbor of neighbors) {
        const uv = uvByVertex.get(neighbor);
        next[0] += uv[0] / neighbors.length;
        next[1] += uv[1] / neighbors.length;
      }

      const previous = uvByVertex.get(vertex);
      maxChange = Math.max(
          maxChange,
          Math.hypot(next[0] - previous[0], next[1] - previous[1])
      );
      uvByVertex.set(vertex, next);
    }
  }

  const uvTriangles = patch.triangles.map(triangleIndex => ({
    triangleIndex,
    vertices: subdivision.triangles[triangleIndex],
    uvs: subdivision.triangles[triangleIndex].map(vertex => uvByVertex.get(vertex))
  }));
  let positiveTriangles = 0;
  let negativeTriangles = 0;
  let degenerateTriangles = 0;

  for (const triangle of uvTriangles) {
    const area = triangleArea2(
        triangle.uvs[0],
        triangle.uvs[1],
        triangle.uvs[2]
    );

    if (Math.abs(area) < 1e-12) {
      degenerateTriangles += 1;
    }
    else if (area < 0) {
      negativeTriangles += 1;
    }
    else {
      positiveTriangles += 1;
    }
  }

  return {
    uvByVertex,
    uvTriangles,
    iterations,
    maxChange,
    flippedTriangles: Math.min(positiveTriangles, negativeTriangles),
    degenerateTriangles
  };
}

function locatePatchPoint(uv, patchMap, patchComplex) {
  let best = null;
  let bestViolation = Infinity;

  for (const triangle of patchMap.uvTriangles) {
    const weights = barycentric2(
        uv,
        triangle.uvs[0],
        triangle.uvs[1],
        triangle.uvs[2]
    );

    if (!weights) {
      continue;
    }

    const violation = Math.max(
        0,
        -weights[0],
        -weights[1],
        -weights[2]
    );

    if (violation < bestViolation) {
      bestViolation = violation;
      best = { triangle, weights };
    }

    if (violation < 1e-7) {
      break;
    }
  }

  if (!best || bestViolation > 5e-4) {
    throw new Error(
        `Could not locate remesh sample ${JSON.stringify(uv)} in patch UV map.`
    );
  }

  const weights = clampBarycentric(best.weights);
  const vertices = best.triangle.vertices.map(
      vertex => patchComplex.subdivision.vertices[vertex]
  );

  return barycentricPoint(weights, vertices[0], vertices[1], vertices[2]);
}

export function buildPatchRemesh(
    mesh,
    triangulation,
    paperTriangulation,
    {
      level = 4
    } = {}
) {
  const patchComplex = paperTriangulation.patchComplex;

  if (!patchComplex) {
    throw new Error("Cannot build a remesh without base-face patches.");
  }

  const siteVertexIndices =
      paperTriangulation.embedding.refinement?.siteVertexIndices;

  if (!siteVertexIndices) {
    throw new Error("Cannot build a remesh without site vertex indices.");
  }

  const subdivisionFactor = 2 ** Math.max(0, Math.floor(level));
  const vertices = [];
  const triangles = [];
  const vertexKeys = new Map();
  const diagnostics = {
    level,
    subdivisionFactor,
    patchCount: patchComplex.patches.length,
    patchSolves: 0,
    maxPatchIterations: 0,
    maxPatchChange: 0,
    flippedPatchTriangles: 0,
    degeneratePatchTriangles: 0
  };
  const getVertex = (key, position) => {
    const existing = vertexKeys.get(key);

    if (existing !== undefined) {
      const previous = vertices[existing];

      if (distance3(previous, position) > 1e-7) {
        throw new Error(
            `Inconsistent remesh vertex merge for ${key}; `
            + `distance ${distance3(previous, position)}.`
        );
      }

      return existing;
    }

    vertexKeys.set(key, vertices.length);
    vertices.push(position);
    return vertices.length - 1;
  };

  for (const patch of patchComplex.patches) {
    const patchMap = buildPatchHarmonicMap(
        patch,
        patchComplex,
        triangulation,
        siteVertexIndices
    );
    const baseSites = triangulation.triangles[patch.baseFace].sites;
    const grid = new Map();

    diagnostics.patchSolves += 1;
    diagnostics.maxPatchIterations = Math.max(
        diagnostics.maxPatchIterations,
        patchMap.iterations
    );
    diagnostics.maxPatchChange = Math.max(
        diagnostics.maxPatchChange,
        patchMap.maxChange
    );
    diagnostics.flippedPatchTriangles += patchMap.flippedTriangles;
    diagnostics.degeneratePatchTriangles += patchMap.degenerateTriangles;

    for (let a = 0; a <= subdivisionFactor; ++a) {
      for (let b = 0; b <= subdivisionFactor - a; ++b) {
        const uv = [a / subdivisionFactor, b / subdivisionFactor];
        const position = locatePatchPoint(uv, patchMap, patchComplex);
        const vertex = getVertex(
            subdivisionGridKey(
                baseSites,
                patch.baseFace,
                subdivisionFactor,
                a,
                b
            ),
            position
        );
        grid.set(`${a}:${b}`, vertex);
      }
    }

    for (let a = 0; a < subdivisionFactor; ++a) {
      for (let b = 0; b < subdivisionFactor - a; ++b) {
        triangles.push([
          grid.get(`${a}:${b}`),
          grid.get(`${a + 1}:${b}`),
          grid.get(`${a}:${b + 1}`)
        ]);

        if (a + b < subdivisionFactor - 1) {
          triangles.push([
            grid.get(`${a + 1}:${b}`),
            grid.get(`${a + 1}:${b + 1}`),
            grid.get(`${a}:${b + 1}`)
          ]);
        }
      }
    }
  }

  const validation = validateTriangleSoup(vertices, triangles);

  return {
    vertices,
    triangles,
    diagnostics,
    validation
  };
}

function uvFromIntegerPoint(point, denominator) {
  return [point[0] / denominator, point[1] / denominator];
}

function buildAdaptivePositionSampler(patchMap, patchComplex, denominator) {
  const cache = new Map();

  return point => {
    const isIntegerGridPoint = Number.isInteger(point[0])
        && Number.isInteger(point[1])
        && point[0] >= 0
        && point[1] >= 0
        && point[0] + point[1] <= denominator;
    const key = isIntegerGridPoint
        ? `g:${point[0]}:${point[1]}`
        : `u:${point[0].toFixed(12)}:${point[1].toFixed(12)}`;

    if (!cache.has(key)) {
      const uv = isIntegerGridPoint
          ? uvFromIntegerPoint(point, denominator)
          : point;
      cache.set(key, locatePatchPoint(uv, patchMap, patchComplex));
    }

    return cache.get(key);
  };
}

function estimateApproximationError(triangle, samplePosition, denominator) {
  const uvs = triangle.points.map(point => uvFromIntegerPoint(point, denominator));
  const positions = triangle.points.map(point => samplePosition(point));
  const samples = [
    [
      (uvs[0][0] + uvs[1][0]) / 2,
      (uvs[0][1] + uvs[1][1]) / 2
    ],
    [
      (uvs[1][0] + uvs[2][0]) / 2,
      (uvs[1][1] + uvs[2][1]) / 2
    ],
    [
      (uvs[2][0] + uvs[0][0]) / 2,
      (uvs[2][1] + uvs[0][1]) / 2
    ],
    [
      (uvs[0][0] + uvs[1][0] + uvs[2][0]) / 3,
      (uvs[0][1] + uvs[1][1] + uvs[2][1]) / 3
    ]
  ];
  let error = 0;

  for (const uv of samples) {
    const weights = barycentric2(uv, uvs[0], uvs[1], uvs[2]);

    if (!weights) {
      continue;
    }

    const approximate = barycentricPoint(weights, positions[0], positions[1], positions[2]);
    const exact = samplePosition(uv);
    error = Math.max(error, distance3(approximate, exact));
  }

  return error;
}

function refinePatchForApproximation(state, tolerance, maxLevel) {
  const nextLeaves = [];
  let adaptiveSplits = 0;
  let maxEstimatedError = 0;

  const visit = triangle => {
    const error = estimateApproximationError(
        triangle,
        state.samplePosition,
        state.denominator
    );
    maxEstimatedError = Math.max(maxEstimatedError, error);

    if (error > tolerance && triangle.level < maxLevel) {
      adaptiveSplits += 1;
      for (const child of splitIntegerTriangle(triangle)) {
        visit(child);
      }
      return;
    }

    nextLeaves.push({
      ...triangle,
      estimatedError: error
    });
  };

  for (const leaf of state.leaves) {
    visit(leaf);
  }

  state.leaves = nextLeaves;
  return {
    adaptiveSplits,
    maxEstimatedError
  };
}

function rebuildApproximationVertexSet(state) {
  const vertices = new Set();

  for (const leaf of state.leaves) {
    for (const point of leaf.points) {
      vertices.add(integerPointKey(point));
    }
  }

  state.vertexKeys = vertices;
}

function collectApproximationBoundaryKeys(states) {
  const globalBoundaryKeys = new Set();

  for (const state of states) {
    rebuildApproximationVertexSet(state);

    for (const key of state.vertexKeys) {
      const point = key.split(":").map(Number);
      const boundaryKey = baseEdgePointKey(
          state.baseSites,
          state.denominator,
          point
      );

      if (boundaryKey) {
        globalBoundaryKeys.add(boundaryKey);
      }
    }
  }

  return globalBoundaryKeys;
}

function leafBoundaryPointsWithSplits(state, leaf, globalBoundaryKeys) {
  const boundary = [];
  const pushPoint = point => {
    const previous = boundary[boundary.length - 1];

    if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) {
      boundary.push(point);
    }
  };

  for (let edge = 0; edge < 3; ++edge) {
    const start = leaf.points[edge];
    const end = leaf.points[(edge + 1) % 3];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const steps = integerGcd(dx, dy);
    const step = [dx / steps, dy / steps];

    pushPoint(start);

    for (let i = 1; i < steps; ++i) {
      const point = [
        start[0] + step[0] * i,
        start[1] + step[1] * i
      ];
      const boundaryKey = baseEdgePointKey(
          state.baseSites,
          state.denominator,
          point
      );

      if (state.vertexKeys.has(integerPointKey(point))
          || (boundaryKey && globalBoundaryKeys.has(boundaryKey))) {
        pushPoint(point);
      }
    }
  }

  if (boundary.length > 1) {
    const first = boundary[0];
    const last = boundary[boundary.length - 1];

    if (first[0] === last[0] && first[1] === last[1]) {
      boundary.pop();
    }
  }

  return boundary;
}

export function buildPatchApproximation(
    mesh,
    triangulation,
    paperTriangulation,
    {
      level = 4,
      epsilonPercent = 1.0
    } = {}
) {
  const patchComplex = paperTriangulation.patchComplex;

  if (!patchComplex) {
    throw new Error("Cannot build an approximation without base-face patches.");
  }

  const siteVertexIndices =
      paperTriangulation.embedding.refinement?.siteVertexIndices;

  if (!siteVertexIndices) {
    throw new Error("Cannot build an approximation without site vertex indices.");
  }

  const maxLevel = Math.max(0, Math.floor(level));
  const denominator = 2 ** maxLevel;
  const diameter = meshBoundingDiameter(mesh);
  const errorTolerance = diameter * Math.max(0, epsilonPercent) / 100;
  const states = [];
  const diagnostics = {
    level: maxLevel,
    subdivisionFactor: denominator,
    epsilonPercent,
    errorTolerance,
    objectDiameter: diameter,
    patchCount: patchComplex.patches.length,
    patchSolves: 0,
    maxPatchIterations: 0,
    maxPatchChange: 0,
    flippedPatchTriangles: 0,
    degeneratePatchTriangles: 0,
    adaptiveSplits: 0,
    conformitySplits: 0,
    maxEstimatedError: 0,
    maxRetainedError: 0,
    retainedLeaves: 0,
    retainedLeavesByLevel: {},
    toleranceSatisfied: false,
    reachedMaxLevel: false
  };

  for (const patch of patchComplex.patches) {
    const patchMap = buildPatchHarmonicMap(
        patch,
        patchComplex,
        triangulation,
        siteVertexIndices
    );
    const baseSites = triangulation.triangles[patch.baseFace].sites;
    const state = {
      patch,
      patchMap,
      baseSites,
      denominator,
      samplePosition: null,
      leaves: [{
        points: [[0, 0], [denominator, 0], [0, denominator]],
        level: 0
      }],
      vertexKeys: new Set()
    };
    state.samplePosition = buildAdaptivePositionSampler(
        patchMap,
        patchComplex,
        denominator
    );
    diagnostics.patchSolves += 1;
    diagnostics.maxPatchIterations = Math.max(
        diagnostics.maxPatchIterations,
        patchMap.iterations
    );
    diagnostics.maxPatchChange = Math.max(
        diagnostics.maxPatchChange,
        patchMap.maxChange
    );
    diagnostics.flippedPatchTriangles += patchMap.flippedTriangles;
    diagnostics.degeneratePatchTriangles += patchMap.degenerateTriangles;

    const refinement = refinePatchForApproximation(
        state,
        errorTolerance,
        maxLevel
    );
    diagnostics.adaptiveSplits += refinement.adaptiveSplits;
    diagnostics.maxEstimatedError = Math.max(
        diagnostics.maxEstimatedError,
        refinement.maxEstimatedError
    );
    states.push(state);
  }

  const globalBoundaryKeys = collectApproximationBoundaryKeys(states);

  const vertices = [];
  const triangles = [];
  const vertexKeys = new Map();
  const getVertex = (key, position) => {
    const existing = vertexKeys.get(key);

    if (existing !== undefined) {
      const previous = vertices[existing];

      if (distance3(previous, position) > Math.max(1e-7, errorTolerance * 0.05)) {
        throw new Error(
            `Inconsistent approximation vertex merge for ${key}; `
            + `distance ${distance3(previous, position)}.`
        );
      }

      return existing;
    }

    vertexKeys.set(key, vertices.length);
    vertices.push(position);
    return vertices.length - 1;
  };

  for (const state of states) {
    for (const leaf of state.leaves) {
      diagnostics.retainedLeaves += 1;
      diagnostics.retainedLeavesByLevel[leaf.level] =
          (diagnostics.retainedLeavesByLevel[leaf.level] ?? 0) + 1;
      const retainedError = leaf.estimatedError ?? estimateApproximationError(
          leaf,
          state.samplePosition,
          denominator
      );
      diagnostics.maxRetainedError = Math.max(
          diagnostics.maxRetainedError,
          retainedError
      );

      const boundary = leafBoundaryPointsWithSplits(
          state,
          leaf,
          globalBoundaryKeys
      );
      diagnostics.conformitySplits += Math.max(0, boundary.length - 3);
      const indices = boundary.map(point => getVertex(
          subdivisionGridKey(
              state.baseSites,
              state.patch.baseFace,
              denominator,
              point[0],
              point[1]
          ),
          state.samplePosition(point)
      ));

      if (indices.length === 3 && new Set(indices).size === 3) {
        triangles.push(indices);
      }
      else if (indices.length > 3) {
        const centerUV = [
          (leaf.points[0][0] + leaf.points[1][0] + leaf.points[2][0])
              / (3 * denominator),
          (leaf.points[0][1] + leaf.points[1][1] + leaf.points[2][1])
              / (3 * denominator)
        ];
        const center = getVertex(
            `c:${state.patch.baseFace}:`
                + leaf.points.map(integerPointKey).join("|"),
            state.samplePosition(centerUV)
        );

        for (let i = 0; i < indices.length; ++i) {
          const triangle = [
            center,
            indices[i],
            indices[(i + 1) % indices.length]
          ];

          if (new Set(triangle).size === 3) {
            triangles.push(triangle);
          }
        }
      }
    }
  }

  const validation = validateTriangleSoup(vertices, triangles);
  diagnostics.toleranceSatisfied =
      diagnostics.maxRetainedError <= errorTolerance + 1e-12;
  diagnostics.reachedMaxLevel =
      Object.keys(diagnostics.retainedLeavesByLevel)
          .some(key => Number(key) >= maxLevel);

  return {
    vertices,
    triangles,
    diagnostics,
    validation
  };
}

function solveStraighteningDisk(surface, faceIndices, boundary, corners, options) {
  try {
    const disk = solveDiskHarmonicMap(
        surface,
        faceIndices,
        boundary,
        corners,
        false,
        options
    );

    if (disk.flippedTriangles > 0 || disk.degenerateTriangles > 0) {
      throw new Error(
          `Weighted straightening disk folded (${disk.flippedTriangles}, ${disk.degenerateTriangles}).`
      );
    }

    return disk;
  }
  catch (weightedError) {
    const disk = solveDiskHarmonicMap(
        surface,
        faceIndices,
        boundary,
        corners,
        true,
        options
    );

    if (disk.flippedTriangles > 0 || disk.degenerateTriangles > 0) {
      throw new Error(
          `Straightening disk failed weighted and uniform embeddings: `
          + `${weightedError.message} / uniform folded `
          + `(${disk.flippedTriangles}, ${disk.degenerateTriangles}).`
      );
    }

    disk.weightedError = weightedError.message;
    return disk;
  }
}

function originalFacePath(surface, trace) {
  return trace.facePath
      .map(face => surface._parentFaces?.[face] ?? face)
      .filter((face, index, values) => index === 0 || face !== values[index - 1]);
}

function sourceDisplaySegment(mesh, surface, segment) {
  const sourceFace = surface._parentFaces?.[segment.face] ?? segment.face;
  const triangle = mesh._triangles[sourceFace];
  const start = barycentric3(
      segment.start.position,
      mesh.getVertexPosition(triangle[0]),
      mesh.getVertexPosition(triangle[1]),
      mesh.getVertexPosition(triangle[2])
  );
  const end = barycentric3(
      segment.end.position,
      mesh.getVertexPosition(triangle[0]),
      mesh.getVertexPosition(triangle[1]),
      mesh.getVertexPosition(triangle[2])
  );

  if (!start || !end) {
    throw new Error(
        `Could not project a straightened path segment to source face ${sourceFace}.`
    );
  }

  return {
    face: sourceFace,
    start: { barycentric: start },
    end: { barycentric: end }
  };
}

function straightenInitialDelaunay(
    mesh,
    voronoi,
    triangulation,
    initialEmbedding,
    initialPatchComplex,
    {
      tolerance = 1e-10,
      maxIterations
    } = {}
) {
  const surface = makeSurface(
      initialEmbedding.subdivision.vertices,
      initialEmbedding.subdivision.triangles,
      initialEmbedding.subdivision.parentFaces
  );
  const patchByBaseFace = new Map(
      initialPatchComplex.patches.map(patch => [patch.baseFace, patch])
  );
  const baseFacesByEdge = new Map();

  for (let baseFace = 0; baseFace < triangulation.triangles.length; ++baseFace) {
    const sites = triangulation.triangles[baseFace].sites;

    for (let edge = 0; edge < 3; ++edge) {
      const key = edgeKey(sites[edge], sites[(edge + 1) % 3]);

      if (!baseFacesByEdge.has(key)) {
        baseFacesByEdge.set(key, []);
      }

      baseFacesByEdge.get(key).push(baseFace);
    }
  }

  const siteVertexIndices = Array.from(
      initialEmbedding.subdivision.faceCentroidIndices
  );
  const siteToVertex = voronoi.siteFaces.map(
      siteFace => siteVertexIndices[siteFace]
  );
  const paths = [];
  const diagnostics = {
    attemptedEdges: triangulation.edges.length,
    straightenedEdges: 0,
    weightedSolves: 0,
    uniformSolves: 0,
    maxResidual: 0,
    flippedTriangles: 0,
    degenerateTriangles: 0,
    firstWeightedError: ""
  };

  for (const baseEdge of triangulation.edges) {
    const [siteA, siteB] = baseEdge.sites;
    const adjacentFaces = baseFacesByEdge.get(edgeKey(siteA, siteB)) ?? [];

    if (adjacentFaces.length !== 2) {
      throw new Error(
          `Straightening requires two Delaunay triangles adjacent to edge ${siteA}:${siteB}.`
      );
    }

    const unionFaces = Array.from(new Set(adjacentFaces.flatMap(baseFace => {
      const patch = patchByBaseFace.get(baseFace);

      if (!patch) {
        throw new Error(`No patch exists for base face ${baseFace}.`);
      }

      return patch.triangles;
    })));
    const boundary = boundaryCycleForFaces(surface, unionFaces);
    const oppositeSites = adjacentFaces.map(baseFace => {
      const sites = triangulation.triangles[baseFace].sites;
      return sites.find(site => site !== siteA && site !== siteB);
    });
    const cornerSet = new Set([
      siteToVertex[siteA],
      siteToVertex[siteB],
      ...oppositeSites.map(site => siteToVertex[site])
    ]);
    const corners = boundary.filter(vertex => cornerSet.has(vertex));

    if (corners.length !== 4
        || !corners.includes(siteToVertex[siteA])
        || !corners.includes(siteToVertex[siteB])) {
      throw new Error(
          `Straightening patch for ${siteA}:${siteB} does not expose four quadrilateral corners.`
      );
    }

    const disk = solveStraighteningDisk(
        surface,
        unionFaces,
        boundary,
        corners,
        { tolerance, maxIterations }
    );

    if (disk.solver === "paper") {
      diagnostics.weightedSolves += 1;
    }
    else {
      diagnostics.uniformSolves += 1;
      diagnostics.firstWeightedError ||= disk.weightedError ?? "";
    }

    diagnostics.maxResidual = Math.max(
        diagnostics.maxResidual,
        Number.isFinite(disk.relativeResidual) ? disk.relativeResidual : 0
    );
    diagnostics.flippedTriangles += disk.flippedTriangles;
    diagnostics.degenerateTriangles += disk.degenerateTriangles;

    const start = disk.uv.get(siteToVertex[siteA]);
    const end = disk.uv.get(siteToVertex[siteB]);
    const trace = traceDiskSegment(surface, disk, start, end);
    const surfacePolyline = trace.points.map(point => point.position);
    const displaySegments = trace.segments.map(
        segment => sourceDisplaySegment(mesh, surface, segment)
    );

    paths.push({
      sites: [siteA, siteB],
      facePath: originalFacePath(surface, trace),
      surfaceFacePath: trace.facePath,
      surfacePolyline,
      segments: trace.segments,
      displaySegments,
      construction: "harmonic-straightened"
    });
    diagnostics.straightenedEdges += 1;
  }

  const constrained = buildConstrainedRefinementOnSurface(
      surface,
      paths,
      triangulation,
      siteToVertex,
      {
        originalVertexCount: surface._numV,
        mode: "harmonic-straightened-refinement"
      }
  );
  const faceCentroidIndices = new Array(mesh._numT);

  for (let owner = 0; owner < voronoi.siteFaces.length; ++owner) {
    faceCentroidIndices[voronoi.siteFaces[owner]] =
        constrained.siteVertexIndices[owner];
  }

  const embedding = {
    subdivision: {
      vertices: constrained.vertices,
      triangles: constrained.triangles,
      parentFaces: constrained.parentFaces,
      faceCentroidIndices
    },
    paths: constrained.paths,
    barrierEdges: constrained.barrierEdges,
    refinement: constrained.refinement,
    initialEmbedding
  };
  constrained.patchComplex.subdivision.faceCentroidIndices =
      faceCentroidIndices;
  constrained.patchComplex.embedding = embedding;

  return {
    paths: constrained.paths,
    embedding,
    patchComplex: constrained.patchComplex,
    diagnostics
  };
}

export function buildPaperInitialDelaunay(mesh, voronoi, triangulation, {
  tolerance = 1e-10,
  maxIterations,
  tiles: preparedTiles,
  straightenEdges = true
} = {}) {
  const rawTiles = preparedTiles ?? Array.from(
      { length: voronoi.tiles.length },
      (_, owner) => buildTile(mesh, voronoi, owner)
  );
  const tiles = [];
  let weightedSolves = 0;
  let uniformSolves = 0;
  let boundaryRecoveryCount = 0;
  let maxResidual = 0;
  let firstWeightedError = "";
  let firstUniformError = "";

  const checkedSolve = (tile, uniform) => {
    const embedded = solveTile(
        mesh,
        tile,
        uniform,
        { tolerance, maxIterations }
    );

    if (embedded.flippedTriangles > 0
        || embedded.degenerateTriangles > 0) {
      throw new Error(
          `${uniform ? "Uniform" : "Weighted"} harmonic embedding is not one-to-one `
          + `(${embedded.flippedTriangles} overlaps, `
          + `${embedded.degenerateTriangles} degenerate triangles).`
      );
    }

    return embedded;
  };

  const solveWithSpringRecovery = tile => {
    try {
      const embedded = checkedSolve(tile, false);
      weightedSolves += 1;
      return embedded;
    }
    catch (weightedError) {
      firstWeightedError ||= weightedError.message;

      try {
        const embedded = checkedSolve(tile, true);
        uniformSolves += 1;
        embedded.weightedError = weightedError.message;
        return embedded;
      }
      catch (uniformError) {
        firstUniformError ||= uniformError.message;
        uniformError.weightedError = weightedError.message;
        throw uniformError;
      }
    }
  };

  for (const tile of rawTiles) {
    let embedded;
    let paperError = null;

    try {
      if (tile.lowDegreeBoundaryVertices.length > 0) {
        throw new Error(
            `Tile ${tile.owner} has ${tile.lowDegreeBoundaryVertices.length} `
            + "non-corner boundary vertices below degree 3."
        );
      }

      embedded = solveWithSpringRecovery(tile);
    }
    catch (error) {
      paperError = error;
      const recoveryTile = {
        ...tile,
        harmonicCorners: [...tile.boundary.vertices],
        boundaryCornerMode: "all-boundary-corners-recovery"
      };

      try {
        embedded = solveWithSpringRecovery(recoveryTile);
        embedded.paperCornerError = paperError.message;
        boundaryRecoveryCount += 1;
      }
      catch (recoveryError) {
        throw new Error(
            `Tile ${tile.owner} failed paper-corner and boundary-corner harmonic embeddings: `
            + `${paperError.message} / ${recoveryError.message}`
        );
      }
    }

    maxResidual = Math.max(
        maxResidual,
        Number.isFinite(embedded.relativeResidual) ? embedded.relativeResidual : 0
    );
    tiles.push(embedded);
  }

  const paths = [];

  for (const baseEdge of triangulation.edges) {
    const [ownerA, ownerB] = baseEdge.sites;
    const tileA = tiles[ownerA];
    const tileB = tiles[ownerB];
    const cutA = cutForNeighbor(tileA, ownerB);
    const cutB = cutForNeighbor(tileB, ownerA);

    if (!cutA || !cutB) {
      throw new Error(`Tiles ${ownerA} and ${ownerB} do not share one cut.`);
    }

    const centerA = polygonCentroid(tileA.cornerUV);
    const centerB = polygonCentroid(tileB.cornerUV);
    const exactEndpointA = surfaceCutMidpoint(mesh, tileA, cutA);
    const exactEndpointB = surfaceCutMidpoint(mesh, tileB, cutB);
    const halfA = tracePlanarSegment(
        mesh,
        tileA,
        centerA,
        exactEndpointA.uv
    );
    const halfB = tracePlanarSegment(
        mesh,
        tileB,
        centerB,
        exactEndpointB.uv
    );
    const lastSegmentA = halfA.segments[halfA.segments.length - 1];
    const lastSegmentB = halfB.segments[halfB.segments.length - 1];
    const endpointA = {
      parameter: 1,
      uv: exactEndpointA.uv,
      ...inverseMapInFace(
          mesh,
          tileA,
          lastSegmentA.face,
          exactEndpointA.uv
      )
    };
    const endpointB = {
      parameter: 1,
      uv: exactEndpointB.uv,
      ...inverseMapInFace(
          mesh,
          tileB,
          lastSegmentB.face,
          exactEndpointB.uv
      )
    };
    const endpointErrorA = Math.hypot(
        endpointA.position[0] - exactEndpointA.position[0],
        endpointA.position[1] - exactEndpointA.position[1],
        endpointA.position[2] - exactEndpointA.position[2]
    );
    const endpointErrorB = Math.hypot(
        endpointB.position[0] - exactEndpointB.position[0],
        endpointB.position[1] - exactEndpointB.position[1],
        endpointB.position[2] - exactEndpointB.position[2]
    );
    const sharedEndpointError = Math.hypot(
        endpointA.position[0] - endpointB.position[0],
        endpointA.position[1] - endpointB.position[1],
        endpointA.position[2] - endpointB.position[2]
    );

    if (endpointErrorA > 1e-6
        || endpointErrorB > 1e-6
        || sharedEndpointError > 1e-6) {
      throw new Error(
          `Harmonic halves for sites ${ownerA}:${ownerB} disagree at the cut midpoint `
          + `${JSON.stringify({
            errors: [endpointErrorA, endpointErrorB, sharedEndpointError],
            tileA: {
              tracedFace: lastSegmentA.face,
              exactFace: exactEndpointA.face,
              tracedBarycentric: endpointA.barycentric,
              exactBarycentric: exactEndpointA.barycentric,
              cut: cutA.edgeIndices
            },
            tileB: {
              tracedFace: lastSegmentB.face,
              exactFace: exactEndpointB.face,
              tracedBarycentric: endpointB.barycentric,
              exactBarycentric: exactEndpointB.barycentric,
              cut: cutB.edgeIndices
            }
          })}.`
      );
    }

    lastSegmentA.end = endpointA;
    halfA.points[halfA.points.length - 1] = endpointA;
    lastSegmentB.end = endpointB;
    halfB.points[halfB.points.length - 1] = endpointB;
    const surfacePolyline = [
      ...halfA.points.map(point => point.position),
      ...halfB.points.slice(0, -1).reverse().map(point => point.position)
    ];
    const facePath = [
      ...halfA.facePath,
      ...halfB.facePath.reverse()
    ].filter((face, index, values) => index === 0 || face !== values[index - 1]);

    paths.push({
      sites: [ownerA, ownerB],
      facePath,
      surfacePolyline,
      halfPaths: [halfA, halfB],
      construction: "harmonic"
    });
  }

  const constrained = buildConstrainedRefinement(
      mesh,
      paths,
      tiles,
      triangulation
  );
  const faceCentroidIndices = new Array(mesh._numT);

  for (let owner = 0; owner < voronoi.siteFaces.length; ++owner) {
    faceCentroidIndices[voronoi.siteFaces[owner]] =
        constrained.siteVertexIndices[owner];
  }

  const embedding = {
    subdivision: {
      vertices: constrained.vertices,
      triangles: constrained.triangles,
      parentFaces: constrained.parentFaces,
      faceCentroidIndices
    },
    paths: constrained.paths,
    barrierEdges: constrained.barrierEdges,
    refinement: constrained.refinement
  };
  constrained.patchComplex.subdivision.faceCentroidIndices =
      faceCentroidIndices;
  constrained.patchComplex.embedding = embedding;

  const initialResult = {
    tiles,
    paths,
    embedding,
    patchComplex: constrained.patchComplex,
    diagnostics: {
      tileCount: tiles.length,
      weightedSolves,
      uniformSolves,
      boundaryRecoveryCount,
      maxResidual,
      firstWeightedError,
      firstUniformError,
      flippedTriangles: tiles.reduce(
          (sum, tile) => sum + tile.flippedTriangles,
          0
      ),
      degenerateTriangles: tiles.reduce(
          (sum, tile) => sum + tile.degenerateTriangles,
          0
      )
    }
  };

  if (!straightenEdges) {
    return initialResult;
  }

  const straightened = straightenInitialDelaunay(
      mesh,
      voronoi,
      triangulation,
      embedding,
      constrained.patchComplex,
      { tolerance, maxIterations }
  );

  return {
    tiles,
    paths: straightened.paths,
    initialPaths: paths,
    embedding: straightened.embedding,
    initialEmbedding: embedding,
    patchComplex: straightened.patchComplex,
    initialPatchComplex: constrained.patchComplex,
    diagnostics: {
      ...initialResult.diagnostics,
      straightening: straightened.diagnostics
    }
  };
}
