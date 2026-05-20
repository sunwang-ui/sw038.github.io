import SceneObject from "/scroll2/lib/Scene/SceneObject.js";

export default class Standard2DVertexObject extends SceneObject {
    constructor(device, canvasFormat, vertices, shaderFile, topology) {
        super(device, canvasFormat, shaderFile);
        // This assume each vertex has (x, y)
        this._vertices = vertices;
        this._topology = topology;
    }

    async createGeometry() {
        // Create vertex buffer to store the vertices in GPU
        this._vertexBuffer = this._device.createBuffer({
            label: "Vertices " + this.getName(),
            size: this._vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        // Copy from CPU to GPU
        this._device.queue.writeBuffer(this._vertexBuffer, 0, this._vertices);
        // Define vertex buffer layout - how the GPU should read the buffer
        this._vertexBufferLayout = {
            arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
            attributes: [{
                // position 0 has two floats
                shaderLocation: 0,   // position in the vertex shader
                format: "float32x2", // two coordinates
                offset: 0,           // no offset in the vertex buffer
            }],
        };
    }

    async createRenderPipeline() {
        this._renderPipeline = this._device.createRenderPipeline({
            label: "Render Pipeline " + this.getName(),
            layout: "auto",
            vertex: {
                module: this._shaderModule,         // the shader code
                entryPoint: "vertexMain",           // the shader function
                buffers: [this._vertexBufferLayout] // the binded buffer layout
            },
            fragment: {
                module: this._shaderModule,    // the shader code
                entryPoint: "fragmentMain",    // the shader function
                targets: [{
                    format: this._canvasFormat   // the target canvas format
                }]
            },
            primitive: {
                topology: this._topology       // draw using the specified topology
            }
        });
    }

    render(pass) {
        // add to render pass to draw the object
        pass.setPipeline(this._renderPipeline);      // which render pipeline to use
        pass.setVertexBuffer(0, this._vertexBuffer); // how the buffer are binded
        pass.draw(this._vertices.length / 2);        // number of vertices to draw
    }

    async createComputePipeline() {}

    compute(pass) {}
}