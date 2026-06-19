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

export default class CameraTriangleMeshLinearInterpolationObject extends SceneObject {
  constructor(device, canvasFormat, srcfile, tgtfile, camera, shaderFile) {
    super(device, canvasFormat, shaderFile);
    this._srcmesh = new TriangleMesh(srcfile);
    this._tgtmesh = new TriangleMesh(tgtfile);
    this._camera = camera;
    this._t = new Float32Array([0., 0.]); // time + dummy
    this._delta = 0.01;
    this._weightScheme = "area"; // "uniform", "inverse", or "area"
    this._laplacianIterations = 3;
  }
  getWeights() {
    if (this._weightScheme === "uniform") {
      return this._srcmesh._uniformWeights;
    }

    if (this._weightScheme === "inverse") {
      return this._srcmesh._inverseEdgeLengthWeights;
    }

    if (this._weightScheme === "area") {
      return this._srcmesh._triangleAreaWeights;
    }

    throw new Error("Unknown weight scheme: " + this._weightScheme);
  }

  getSourceLaplacians() {
    if (this._weightScheme === "uniform") {
      return this._srcmesh._uniformLaplacian;
    }

    if (this._weightScheme === "inverse") {
      return this._srcmesh._inverseEdgeLengthLaplacian;
    }

    if (this._weightScheme === "area") {
      return this._srcmesh._triangleAreaLaplacian;
    }

    throw new Error("Unknown weight scheme: " + this._weightScheme);
  }

  getTargetLaplacians() {
    if (this._weightScheme === "uniform") {
      return this._tgtmesh._uniformLaplacian;
    }

    if (this._weightScheme === "inverse") {
      return this._tgtmesh._inverseEdgeLengthLaplacian;
    }

    if (this._weightScheme === "area") {
      return this._tgtmesh._triangleAreaLaplacian;
    }

    throw new Error("Unknown weight scheme: " + this._weightScheme);
  }

  getPosition(mesh, i) {
    return [
      mesh._vertices[i][0],
      mesh._vertices[i][1],
      mesh._vertices[i][2]
    ];
  }

  weightedNeighborAverage(positions, weights, i) {
    const avg = [0, 0, 0];

    for (const n of weights[i]) {
      const j = n.index;
      const w = n.weight;

      avg[0] += positions[j][0] * w;
      avg[1] += positions[j][1] * w;
      avg[2] += positions[j][2] * w;
    }

    return avg;
  }

  computeLaplacianInterpolatedPositions(t) {
    const weights = this.getWeights();
    const srcLaplacians = this.getSourceLaplacians();
    const tgtLaplacians = this.getTargetLaplacians();

    const positions = new Array(this._numV);
    const interpolatedLaplacians = new Array(this._numV);

    // First, start with normal linear interpolation.
    for (let i = 0; i < this._numV; ++i) {
      const src = this.getPosition(this._srcmesh, i);
      const tgt = this.getPosition(this._tgtmesh, i);

      positions[i] = [
        src[0] * (1 - t) + tgt[0] * t,
        src[1] * (1 - t) + tgt[1] * t,
        src[2] * (1 - t) + tgt[2] * t
      ];

      interpolatedLaplacians[i] = [
        srcLaplacians[i][0] * (1 - t) + tgtLaplacians[i][0] * t,
        srcLaplacians[i][1] * (1 - t) + tgtLaplacians[i][1] * t,
        srcLaplacians[i][2] * (1 - t) + tgtLaplacians[i][2] * t
      ];
    }

    // Then repeatedly update using:
    // v = interpolatedLaplacian + weightedAverage(neighbors)
    for (let iter = 0; iter < this._laplacianIterations; ++iter) {
      const nextPositions = new Array(this._numV);

      for (let i = 0; i < this._numV; ++i) {
        const avg = this.weightedNeighborAverage(positions, weights, i);

        nextPositions[i] = [
          interpolatedLaplacians[i][0] + avg[0],
          interpolatedLaplacians[i][1] + avg[1],
          interpolatedLaplacians[i][2] + avg[2]
        ];
      }

      for (let i = 0; i < this._numV; ++i) {
        positions[i] = nextPositions[i];
      }
    }

    return positions;
  }

  packUpdatedVertices(positions, t) {
    const updatedVertices = new Float32Array(this._numV * this._vProp.length * 2);

    for (let i = 0; i < this._numV; ++i) {
      const p = positions[i];

      const srcNormal = [
        this._srcmesh._vertices[i][3],
        this._srcmesh._vertices[i][4],
        this._srcmesh._vertices[i][5]
      ];

      const tgtNormal = [
        this._tgtmesh._vertices[i][3],
        this._tgtmesh._vertices[i][4],
        this._tgtmesh._vertices[i][5]
      ];

      const normal = [
        srcNormal[0] * (1 - t) + tgtNormal[0] * t,
        srcNormal[1] * (1 - t) + tgtNormal[1] * t,
        srcNormal[2] * (1 - t) + tgtNormal[2] * t
      ];

      const base = i * this._vProp.length * 2;

      // Source position slot
      updatedVertices[base + 0] = p[0];
      updatedVertices[base + 1] = p[1];
      updatedVertices[base + 2] = p[2];

      // Source normal slot
      updatedVertices[base + 3] = normal[0];
      updatedVertices[base + 4] = normal[1];
      updatedVertices[base + 5] = normal[2];

      // Target position slot
      // Same as source because CPU already computed the final interpolated position.
      updatedVertices[base + 6] = p[0];
      updatedVertices[base + 7] = p[1];
      updatedVertices[base + 8] = p[2];

      // Target normal slot
      updatedVertices[base + 9] = normal[0];
      updatedVertices[base + 10] = normal[1];
      updatedVertices[base + 11] = normal[2];
    }

    return updatedVertices;
  }

  buildEdgeIndices(triangles) {
    const edgeIndices = [];

    for (let i = 0; i < triangles.length; i += 3) {
      const a = triangles[i + 0];
      const b = triangles[i + 1];
      const c = triangles[i + 2];

      edgeIndices.push(a, b, b, c, c, a);
    }

    return new Uint32Array(edgeIndices);
  }

  async createGeometry() {
    await this._srcmesh.init();
    await this._tgtmesh.init();
    this._numV = this._srcmesh._numV;
    this._numT = this._srcmesh._numT;
    this._vProp = this._srcmesh._vProp;
    this._vertices = new Array(this._numV);
    // combine source and target into one list
    for (let i = 0; i < this._numV; ++i) {
      this._vertices[i] = [...this._srcmesh._vertices[i], ...this._tgtmesh._vertices[i]];
    }
    // flatten it
    this._vertices = this._vertices.flat();
    this._triangles = this._srcmesh._triangles.flat();
    // Create vertex buffer to store the vertices in GPU
    this._vertexBuffer = this._device.createBuffer({
      label: "Vertices Normals and More",
      size: this._vertices.length * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    // Copy from CPU to GPU
    new Float32Array(this._vertexBuffer.getMappedRange()).set(this._vertices);
    this._vertexBuffer.unmap();
    //this._device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices);
    // Define vertex buffer layout - how the GPU should read the buffer
    this._vertexBufferLayout = {
      arrayStride: this._vProp.length * Float32Array.BYTES_PER_ELEMENT * 2, // double the size
      attributes: [
      { // src vertices
        format: "float32x3", // 32 bits, each has three coordiantes
        offset: 0,
        shaderLocation: 0, // position in the vertex shader
      },
      { // src normals
        format: "float32x3", // 32 bits, each has three coordiantes
        offset: 3 * Float32Array.BYTES_PER_ELEMENT,
        shaderLocation: 1, // position in the vertex shader
      },
      { // tgt vertices
        format: "float32x3", // 32 bits, each has three coordiantes
        offset: 6 * Float32Array.BYTES_PER_ELEMENT,
        shaderLocation: 2, // position in the vertex shader
      },
      { // tgt normals
        format: "float32x3", // 32 bits, each has three coordiantes
        offset: 9 * Float32Array.BYTES_PER_ELEMENT,
        shaderLocation: 3, // position in the vertex shader
      }
      ],
    };
    // Create index buffer to store the triangle indices in GPU
    this._indexBuffer = this._device.createBuffer({
      label: "Indices",
      size: this._triangles.length * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    }); 
    // Copy from CPU to GPU
    new Uint32Array(this._indexBuffer.getMappedRange()).set(this._triangles);
    this._indexBuffer.unmap();
    //this._device.queue.writeBuffer(this.indexBuffer, 0, this.triangles);

    this._edgeIndices = this.buildEdgeIndices(this._triangles);
    this._edgeIndexBuffer = this._device.createBuffer({
      label: "Mesh Edge Indices",
      size: this._edgeIndices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Uint32Array(this._edgeIndexBuffer.getMappedRange()).set(this._edgeIndices);
    this._edgeIndexBuffer.unmap();
    
    // Create camera buffer to store the camera pose and scale in GPU
    this._cameraBuffer = this._device.createBuffer({
      label: "Camera " + this.getName(),
      size: this._camera._pose.byteLength + this._camera._focal.byteLength + this._camera._resolutions.byteLength + this._t.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }); 
    // Copy from CPU to GPU - both pose and scales
    this._device.queue.writeBuffer(this._cameraBuffer, 0, this._camera._pose);
    this._device.queue.writeBuffer(this._cameraBuffer, this._camera._pose.byteLength, this._camera._focal);
    this._device.queue.writeBuffer(this._cameraBuffer, this._camera._pose.byteLength + this._camera._focal.byteLength, this._camera._resolutions);
    this._device.queue.writeBuffer(this._cameraBuffer, this._camera._pose.byteLength + this._camera._focal.byteLength + this._camera._resolutions.byteLength, this._t);
  }
  
  updateCameraPose() {
    this._device.queue.writeBuffer(this._cameraBuffer, 0, this._camera._pose);
  }
  
  updateCameraFocal() {
    this._device.queue.writeBuffer(this._cameraBuffer, this._camera._pose.byteLength, this._camera._focal);
  }

  updateGeometry() {
    this._t[0] = this._t[0] + this._delta;

    if (this._t[0] >= 1. || this._t[0] <= 0.) {
      this._delta *= -1;
    }

    const t = this._t[0];

    // Compute Laplacian-interpolated positions on CPU.
    const positions = this.computeLaplacianInterpolatedPositions(t);

    // Pack those positions into the same vertex-buffer format the shader already expects.
    const updatedVertices = this.packUpdatedVertices(positions, t);

    // Rewrite the GPU vertex buffer.
    this._device.queue.writeBuffer(this._vertexBuffer, 0, updatedVertices);

    // Still update t in the camera buffer.
    // The shader still reads it, but because srcpos and tgtpos are now equal,
    // the shader's interpolation gives the same CPU-computed position.
    this._device.queue.writeBuffer(
        this._cameraBuffer,
        this._camera._pose.byteLength + this._camera._focal.byteLength + this._camera._resolutions.byteLength,
        this._t
    );
  }
  
  async createRenderPipeline() {
    this._meshRenderPipeline = this._device.createRenderPipeline({
      label: "Mesh Render Pipeline",
      layout: "auto",
      vertex: {
        module: this._shaderModule,     // the shader code
        entryPoint: "vertexMain",          // the shader function
        buffers: [this._vertexBufferLayout] // the binded buffer layout
      },
      fragment: {
        module: this._shaderModule,     // the shader code
        entryPoint: "fragmentMain",        // the shader function
        targets: [{
          format: this._canvasFormat        // the target canvas format
        }]
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true, // enable z-buffer - depth test
        depthCompare: "less" // Closer pixels overwrite farther ones
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none" // Cull back faces for better performance
      }
    }); 

    this._edgeRenderPipeline = this._device.createRenderPipeline({
      label: "Mesh Edge Render Pipeline",
      layout: "auto",
      vertex: {
        module: this._shaderModule,
        entryPoint: "vertexMain",
        buffers: [this._vertexBufferLayout]
      },
      fragment: {
        module: this._shaderModule,
        entryPoint: "fragmentLineMain",
        targets: [{
          format: this._canvasFormat
        }]
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: false,
        depthCompare: "less-equal"
      },
      primitive: {
        topology: "line-list",
        cullMode: "none"
      }
    });
    
    this._bindGroup = this._device.createBindGroup({
      label: "Interpolation Bind Group ",
      layout: this._meshRenderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this._cameraBuffer }
        }
      ]
    });

    this._edgeBindGroup = this._device.createBindGroup({
      label: "Interpolation Edge Bind Group ",
      layout: this._edgeRenderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this._cameraBuffer }
        }
      ]
    });
  }
  
  render(pass) {
    // add to render pass to draw the plane
    pass.setPipeline(this._meshRenderPipeline);
    pass.setBindGroup(0, this._bindGroup);                // bind the buffer
    pass.setVertexBuffer(0, this._vertexBuffer);          // bind the vertex buffer
    pass.setIndexBuffer(this._indexBuffer, 'uint32');     // bind the index buffer
    pass.drawIndexed(this._triangles.length, 1, 0, 0, 0); // draw using triangle lists

    pass.setPipeline(this._edgeRenderPipeline);
    pass.setBindGroup(0, this._edgeBindGroup);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.setIndexBuffer(this._edgeIndexBuffer, 'uint32');
    pass.drawIndexed(this._edgeIndices.length, 1, 0, 0, 0);
  }
  
  async createComputePipeline() {}
    
  compute(pass) {}
}
