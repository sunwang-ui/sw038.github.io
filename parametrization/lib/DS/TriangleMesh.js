/*!
 * Copyright (c) 2026 Sing Chun LEE @ Bucknell University. CC BY-NC 4.0.
 * 
 * This code is provided mainly for educational purposes at University of the Pacific.
 *
 * This code is licensed under the Creative Commons Attribution-NonCommercial 4.0
 * International License. To view a copy of the license, visit 
 *   https://creativecommons.org/licenses/by-nc/4.0/
 * or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
 *
 * You are free to:
 *  - Share: copy and redistribute the material in any medium or format.
 *  - Adapt: remix, transform, and build upon the material.
 *
 * Under the following terms:
 *  - Attribution: You must give appropriate credit, provide a link to the license,
 *                 and indicate if changes were made.
 *  - NonCommercial: You may not use the material for commercial purposes.
 *  - No additional restrictions: You may not apply legal terms or technological 
 *                                measures that legally restrict others from doing
 *                                anything the license permits.
 */
 
import PlyIO from "../IO/PlyIO.js"
import {
  buildPatchApproximation,
  buildPatchRemesh,
  buildPaperInitialDelaunay,
  selectHarmonicReadyFaceSites
} from "../Math/HarmonicMap.js"

const faceEdgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;

class FacePriorityQueue {
  constructor() {
    this._items = [];
  }

  get size() {
    return this._items.length;
  }

  push(item) {
    this._items.push(item);
    this.bubbleUp(this._items.length - 1);
  }

  pop() {
    if (this._items.length === 0) {
      return null;
    }

    const root = this._items[0];
    const last = this._items.pop();

    if (this._items.length > 0) {
      this._items[0] = last;
      this.sinkDown(0);
    }

    return root;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);

      if (this._items[parent].distance <= this._items[index].distance) {
        break;
      }

      [this._items[parent], this._items[index]] = [this._items[index], this._items[parent]];
      index = parent;
    }
  }

  sinkDown(index) {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;

      if (left < this._items.length && this._items[left].distance < this._items[smallest].distance) {
        smallest = left;
      }

      if (right < this._items.length && this._items[right].distance < this._items[smallest].distance) {
        smallest = right;
      }

      if (smallest === index) {
        break;
      }

      [this._items[smallest], this._items[index]] = [this._items[index], this._items[smallest]];
      index = smallest;
    }
  }
}

export default class TriangleMesh {
  constructor(filename) {
    this._filename = filename;
  }
  
  centerOfMass() {
    let C = [0.0, 0.0, 0.0];
    for (let i = 0; i < this._numV; ++i) {
      for (let j = 0; j < 3; ++j) {
        C[j] += this._vertices[i][j];
      }
    }
    for (let i = 0; i < 3; ++i) {
      C[i] /= this._numV;
    }
    return C;
  }
  
  surfaceArea() {
    // Heron’s formula
    const l = (a, b) => Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2) + Math.pow(b[2] - a[2], 2));
    const area = (e0, e1, e2, s) => Math.sqrt(s * (s - e0) * (s - e1) * (s - e2));
    let A = 0;
    this._faceArea = new Array(this._numT);
    for (let i = 0; i < this._numT; ++i) {
      const v0 = this._vertices[this._triangles[i][0]];
      const v1 = this._vertices[this._triangles[i][1]];
      const v2 = this._vertices[this._triangles[i][2]];
      const e01 = l(v0, v1);
      const e12 = l(v1, v2);
      const e20 = l(v2, v0);
      const s = (e01 + e12 + e20) / 2;
      this._faceArea[i] = area(e01, e12, e20, s);
      A += this._faceArea[i];
    }
    return A;
  }
  
  normalizeMesh() {
    // Compute the center
    this._center = this.centerOfMass();
    // center it at (0, 0, 0)
    for (let i = 0; i < this._numV; ++i) {
      for (let j = 0; j < 3; ++j) {
        this._vertices[i][j] -= this._center[j];
      }
    }
    // Compute the surface area
    this._area = this.surfaceArea();
    // normalize the surface area to a target area
    const targetArea = 1;
    this._scaleFactor = Math.sqrt(1 / this._area * targetArea);
    for (let i = 0; i < this._numV; ++i) {
      for (let j = 0; j < 3; ++j) {
        this._vertices[i][j] *= this._scaleFactor;
      }
    }
    if (Math.abs(this.surfaceArea() - targetArea) > 0.0001) {
      throw new Error("Mesh normalization failed to produce unit surface area.");
    }
  }
  
  computeNormal() {
    this._faceNormal = new Array(this._numT);
    this._normal = Array.from({length: this._numV}, (_) => new Array(3).fill(0));
    
    const normal = (p0, p1, p2) => {
      // Compute edge vectors
      let v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
      let v2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      // compute cross product
      let normal = [
        v1[1] * v2[2] - v1[2] * v2[1],
        v1[2] * v2[0] - v1[0] * v2[2],
        v1[0] * v2[1] - v1[1] * v2[0]
      ];
      // normalize the vector
      let length = Math.sqrt(normal[0]**2 + normal[1]**2 + normal[2]**2);
      normal = normal.map(n => n / length);
      return normal;
    };
    
    for (let i = 0; i < this._numT; ++i) {
      if (this._faceArea[i] > 0) {
        this._faceNormal[i] = normal(this._vertices[this._triangles[i][0]], this._vertices[this._triangles[i][1]], this._vertices[this._triangles[i][2]])
        for (let j = 0; j < 3; ++j) {
          for (let k = 0; k < 3; ++k) {
            this._normal[this._triangles[i][j]][k] += this._faceNormal[i][k] * this._faceArea[i] / 3;
          }
        }
      }
      else { // degenerated triangle
        this._faceNormal[i] = new Array(3);
      }
    }
  }
  
  appendNormalToVertices() {
    this._vProp.push('normal x', 'normal y', 'normal z');
    for (let i = 0; i < this._numV; ++i) {
      let length = Math.sqrt(this._normal[i][0]**2 + this._normal[i][1]**2 + this._normal[i][2]**2);
      this._normal[i] = this._normal[i].map(n => n / length);
      this._vertices[i].push(this._normal[i][0], this._normal[i][1], this._normal[i][2]);
    }
  }

  getVertexPosition(i) {
    return [
      this._vertices[i][0],
      this._vertices[i][1],
      this._vertices[i][2]
    ];
  }

  distanceBetweenVertices(i, j) {
    const a = this.getVertexPosition(i);
    const b = this.getVertexPosition(j);

    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  triangleAreaFromIndices(a, b, c) {
    const p0 = this.getVertexPosition(a);
    const p1 = this.getVertexPosition(b);
    const p2 = this.getVertexPosition(c);

    const v1 = [
      p1[0] - p0[0],
      p1[1] - p0[1],
      p1[2] - p0[2]
    ];

    const v2 = [
      p2[0] - p0[0],
      p2[1] - p0[1],
      p2[2] - p0[2]
    ];

    const cross = [
      v1[1] * v2[2] - v1[2] * v2[1],
      v1[2] * v2[0] - v1[0] * v2[2],
      v1[0] * v2[1] - v1[1] * v2[0]
    ];

    const crossLength = Math.sqrt(
        cross[0] * cross[0] +
        cross[1] * cross[1] +
        cross[2] * cross[2]
    );

    return 0.5 * crossLength;
  }

  buildNeighbors() {
    this._neighbors = Array.from({ length: this._numV }, () => new Set());

    // For triangle-area weighting:
    // _neighborTriangleAreas[i].get(j) stores the total area of triangles
    // that contain both vertex i and vertex j.
    this._neighborTriangleAreas = Array.from(
        { length: this._numV },
        () => new Map()
    );

    const addNeighbor = (i, j, area) => {
      this._neighbors[i].add(j);

      const oldArea = this._neighborTriangleAreas[i].get(j) ?? 0;
      this._neighborTriangleAreas[i].set(j, oldArea + area);
    };

    for (let i = 0; i < this._numT; ++i) {
      const tri = this._triangles[i];

      const a = tri[0];
      const b = tri[1];
      const c = tri[2];

      const area = this.triangleAreaFromIndices(a, b, c);

      // Triangle [a, b, c] creates edges:
      // a-b, b-c, c-a

      addNeighbor(a, b, area);
      addNeighbor(a, c, area);

      addNeighbor(b, a, area);
      addNeighbor(b, c, area);

      addNeighbor(c, a, area);
      addNeighbor(c, b, area);
    }

    this._neighbors = this._neighbors.map(s => Array.from(s));
  }

  computeUniformWeights() {
    this._uniformWeights = new Array(this._numV);

    for (let i = 0; i < this._numV; ++i) {
      const neighbors = this._neighbors[i];
      const count = neighbors.length;

      this._uniformWeights[i] = [];

      if (count === 0) {
        continue;
      }

      const w = 1.0 / count;

      for (const j of neighbors) {
        this._uniformWeights[i].push({
          index: j,
          weight: w
        });
      }
    }
  }

  computeInverseEdgeLengthWeights() {
    this._inverseEdgeLengthWeights = new Array(this._numV);

    const epsilon = 0.000001;

    for (let i = 0; i < this._numV; ++i) {
      const neighbors = this._neighbors[i];

      this._inverseEdgeLengthWeights[i] = [];

      if (neighbors.length === 0) {
        continue;
      }

      let total = 0;
      const rawWeights = [];

      for (const j of neighbors) {
        const d = Math.max(this.distanceBetweenVertices(i, j), epsilon);
        const w = 1.0 / d;

        rawWeights.push({
          index: j,
          weight: w
        });

        total += w;
      }

      for (const item of rawWeights) {
        this._inverseEdgeLengthWeights[i].push({
          index: item.index,
          weight: item.weight / total
        });
      }
    }
  }

  computeTriangleAreaWeights() {
    this._triangleAreaWeights = new Array(this._numV);

    for (let i = 0; i < this._numV; ++i) {
      const neighbors = this._neighbors[i];

      this._triangleAreaWeights[i] = [];

      if (neighbors.length === 0) {
        continue;
      }

      let totalArea = 0;
      const rawWeights = [];

      for (const j of neighbors) {
        const area = this._neighborTriangleAreas[i].get(j) ?? 0;

        rawWeights.push({
          index: j,
          weight: area
        });

        totalArea += area;
      }

      if (totalArea <= 0) {
        // Use uniform weights when all incident triangle areas are degenerate.
        const w = 1.0 / neighbors.length;

        for (const j of neighbors) {
          this._triangleAreaWeights[i].push({
            index: j,
            weight: w
          });
        }
      } else {
        for (const item of rawWeights) {
          this._triangleAreaWeights[i].push({
            index: item.index,
            weight: item.weight / totalArea
          });
        }
      }
    }
  }

  computeLaplacianFromWeights(weights) {
    const laplacian = new Array(this._numV);

    for (let i = 0; i < this._numV; ++i) {
      const v = this.getVertexPosition(i);

      const avg = [0, 0, 0];

      for (const n of weights[i]) {
        const j = n.index;
        const w = n.weight;

        const neighbor = this.getVertexPosition(j);

        avg[0] += neighbor[0] * w;
        avg[1] += neighbor[1] * w;
        avg[2] += neighbor[2] * w;
      }

      laplacian[i] = [
        v[0] - avg[0],
        v[1] - avg[1],
        v[2] - avg[2]
      ];
    }

    return laplacian;
  }

  computeAllWeightingSchemes() {
    this.buildNeighbors();

    this.computeUniformWeights();
    this.computeInverseEdgeLengthWeights();
    this.computeTriangleAreaWeights();

    this._uniformLaplacian = this.computeLaplacianFromWeights(
        this._uniformWeights
    );

    this._inverseEdgeLengthLaplacian = this.computeLaplacianFromWeights(
        this._inverseEdgeLengthWeights
    );

    this._triangleAreaLaplacian = this.computeLaplacianFromWeights(
        this._triangleAreaWeights
    );
  }

  faceCentroid(faceIndex) {
    const tri = this._triangles[faceIndex];
    const a = this.getVertexPosition(tri[0]);
    const b = this.getVertexPosition(tri[1]);
    const c = this.getVertexPosition(tri[2]);

    return [
      (a[0] + b[0] + c[0]) / 3,
      (a[1] + b[1] + c[1]) / 3,
      (a[2] + b[2] + c[2]) / 3
    ];
  }

  distanceBetweenPoints(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  midpointBetweenVertices(i, j) {
    const a = this.getVertexPosition(i);
    const b = this.getVertexPosition(j);

    return [
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2
    ];
  }

  buildFaceDualGraph() {
    const faceCentroids = new Array(this._numT);
    const faceNeighbors = Array.from({ length: this._numT }, () => []);
    const vertexFaces = Array.from({ length: this._numV }, () => []);
    const edgeFaces = new Map();

    for (let faceIndex = 0; faceIndex < this._numT; ++faceIndex) {
      const tri = this._triangles[faceIndex];
      faceCentroids[faceIndex] = this.faceCentroid(faceIndex);

      for (let i = 0; i < 3; ++i) {
        vertexFaces[tri[i]].push(faceIndex);

        const a = tri[i];
        const b = tri[(i + 1) % 3];
        const key = faceEdgeKey(a, b);

        if (!edgeFaces.has(key)) {
          edgeFaces.set(key, {
            vertices: a < b ? [a, b] : [b, a],
            faces: []
          });
        }

        edgeFaces.get(key).faces.push(faceIndex);
      }
    }

    const primalEdges = [];
    const boundaryEdges = [];
    const nonManifoldEdges = [];

    for (const edge of edgeFaces.values()) {
      primalEdges.push(edge);

      if (edge.faces.length === 1) {
        boundaryEdges.push(edge);
      }

      if (edge.faces.length > 2) {
        nonManifoldEdges.push(edge);
      }

      for (let i = 0; i < edge.faces.length; ++i) {
        for (let j = i + 1; j < edge.faces.length; ++j) {
          const a = edge.faces[i];
          const b = edge.faces[j];
          const weight = this.distanceBetweenPoints(faceCentroids[a], faceCentroids[b]);

          faceNeighbors[a].push({
            face: b,
            weight,
            edge: edge.vertices
          });

          faceNeighbors[b].push({
            face: a,
            weight,
            edge: edge.vertices
          });
        }
      }
    }

    this._faceDualGraph = {
      faceCentroids,
      faceNeighbors,
      vertexFaces,
      primalEdges,
      boundaryEdges,
      nonManifoldEdges
    };

    return this._faceDualGraph;
  }

  buildDualGraph() {
    return this.buildFaceDualGraph();
  }

  dijkstraFaceDualGraph(sourceFaces) {
    const graph = this._faceDualGraph ?? this.buildFaceDualGraph();
    const sources = Array.isArray(sourceFaces) ? sourceFaces : [sourceFaces];
    const distances = new Array(this._numT).fill(Infinity);
    const previous = new Array(this._numT).fill(-1);
    const owners = new Array(this._numT).fill(-1);
    const queue = new FacePriorityQueue();

    for (let i = 0; i < sources.length; ++i) {
      const source = sources[i];
      const face = typeof source === "number" ? source : source.face;
      const distance = typeof source === "number" ? 0 : source.distance ?? 0;
      const owner = typeof source === "number" ? i : source.owner ?? i;

      if (face < 0 || face >= this._numT) {
        throw new RangeError(`Source face ${face} is outside the mesh.`);
      }

      distances[face] = distance;
      owners[face] = owner;
      queue.push({ face, distance, owner });
    }

    while (queue.size > 0) {
      const current = queue.pop();

      if (current.distance !== distances[current.face]) {
        continue;
      }

      for (const edge of graph.faceNeighbors[current.face]) {
        const nextDistance = current.distance + edge.weight;

        if (nextDistance < distances[edge.face]) {
          distances[edge.face] = nextDistance;
          previous[edge.face] = current.face;
          owners[edge.face] = current.owner;
          queue.push({
            face: edge.face,
            distance: nextDistance,
            owner: current.owner
          });
        }
      }
    }

    return {
      distances,
      previous,
      owners
    };
  }

  selectFarthestFaceSites(siteCount, firstFace = 0) {
    const sites = [Math.max(0, Math.min(firstFace, this._numT - 1))];

    while (sites.length < siteCount) {
      const { distances } = this.dijkstraFaceDualGraph(sites);
      let farthestFace = -1;
      let farthestDistance = -Infinity;

      for (let face = 0; face < distances.length; ++face) {
        if (sites.includes(face)) {
          continue;
        }

        if (distances[face] > farthestDistance && Number.isFinite(distances[face])) {
          farthestFace = face;
          farthestDistance = distances[face];
        }
      }

      if (farthestFace < 0) {
        break;
      }

      sites.push(farthestFace);
    }

    return sites;
  }

  computeFaceVoronoi(siteFaces) {
    const result = this.dijkstraFaceDualGraph(siteFaces);
    const tiles = Array.from({ length: siteFaces.length }, () => []);

    for (let face = 0; face < result.owners.length; ++face) {
      const owner = result.owners[face];

      if (owner >= 0) {
        tiles[owner].push(face);
      }
    }

    this._faceVoronoi = {
      siteFaces: [...siteFaces],
      tiles,
      distances: result.distances,
      previous: result.previous,
      owners: result.owners
    };

    return this._faceVoronoi;
  }

  connectedFaceComponents(faces, graph = this._faceDualGraph ?? this.buildFaceDualGraph()) {
    const remaining = new Set(faces);
    const components = [];

    while (remaining.size > 0) {
      const seed = remaining.values().next().value;
      const component = [];
      const stack = [seed];
      remaining.delete(seed);

      while (stack.length > 0) {
        const face = stack.pop();
        component.push(face);

        for (const neighbor of graph.faceNeighbors[face]) {
          if (remaining.delete(neighbor.face)) {
            stack.push(neighbor.face);
          }
        }
      }

      components.push(component);
    }

    return components;
  }

  connectedEdgeComponents(edges) {
    const vertexEdges = new Map();

    for (let edgeIndex = 0; edgeIndex < edges.length; ++edgeIndex) {
      for (const vertex of edges[edgeIndex].vertices) {
        if (!vertexEdges.has(vertex)) {
          vertexEdges.set(vertex, []);
        }

        vertexEdges.get(vertex).push(edgeIndex);
      }
    }

    const remaining = new Set(edges.map((_, index) => index));
    const components = [];

    while (remaining.size > 0) {
      const seed = remaining.values().next().value;
      const component = [];
      const stack = [seed];
      remaining.delete(seed);

      while (stack.length > 0) {
        const edgeIndex = stack.pop();
        const edge = edges[edgeIndex];
        component.push(edge);

        for (const vertex of edge.vertices) {
          for (const adjacentEdge of vertexEdges.get(vertex) ?? []) {
            if (remaining.delete(adjacentEdge)) {
              stack.push(adjacentEdge);
            }
          }
        }
      }

      components.push(component);
    }

    return components;
  }

  farthestCandidateFace(faces, distances, excludedFaces = new Set()) {
    let candidate = -1;
    let candidateDistance = -Infinity;

    for (const face of faces) {
      if (excludedFaces.has(face)) {
        continue;
      }

      const distance = distances[face];

      if (!Number.isFinite(distance)) {
        return face;
      }

      if (distance > candidateDistance) {
        candidate = face;
        candidateDistance = distance;
      }
    }

    return candidate;
  }

  validateFaceVoronoiTopology(voronoi = this._faceVoronoi) {
    if (!voronoi) {
      throw new Error("Compute a face Voronoi diagram before validating its topology.");
    }

    const graph = this._faceDualGraph ?? this.buildFaceDualGraph();
    const cellViolations = [];
    const cutViolations = [];
    const vertexViolations = [];
    const violatingFaces = new Set();
    const unassignedFaces = [];

    for (let face = 0; face < voronoi.owners.length; ++face) {
      if (voronoi.owners[face] < 0) {
        unassignedFaces.push(face);
        violatingFaces.add(face);
      }
    }

    for (let owner = 0; owner < voronoi.tiles.length; ++owner) {
      const faces = voronoi.tiles[owner];
      const vertices = new Set();
      const edgeUse = new Map();

      for (const face of faces) {
        const triangle = this._triangles[face];

        for (let i = 0; i < 3; ++i) {
          const a = triangle[i];
          const b = triangle[(i + 1) % 3];
          const key = faceEdgeKey(a, b);
          vertices.add(a);
          edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
        }
      }

      const boundaryEdges = [];

      for (const edge of graph.primalEdges) {
        if (edgeUse.get(faceEdgeKey(edge.vertices[0], edge.vertices[1])) === 1) {
          boundaryEdges.push(edge);
        }
      }

      const boundaryDegrees = new Map();

      for (const edge of boundaryEdges) {
        for (const vertex of edge.vertices) {
          boundaryDegrees.set(vertex, (boundaryDegrees.get(vertex) ?? 0) + 1);
        }
      }

      const faceComponents = this.connectedFaceComponents(faces, graph);
      const boundaryComponents = this.connectedEdgeComponents(boundaryEdges);
      const eulerCharacteristic = vertices.size - edgeUse.size + faces.length;
      const hasClosedBoundary = boundaryEdges.length > 0
          && Array.from(boundaryDegrees.values()).every(degree => degree === 2);
      const isDisk = faceComponents.length === 1
          && boundaryComponents.length === 1
          && hasClosedBoundary
          && eulerCharacteristic === 1;

      if (!isDisk) {
        const candidateFace = this.farthestCandidateFace(
            faces,
            voronoi.distances,
            new Set(voronoi.siteFaces)
        );

        if (candidateFace >= 0) {
          violatingFaces.add(candidateFace);
        }

        cellViolations.push({
          owner,
          faceCount: faces.length,
          faceComponents: faceComponents.length,
          boundaryComponents: boundaryComponents.length,
          eulerCharacteristic,
          hasClosedBoundary,
          candidateFace
        });
      }
    }

    const cuts = new Map();

    for (const edge of graph.primalEdges) {
      const owners = Array.from(new Set(
          edge.faces
              .map(face => voronoi.owners[face])
              .filter(owner => owner >= 0)
      )).sort((a, b) => a - b);

      for (let i = 0; i < owners.length; ++i) {
        for (let j = i + 1; j < owners.length; ++j) {
          const key = `${owners[i]}:${owners[j]}`;

          if (!cuts.has(key)) {
            cuts.set(key, {
              owners: [owners[i], owners[j]],
              edges: []
            });
          }

          cuts.get(key).edges.push(edge);
        }
      }
    }

    for (const cut of cuts.values()) {
      const components = this.connectedEdgeComponents(cut.edges);
      const componentTopology = components.map(component => {
        const degrees = new Map();

        for (const edge of component) {
          for (const vertex of edge.vertices) {
            degrees.set(vertex, (degrees.get(vertex) ?? 0) + 1);
          }
        }

        return {
          endpoints: Array.from(degrees.values()).filter(degree => degree === 1).length,
          hasBranches: Array.from(degrees.values()).some(degree => degree > 2)
        };
      });
      const isSinglePath = components.length === 1
          && componentTopology[0].endpoints === 2
          && !componentTopology[0].hasBranches;

      if (isSinglePath) {
        continue;
      }

      const candidateFaces = components
          .flatMap(component => component.flatMap(edge => edge.faces))
          .filter(face => cut.owners.includes(voronoi.owners[face]));
      const candidateFace = this.farthestCandidateFace(
          candidateFaces,
          voronoi.distances,
          new Set(voronoi.siteFaces)
      );

      if (candidateFace >= 0) {
        violatingFaces.add(candidateFace);
      }

      cutViolations.push({
        owners: cut.owners,
        components: components.length,
        componentTopology,
        candidateFace
      });
    }

    for (let vertex = 0; vertex < graph.vertexFaces.length; ++vertex) {
      const faces = graph.vertexFaces[vertex];
      const owners = Array.from(new Set(
          faces
              .map(face => voronoi.owners[face])
              .filter(owner => owner >= 0)
      )).sort((a, b) => a - b);

      if (owners.length <= 3) {
        continue;
      }

      const candidateFace = this.farthestCandidateFace(
          faces,
          voronoi.distances,
          new Set(voronoi.siteFaces)
      );

      if (candidateFace >= 0) {
        violatingFaces.add(candidateFace);
      }

      vertexViolations.push({
        vertex,
        owners,
        candidateFace
      });
    }

    return {
      isValid: unassignedFaces.length === 0
          && cellViolations.length === 0
          && cutViolations.length === 0
          && vertexViolations.length === 0,
      unassignedFaces,
      cellViolations,
      cutViolations,
      vertexViolations,
      violatingFaces: Array.from(violatingFaces)
    };
  }

  selectTopologyValidFaceSites({
    initialSiteCount = 1,
    firstFace = 0,
    maxSites = this._numT
  } = {}) {
    const siteFaces = this.selectFarthestFaceSites(initialSiteCount, firstFace);
    const siteSet = new Set(siteFaces);
    let voronoi = this.computeFaceVoronoi(siteFaces);
    let validation = this.validateFaceVoronoiTopology(voronoi);
    let refinementSteps = 0;

    while (!validation.isValid && siteFaces.length < Math.min(maxSites, this._numT)) {
      let nextSite = this.farthestCandidateFace(
          validation.violatingFaces,
          voronoi.distances,
          siteSet
      );

      if (nextSite < 0) {
        nextSite = this.farthestCandidateFace(
            Array.from({ length: this._numT }, (_, face) => face),
            voronoi.distances,
            siteSet
        );
      }

      if (nextSite < 0) {
        break;
      }

      siteFaces.push(nextSite);
      siteSet.add(nextSite);
      voronoi = this.computeFaceVoronoi(siteFaces);
      validation = this.validateFaceVoronoiTopology(voronoi);
      refinementSteps += 1;
    }

    return {
      siteFaces,
      voronoi,
      validation,
      refinementSteps,
      reachedSiteLimit: !validation.isValid
    };
  }

  selectHarmonicReadyFaceSites(options = {}) {
    return selectHarmonicReadyFaceSites(this, options);
  }

  buildDelaunayLikeTriangulation(voronoi = this._faceVoronoi) {
    if (!voronoi) {
      throw new Error("Build a face Voronoi diagram before constructing the Delaunay-like triangulation.");
    }

    const graph = this._faceDualGraph ?? this.buildFaceDualGraph();
    const sitePositions = voronoi.siteFaces.map(face => this.faceCentroid(face));
    const cutMap = new Map();

    for (const edge of graph.primalEdges) {
      for (let i = 0; i < edge.faces.length; ++i) {
        for (let j = i + 1; j < edge.faces.length; ++j) {
          const faceA = edge.faces[i];
          const faceB = edge.faces[j];
          const siteA = voronoi.owners[faceA];
          const siteB = voronoi.owners[faceB];

          if (siteA < 0 || siteB < 0 || siteA === siteB) {
            continue;
          }

          const lo = Math.min(siteA, siteB);
          const hi = Math.max(siteA, siteB);
          const key = `${lo}:${hi}`;

          if (!cutMap.has(key)) {
            cutMap.set(key, {
              sites: [lo, hi],
              meshEdges: [],
              facePairs: [],
              midpointSum: [0, 0, 0],
              midpointCount: 0
            });
          }

          const cut = cutMap.get(key);
          const midpoint = this.midpointBetweenVertices(edge.vertices[0], edge.vertices[1]);

          cut.meshEdges.push(edge.vertices);
          cut.facePairs.push([faceA, faceB]);
          cut.midpointSum[0] += midpoint[0];
          cut.midpointSum[1] += midpoint[1];
          cut.midpointSum[2] += midpoint[2];
          cut.midpointCount += 1;
        }
      }
    }

    const edges = Array.from(cutMap.values()).map(cut => {
      const midpoint = [
        cut.midpointSum[0] / cut.midpointCount,
        cut.midpointSum[1] / cut.midpointCount,
        cut.midpointSum[2] / cut.midpointCount
      ];

      return {
        sites: cut.sites,
        meshEdges: cut.meshEdges,
        facePairs: cut.facePairs,
        midpoint,
        polyline: [
          sitePositions[cut.sites[0]],
          midpoint,
          sitePositions[cut.sites[1]]
        ]
      };
    });

    const junctionMap = new Map();
    const highValenceCorners = [];

    for (let vertex = 0; vertex < graph.vertexFaces.length; ++vertex) {
      const siteSet = new Set();

      for (const face of graph.vertexFaces[vertex]) {
        const owner = voronoi.owners[face];

        if (owner >= 0) {
          siteSet.add(owner);
        }
      }

      const sites = Array.from(siteSet).sort((a, b) => a - b);

      if (sites.length === 3) {
        const key = sites.join(":");

        if (!junctionMap.has(key)) {
          junctionMap.set(key, {
            sites,
            meshVertices: new Set()
          });
        }

        junctionMap.get(key).meshVertices.add(vertex);
      }
      else if (sites.length > 3) {
        highValenceCorners.push({
          vertex,
          sites
        });
      }
    }

    const triangles = [];

    for (const junction of junctionMap.values()) {
      const remaining = new Set(junction.meshVertices);

      while (remaining.size > 0) {
        const seed = remaining.values().next().value;
        const meshVertices = [];
        const stack = [seed];
        remaining.delete(seed);

        while (stack.length > 0) {
          const vertex = stack.pop();
          meshVertices.push(vertex);

          for (const edge of graph.primalEdges) {
            let adjacentVertex = -1;

            if (edge.vertices[0] === vertex) {
              adjacentVertex = edge.vertices[1];
            }
            else if (edge.vertices[1] === vertex) {
              adjacentVertex = edge.vertices[0];
            }

            if (adjacentVertex >= 0 && remaining.delete(adjacentVertex)) {
              stack.push(adjacentVertex);
            }
          }
        }

        triangles.push({
          sites: junction.sites,
          meshVertices
        });
      }
    }

    this._delaunayLikeTriangulation = {
      siteFaces: [...voronoi.siteFaces],
      sitePositions,
      edges,
      triangles,
      highValenceCorners
    };

    return this._delaunayLikeTriangulation;
  }

  validateDelaunayLikeTriangulation(
      triangulation = this._delaunayLikeTriangulation
  ) {
    if (!triangulation) {
      throw new Error("Construct the Delaunay-like triangulation before validating it.");
    }

    const graph = this._faceDualGraph ?? this.buildFaceDualGraph();
    const edgeFaceCounts = new Map();

    for (const triangle of triangulation.triangles) {
      for (let i = 0; i < 3; ++i) {
        const a = triangle.sites[i];
        const b = triangle.sites[(i + 1) % 3];
        const key = faceEdgeKey(a, b);
        edgeFaceCounts.set(key, (edgeFaceCounts.get(key) ?? 0) + 1);
      }
    }

    const edgeIncidenceViolations = [];

    for (const edge of triangulation.edges) {
      const key = faceEdgeKey(edge.sites[0], edge.sites[1]);
      const faceCount = edgeFaceCounts.get(key) ?? 0;
      const expectedFaceCount = graph.boundaryEdges.length === 0 ? 2 : null;

      if (faceCount === 0 || (expectedFaceCount !== null && faceCount !== expectedFaceCount)) {
        edgeIncidenceViolations.push({
          sites: edge.sites,
          faceCount,
          expectedFaceCount
        });
      }
    }

    const sourceEulerCharacteristic = this._numV
        - graph.primalEdges.length
        + this._numT;
    const baseEulerCharacteristic = triangulation.siteFaces.length
        - triangulation.edges.length
        + triangulation.triangles.length;

    return {
      isValid: triangulation.highValenceCorners.length === 0
          && edgeIncidenceViolations.length === 0
          && baseEulerCharacteristic === sourceEulerCharacteristic,
      sourceEulerCharacteristic,
      baseEulerCharacteristic,
      edgeIncidenceViolations,
      highValenceCorners: triangulation.highValenceCorners
    };
  }

  buildPaperInitialDelaunay(
      voronoi = this._faceVoronoi,
      triangulation = this._delaunayLikeTriangulation,
      options = {}
  ) {
    return buildPaperInitialDelaunay(this, voronoi, triangulation, options);
  }

  buildPatchRemesh(
      triangulation,
      paperTriangulation,
      options = {}
  ) {
    return buildPatchRemesh(this, triangulation, paperTriangulation, options);
  }

  buildPatchApproximation(
      triangulation,
      paperTriangulation,
      options = {}
  ) {
    return buildPatchApproximation(
        this,
        triangulation,
        paperTriangulation,
        options
    );
  }

  validateEmbeddedDelaunayPaths(
      voronoi,
      triangulation,
      embedding
  ) {
    const errors = [];
    const subdivisionEdges = new Set();
    const requireVoronoiCutCrossing =
        embedding.refinement?.mode !== "harmonic-straightened-refinement";

    for (const triangle of embedding.subdivision.triangles) {
      for (let i = 0; i < 3; ++i) {
        subdivisionEdges.add(
            faceEdgeKey(triangle[i], triangle[(i + 1) % 3])
        );
      }
    }

    if (embedding.paths.length !== triangulation.edges.length) {
      errors.push({
        type: "path-count",
        expected: triangulation.edges.length,
        actual: embedding.paths.length
      });
    }

    for (const path of embedding.paths) {
      if (requireVoronoiCutCrossing) {
        const ownerSequence = path.facePath.map(face => voronoi.owners[face]);
        let ownerTransitions = 0;

        for (let i = 1; i < ownerSequence.length; ++i) {
          if (ownerSequence[i] !== ownerSequence[i - 1]) {
            ownerTransitions += 1;
          }
        }

        if (ownerTransitions !== 1
            || ownerSequence[0] !== path.sites[0]
            || ownerSequence[ownerSequence.length - 1] !== path.sites[1]) {
          errors.push({
            type: "voronoi-cut-crossing",
            sites: path.sites,
            ownerTransitions,
            ownerSequence
          });
        }
      }

      if (new Set(path.vertexPath).size !== path.vertexPath.length) {
        errors.push({
          type: "self-intersection",
          sites: path.sites
        });
      }

      for (let i = 0; i < path.vertexPath.length - 1; ++i) {
        const edge = faceEdgeKey(path.vertexPath[i], path.vertexPath[i + 1]);

        if (!subdivisionEdges.has(edge)) {
          errors.push({
            type: "off-mesh-segment",
            sites: path.sites,
            edge: [path.vertexPath[i], path.vertexPath[i + 1]]
          });
        }
      }

      const startSiteVertex = embedding.subdivision.faceCentroidIndices[
        voronoi.siteFaces[path.sites[0]]
      ];
      const endSiteVertex = embedding.subdivision.faceCentroidIndices[
        voronoi.siteFaces[path.sites[1]]
      ];

      if (path.vertexPath[0] !== startSiteVertex
          || path.vertexPath[path.vertexPath.length - 1] !== endSiteVertex) {
        errors.push({
          type: "path-endpoints",
          sites: path.sites,
          expected: [startSiteVertex, endSiteVertex],
          actual: [
            path.vertexPath[0],
            path.vertexPath[path.vertexPath.length - 1]
          ]
        });
      }
    }

    for (let i = 0; i < embedding.paths.length; ++i) {
      const pathA = embedding.paths[i];
      const verticesA = new Set(pathA.vertexPath);

      for (let j = i + 1; j < embedding.paths.length; ++j) {
        const pathB = embedding.paths[j];
        const sharedSites = pathA.sites.filter(site => pathB.sites.includes(site));
        const allowedVertices = new Set(sharedSites.map(
            site => embedding.subdivision.faceCentroidIndices[
              voronoi.siteFaces[site]
            ]
        ));
        const intersections = pathB.vertexPath.filter(
            vertex => verticesA.has(vertex) && !allowedVertices.has(vertex)
        );

        if (intersections.length > 0) {
          errors.push({
            type: "path-intersection",
            paths: [pathA.sites, pathB.sites],
            vertices: Array.from(new Set(intersections))
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  orderBoundaryCycle(boundaryEdges) {
    const neighbors = new Map();

    for (const [a, b] of boundaryEdges) {
      if (!neighbors.has(a)) {
        neighbors.set(a, []);
      }

      if (!neighbors.has(b)) {
        neighbors.set(b, []);
      }

      neighbors.get(a).push(b);
      neighbors.get(b).push(a);
    }

    if (neighbors.size === 0
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

  validateBaseFacePatches(
      patchComplex,
      triangulation = this._delaunayLikeTriangulation
  ) {
    const errors = [];
    const boundaryUse = new Map();

    for (const patch of patchComplex.patches) {
      const edgeSet = new Set();

      for (const triangle of patch.triangles) {
        const vertices = patchComplex.subdivision.triangles[triangle];

        for (let i = 0; i < 3; ++i) {
          edgeSet.add(faceEdgeKey(vertices[i], vertices[(i + 1) % 3]));
        }
      }

      const eulerCharacteristic = patch.vertices.length
          - edgeSet.size
          + patch.triangles.length;

      if (eulerCharacteristic !== 1 || patch.boundaryCycle.length < 3) {
        errors.push({
          baseFace: patch.baseFace,
          eulerCharacteristic,
          boundaryLength: patch.boundaryCycle.length
        });
      }

      for (const edge of patch.boundaryEdges) {
        const key = faceEdgeKey(edge[0], edge[1]);
        boundaryUse.set(key, (boundaryUse.get(key) ?? 0) + 1);
      }
    }

    for (const path of patchComplex.embedding.paths) {
      for (let i = 0; i < path.vertexPath.length - 1; ++i) {
        const key = faceEdgeKey(path.vertexPath[i], path.vertexPath[i + 1]);

        if (boundaryUse.get(key) !== 2) {
          errors.push({
            sites: path.sites,
            edge: [path.vertexPath[i], path.vertexPath[i + 1]],
            boundaryUse: boundaryUse.get(key) ?? 0
          });
        }
      }
    }

    return {
      isValid: errors.length === 0
          && patchComplex.patches.length === triangulation.triangles.length,
      errors
    };
  }

  summarizeFaceDualGraph(distances = null) {
    const graph = this._faceDualGraph ?? this.buildFaceDualGraph();
    let reachableFaceCount = null;
    let maxDistance = null;

    if (distances) {
      reachableFaceCount = 0;
      maxDistance = 0;

      for (const distance of distances) {
        if (Number.isFinite(distance)) {
          reachableFaceCount += 1;
          maxDistance = Math.max(maxDistance, distance);
        }
      }
    }

    return {
      vertices: this._numV,
      faces: this._numT,
      dualNodes: this._numT,
      dualEdges: graph.faceNeighbors.reduce((total, neighbors) => total + neighbors.length, 0) / 2,
      boundaryEdges: graph.boundaryEdges.length,
      nonManifoldEdges: graph.nonManifoldEdges.length,
      reachableFaceCount,
      maxDistance
    };
  }
  
  async init() {
    // Read vertices from ply files
    let [vertices, triangles, vProp] = await PlyIO.read(this._filename);
    this._numV = vertices.length;
    this._numT = triangles.length;
    this._vProp = vProp;
    this._vertices = vertices;
    this._triangles = triangles;
    // normalize the mesh
    // normalize the mesh
    this.normalizeMesh();

// Build neighbor lists, weights, and Laplacians.
// This must happen after normalization because it uses vertex positions.
    this.computeAllWeightingSchemes();

// compute mesh normal per face
    if (this._vProp.length == 3) { // contain vertices only
      this.computeNormal();
      this.appendNormalToVertices();
      
    }
  }
}
