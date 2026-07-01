/*
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

import SceneObject from "./SceneObject.js"
import TriangleMesh from "../DS/TriangleMesh.js"

export default class RayTracingTriangleMeshObject extends SceneObject {
  constructor(device, canvasFormat, filename, camera, shaderFile) {
    super(device, canvasFormat, shaderFile);
    this._mesh = new TriangleMesh(filename);
    this._camera = camera;
    this._overlayMode = 0;
    this._meshLineThickness = 0.018;
    this._voronoiLineThickness = 0.028;
    this._delaunayLineThickness = 0.035;
  }
  
  async createGeometry() {
    await this._mesh.init();
    this._numV = this._mesh._numV;
    this._numT = this._mesh._numT;
    this._vProp = this._mesh._vProp;
    this._vertices = this._mesh._vertices.flat();
    this._triangles = this._mesh._triangles.flat();
    this._voronoiBoundaryFlags = new Uint32Array(this._numT);
    this._delaunayPathFlags = new Uint32Array(this._numT);
    this._delaunaySegmentOffsets = new Uint32Array(this._numT + 1);
    this._delaunayPathSegments = new Float32Array(4);
    // Create vertex buffer to store the vertices in GPU
    this._vertexBuffer = this._device.createBuffer({
      label: "Vertices Normals and More",
      size: this._vertices.length * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    // Copy from CPU to GPU
    new Float32Array(this._vertexBuffer.getMappedRange()).set(this._vertices);
    this._vertexBuffer.unmap();
    this._surfaceVertexBuffer = this._vertexBuffer;
    //this._device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices);
    // Define vertex buffer layout - how the GPU should read the buffer
    this._vertexBufferLayout = {
      arrayStride: this._vProp.length * Float32Array.BYTES_PER_ELEMENT,
      attributes: [
      { // vertices
        format: "float32x3", // 32 bits, each has three coordiantes
        offset: 0,
        shaderLocation: 0, // position in the vertex shader
      },
      { // normals
        format: "float32x3", // 32 bits, each has three coordiantes
        offset: 3 * Float32Array.BYTES_PER_ELEMENT,
        shaderLocation: 1, // position in the vertex shader
      }
      ],
    };
    // Create index buffer to store the triangle indices in GPU
    this._indexBuffer = this._device.createBuffer({
      label: "Indices",
      size: this._triangles.length * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    }); 
    // Copy from CPU to GPU
    new Uint32Array(this._indexBuffer.getMappedRange()).set(this._triangles);
    this._indexBuffer.unmap();
    this._surfaceIndexBuffer = this._indexBuffer;
    //this._device.queue.writeBuffer(this.indexBuffer, 0, this.triangles);
    
    // Create camera buffer to store the camera pose and scale in GPU
    this._cameraBuffer = this._device.createBuffer({
      label: "Camera " + this.getName(),
      size: this._camera._pose.byteLength + this._camera._focal.byteLength + this._camera._resolutions.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }); 
    // Copy from CPU to GPU - both pose and scales
    this._device.queue.writeBuffer(this._cameraBuffer, 0, this._camera._pose);
    this._device.queue.writeBuffer(this._cameraBuffer, this._camera._pose.byteLength, this._camera._focal);
    this._device.queue.writeBuffer(this._cameraBuffer, this._camera._pose.byteLength + this._camera._focal.byteLength, this._camera._resolutions);

    this._overlayBuffer = this._device.createBuffer({
      label: "Mesh Overlay Controls " + this.getName(),
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this._voronoiBoundaryBuffer = this._device.createBuffer({
      label: "Voronoi Boundary Edge Flags " + this.getName(),
      size: Math.max(1, this._voronoiBoundaryFlags.length) * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Uint32Array(this._voronoiBoundaryBuffer.getMappedRange()).set(this._voronoiBoundaryFlags);
    this._voronoiBoundaryBuffer.unmap();
    this._delaunayPathBuffer = this._device.createBuffer({
      label: "Delaunay Path Flags " + this.getName(),
      size: Math.max(1, this._delaunayPathFlags.length) * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Uint32Array(this._delaunayPathBuffer.getMappedRange()).set(this._delaunayPathFlags);
    this._delaunayPathBuffer.unmap();
    this._delaunaySegmentOffsetBuffer = this._device.createBuffer({
      label: "Delaunay Segment Offsets " + this.getName(),
      size: Math.max(1, this._delaunaySegmentOffsets.length) * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Uint32Array(this._delaunaySegmentOffsetBuffer.getMappedRange()).set(
        this._delaunaySegmentOffsets
    );
    this._delaunaySegmentOffsetBuffer.unmap();
    this._delaunaySegmentBuffer = this._device.createBuffer({
      label: "Delaunay Path Segments " + this.getName(),
      size: Math.max(4, this._delaunayPathSegments.length)
          * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this._delaunaySegmentBuffer.getMappedRange()).set(
        this._delaunayPathSegments
    );
    this._delaunaySegmentBuffer.unmap();
    this.writeOverlayBuffer();
  }

  writeOverlayBuffer() {
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);
    view.setUint32(0, this._overlayMode, true);
    view.setFloat32(4, this._meshLineThickness, true);
    view.setFloat32(8, this._voronoiLineThickness, true);
    view.setFloat32(12, this._delaunayLineThickness, true);
    this._device.queue.writeBuffer(this._overlayBuffer, 0, buffer);
  }

  setOverlayMode(mode) {
    const modes = {
      none: 0,
      original: 1,
      voronoi: 2,
      delaunay: 3,
      straightened: 4,
      base: 5,
      remesh: 6,
      approximation: 7
    };
    this._overlayMode = typeof mode === "number" ? mode : modes[mode] ?? 0;

    if (this._overlayBuffer) {
      this.writeOverlayBuffer();
    }
  }

  sameUndirectedEdge(edge, a, b) {
    return (edge[0] === a && edge[1] === b) || (edge[0] === b && edge[1] === a);
  }

  markVoronoiBoundaryEdge(faceIndex, edge) {
    const tri = this._mesh._triangles[faceIndex];

    if (this.sameUndirectedEdge(edge, tri[1], tri[2])) {
      this._voronoiBoundaryFlags[faceIndex] |= 1;
    }
    else if (this.sameUndirectedEdge(edge, tri[2], tri[0])) {
      this._voronoiBoundaryFlags[faceIndex] |= 2;
    }
    else if (this.sameUndirectedEdge(edge, tri[0], tri[1])) {
      this._voronoiBoundaryFlags[faceIndex] |= 4;
    }
  }

  markDelaunayPathEdge(faceIndex, edge) {
    const tri = this._mesh._triangles[faceIndex];

    if (this.sameUndirectedEdge(edge, tri[1], tri[2])) {
      this._delaunayPathFlags[faceIndex] |= 1;
    }
    else if (this.sameUndirectedEdge(edge, tri[2], tri[0])) {
      this._delaunayPathFlags[faceIndex] |= 2;
    }
    else if (this.sameUndirectedEdge(edge, tri[0], tri[1])) {
      this._delaunayPathFlags[faceIndex] |= 4;
    }
  }

  createGeometryBuffers(vertices, triangles, label) {
    const vertexBuffer = this._device.createBuffer({
      label: `${label} Vertices`,
      size: vertices.length * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
    vertexBuffer.unmap();
    const indexBuffer = this._device.createBuffer({
      label: `${label} Indices`,
      size: triangles.length * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Uint32Array(indexBuffer.getMappedRange()).set(triangles);
    indexBuffer.unmap();
    return { vertexBuffer, indexBuffer };
  }

  buildVertexPayload(positions, triangles) {
    const normals = Array.from(
        { length: positions.length },
        () => [0, 0, 0]
    );
    const center = positions.reduce((sum, position) => {
      sum[0] += position[0] / positions.length;
      sum[1] += position[1] / positions.length;
      sum[2] += position[2] / positions.length;
      return sum;
    }, [0, 0, 0]);
    const orientedTriangles = triangles.map(triangle => [...triangle]);

    for (const triangle of orientedTriangles) {
      const a = positions[triangle[0]];
      const b = positions[triangle[1]];
      const c = positions[triangle[2]];
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const normal = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0]
      ];
      const faceCenter = [
        (a[0] + b[0] + c[0]) / 3,
        (a[1] + b[1] + c[1]) / 3,
        (a[2] + b[2] + c[2]) / 3
      ];
      const outward = [
        faceCenter[0] - center[0],
        faceCenter[1] - center[1],
        faceCenter[2] - center[2]
      ];

      if (normal[0] * outward[0]
          + normal[1] * outward[1]
          + normal[2] * outward[2] < 0) {
        [triangle[1], triangle[2]] = [triangle[2], triangle[1]];
        normal[0] *= -1;
        normal[1] *= -1;
        normal[2] *= -1;
      }

      for (const vertex of triangle) {
        normals[vertex][0] += normal[0];
        normals[vertex][1] += normal[1];
        normals[vertex][2] += normal[2];
      }
    }

    const payload = [];

    for (let vertex = 0; vertex < positions.length; ++vertex) {
      const normal = normals[vertex];
      const length = Math.hypot(normal[0], normal[1], normal[2]) || 1;
      payload.push(
          positions[vertex][0],
          positions[vertex][1],
          positions[vertex][2],
          normal[0] / length,
          normal[1] / length,
          normal[2] / length
      );
    }

    return {
      vertices: payload,
      triangles: orientedTriangles.flat()
    };
  }

  setDerivedGeometry(slot, label, { vertices, triangles }) {
    if (!vertices?.length || !triangles?.length) {
      return;
    }

    const payload = this.buildVertexPayload(vertices, triangles);
    this[slot] = {
      vertexCount: vertices.length,
      triangleCount: triangles.length,
      ...payload,
      ...this.createGeometryBuffers(
          payload.vertices,
          payload.triangles,
          label
      )
    };
  }

  setBaseMeshGeometry(geometry) {
    this.setDerivedGeometry("_baseGeometry", "Base Mesh", geometry);
  }

  setRemeshGeometry(geometry) {
    this.setDerivedGeometry("_remeshGeometry", "Remesh", geometry);
  }

  setApproximationGeometry(geometry) {
    this.setDerivedGeometry("_approximationGeometry", "Approximation", geometry);
  }

  useGeometryBuffers(vertexBuffer, indexBuffer) {
    if (!vertexBuffer || !indexBuffer
        || (this._vertexBuffer === vertexBuffer
            && this._indexBuffer === indexBuffer)) {
      return false;
    }

    this._vertexBuffer = vertexBuffer;
    this._indexBuffer = indexBuffer;

    if (this._bindGroup && this._outTexture) {
      this.createBindGroup(this._outTexture);
    }

    return true;
  }

  useSurfaceGeometry() {
    this.useGeometryBuffers(this._surfaceVertexBuffer, this._surfaceIndexBuffer);
  }

  useDerivedGeometry(slot) {
    const geometry = this[slot];

    if (!geometry) {
      return;
    }

    this.useGeometryBuffers(geometry.vertexBuffer, geometry.indexBuffer);
  }

  useBaseMeshGeometry() {
    this.useDerivedGeometry("_baseGeometry");
  }

  useRemeshGeometry() {
    this.useDerivedGeometry("_remeshGeometry");
  }

  useApproximationGeometry() {
    this.useDerivedGeometry("_approximationGeometry");
  }

  rebuildDelaunaySegmentBuffers(paths) {
    const segmentsByFace = Array.from({ length: this._numT }, () => []);
    const addSegment = (face, start, end) => {
      if (face < 0 || face >= this._numT || !start || !end) {
        return;
      }

      const startUV = [start[1], start[2]];
      const endUV = [end[1], end[2]];

      if (!startUV.every(Number.isFinite) || !endUV.every(Number.isFinite)) {
        return;
      }

      if (Math.hypot(startUV[0] - endUV[0], startUV[1] - endUV[1]) < 1e-8) {
        return;
      }

      segmentsByFace[face].push([
        startUV[0],
        startUV[1],
        endUV[0],
        endUV[1]
      ]);
    };

    for (const path of paths) {
      if (path.displaySegments) {
        for (const segment of path.displaySegments) {
          addSegment(
              segment.face,
              segment.start.barycentric,
              segment.end.barycentric
          );
        }
        continue;
      }

      if (path.halfPaths) {
        for (const half of path.halfPaths) {
          for (const segment of half.segments) {
            addSegment(
                segment.face,
                segment.start.barycentric,
                segment.end.barycentric
            );
          }
        }
        continue;
      }

      if (path.segments) {
        for (const segment of path.segments) {
          addSegment(
              segment.face,
              segment.start.barycentric,
              segment.end.barycentric
          );
        }
      }
    }

    const offsets = new Uint32Array(this._numT + 1);
    const values = [];

    for (let face = 0; face < this._numT; ++face) {
      offsets[face] = values.length / 4;

      for (const segment of segmentsByFace[face]) {
        values.push(...segment);
      }
    }

    offsets[this._numT] = values.length / 4;
    this._delaunaySegmentOffsets = offsets;
    this._delaunayPathSegments = new Float32Array(values.length > 0 ? values : [0, 0, 0, 0]);
    this._delaunaySegmentOffsetBuffer?.destroy();
    this._delaunaySegmentBuffer?.destroy();
    this._delaunaySegmentOffsetBuffer = this._device.createBuffer({
      label: "Delaunay Segment Offsets " + this.getName(),
      size: Math.max(1, offsets.length) * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Uint32Array(this._delaunaySegmentOffsetBuffer.getMappedRange()).set(
        offsets
    );
    this._delaunaySegmentOffsetBuffer.unmap();
    this._delaunaySegmentBuffer = this._device.createBuffer({
      label: "Delaunay Path Segments " + this.getName(),
      size: this._delaunayPathSegments.length * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this._delaunaySegmentBuffer.getMappedRange()).set(
        this._delaunayPathSegments
    );
    this._delaunaySegmentBuffer.unmap();

    if (this._bindGroup && this._outTexture) {
      this.createBindGroup(this._outTexture);
    }
  }

  setVoronoiOverlay(voronoi, dualGraph = null) {
    if (!voronoi) {
      return;
    }

    const graph = dualGraph ?? this._mesh._faceDualGraph ?? this._mesh.buildFaceDualGraph();
    this._voronoiBoundaryFlags.fill(0);

    for (const edge of graph.primalEdges) {
      let owner = -1;
      let isBoundary = false;

      for (const face of edge.faces) {
        const faceOwner = voronoi.owners[face];

        if (faceOwner < 0) {
          continue;
        }

        if (owner < 0) {
          owner = faceOwner;
        }
        else if (owner !== faceOwner) {
          isBoundary = true;
          break;
        }
      }

      if (!isBoundary) {
        continue;
      }

      for (const face of edge.faces) {
        this.markVoronoiBoundaryEdge(face, edge.vertices);
      }
    }

    if (this._voronoiBoundaryBuffer) {
      this._device.queue.writeBuffer(this._voronoiBoundaryBuffer, 0, this._voronoiBoundaryFlags);
    }
  }

  setDelaunayOverlay(voronoi, embedding, dualGraph = null) {
    if (!voronoi || !embedding) {
      return;
    }

    const graph = dualGraph ?? this._mesh._faceDualGraph ?? this._mesh.buildFaceDualGraph();
    this._delaunayPathFlags.fill(0);

    for (const siteFace of voronoi.siteFaces) {
      this._delaunayPathFlags[siteFace] |= 8;
    }

    this.rebuildDelaunaySegmentBuffers(embedding.paths);

    for (const path of embedding.paths) {
      for (let i = 0; i < path.facePath.length - 1; ++i) {
        const face = path.facePath[i];
        const nextFace = path.facePath[i + 1];
        const neighbor = graph.faceNeighbors[face].find(
            item => item.face === nextFace
        );

        if (!neighbor) {
          continue;
        }

        this.markDelaunayPathEdge(face, neighbor.edge);
        this.markDelaunayPathEdge(nextFace, neighbor.edge);
      }
    }

    if (this._delaunayPathBuffer) {
      this._device.queue.writeBuffer(
          this._delaunayPathBuffer,
          0,
          this._delaunayPathFlags
      );
    }
  }
  
  updateGeometry() {
    // update the image size of the camera
    this._camera.updateSize(this._imgWidth, this._imgHeight);
    this._device.queue.writeBuffer(this._cameraBuffer, this._camera._pose.byteLength + this._camera._focal.byteLength, this._camera._resolutions);
  }
  
  updateCameraPose() {
    this._device.queue.writeBuffer(this._cameraBuffer, 0, this._camera._pose);
  }
  
  updateCameraFocal() {
    this._device.queue.writeBuffer(this._cameraBuffer, this._camera._pose.byteLength, this._camera._focal);
  }
  
  async createShaders() {
    await super.createShaders();
    
    // Create the bind group layout
    this._bindGroupLayout = this._device.createBindGroupLayout({
      label: "Ray Trace Mesh Layout " + this.getName(),
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {} // Camera uniform buffer
      }, {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage"} // input vertices
      }, {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage"} // input triangle indices
      }, {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { format: this._canvasFormat } // texture
      }, {
        binding: 4,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {} // overlay controls
      }, {
        binding: 5,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage"} // Voronoi boundary flags
      }, {
        binding: 6,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage"} // Delaunay path flags
      }, {
        binding: 7,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage"} // Delaunay segment offsets
      }, {
        binding: 8,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage"} // Delaunay path segments
      }]
    });
    this._pipelineLayout = this._device.createPipelineLayout({
      label: "Ray Trace Mesh Pipeline Layout",
      bindGroupLayouts: [ this._bindGroupLayout ],
    });
  }
  
  async createRenderPipeline() { }
  
  render(pass) { }
  
  createBindGroup(outTexture) {
    this._outTexture = outTexture;
    // Create a bind group
    this._bindGroup = this._device.createBindGroup({
      label: "Ray Trace Mesh Bind Group",
      layout: this._computePipeline.getBindGroupLayout(0),
      entries: [
      {
        binding: 0,
        resource: { buffer: this._cameraBuffer }
      },
      {
        binding: 1,
        resource: { buffer: this._vertexBuffer }
      },
      {
        binding: 2,
        resource: { buffer: this._indexBuffer }
      },
      {
        binding: 3,
        resource: outTexture.createView()
      },
      {
        binding: 4,
        resource: { buffer: this._overlayBuffer }
      },
      {
        binding: 5,
        resource: { buffer: this._voronoiBoundaryBuffer }
      },
      {
        binding: 6,
        resource: { buffer: this._delaunayPathBuffer }
      },
      {
        binding: 7,
        resource: { buffer: this._delaunaySegmentOffsetBuffer }
      },
      {
        binding: 8,
        resource: { buffer: this._delaunaySegmentBuffer }
      }
      ],
    });
    this._wgWidth = Math.ceil(outTexture.width);
    this._wgHeight = Math.ceil(outTexture.height);
  }
  
  async createComputePipeline() {
    // Create a compute pipeline that updates the image.
    this._computePipeline = this._device.createComputePipeline({
      label: "Ray Trace Mesh Orthogonal Pipeline " + this.getName(),
      layout: this._pipelineLayout,
      compute: {
        module: this._shaderModule,
        entryPoint: "computeOrthogonalMain",
      }
    });
    // Create a compute pipeline that updates the image.
    this._computeProjectivePipeline = this._device.createComputePipeline({
      label: "Ray Trace Mesh Projective Pipeline " + this.getName(),
      layout: this._pipelineLayout,
      compute: {
        module: this._shaderModule,
        entryPoint: "computeProjectiveMain",
      }
    });
  }
    
  compute(pass) {
    // add to compute pass
    if (this._camera?._isProjective) {
      pass.setPipeline(this._computeProjectivePipeline);        // set the compute projective pipeline
    }
    else {
      pass.setPipeline(this._computePipeline);                 // set the compute orthogonal pipeline
    }
    pass.setBindGroup(0, this._bindGroup);                  // bind the buffer
    pass.dispatchWorkgroups(Math.ceil(this._wgWidth / 16), Math.ceil(this._wgHeight / 16)); // dispatch
  }
}
