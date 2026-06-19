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

import SceneObject from "./lib/Scene/SceneObject.js"
import TriangleMesh from "./lib/DS/TriangleMesh.js"

export default class RayTracingTriangleMeshObject extends SceneObject {
  constructor(device, canvasFormat, filename, camera, shaderFile) {
    super(device, canvasFormat, shaderFile);
    this._mesh = new TriangleMesh(filename);
    this._camera = camera;
    this._overlayMode = 0;
    this._meshLineThickness = 0.018;
    this._voronoiLineThickness = 0.028;
  }
  
  async createGeometry() {
    await this._mesh.init();
    this._numV = this._mesh._numV;
    this._numT = this._mesh._numT;
    this._vProp = this._mesh._vProp;
    this._vertices = this._mesh._vertices.flat();
    this._triangles = this._mesh._triangles.flat();
    this._voronoiBoundaryFlags = new Uint32Array(this._numT);
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
    this.writeOverlayBuffer();
  }

  writeOverlayBuffer() {
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);
    view.setUint32(0, this._overlayMode, true);
    view.setFloat32(4, this._meshLineThickness, true);
    view.setFloat32(8, this._voronoiLineThickness, true);
    view.setFloat32(12, 0, true);
    this._device.queue.writeBuffer(this._overlayBuffer, 0, buffer);
  }

  setOverlayMode(mode) {
    const modes = {
      none: 0,
      original: 1,
      voronoi: 2
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
