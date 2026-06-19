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
 
import PlyIO from "/parametrization/lib/IO/PlyIO.js"

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
    if (Math.abs(this.surfaceArea() - targetArea) > 0.0001) { // Note: this will recompute the face areas
      console.log("Something is wrong! The surface area is not as expected!");
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
        // fallback to uniform if something goes wrong
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

    const triangleMap = new Map();
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

        if (!triangleMap.has(key)) {
          triangleMap.set(key, {
            sites,
            meshVertices: []
          });
        }

        triangleMap.get(key).meshVertices.push(vertex);
      }
      else if (sites.length > 3) {
        highValenceCorners.push({
          vertex,
          sites
        });
      }
    }

    this._delaunayLikeTriangulation = {
      siteFaces: [...voronoi.siteFaces],
      sitePositions,
      edges,
      triangles: Array.from(triangleMap.values()),
      highValenceCorners
    };

    return this._delaunayLikeTriangulation;
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
