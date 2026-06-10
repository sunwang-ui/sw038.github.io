import matrix from "/linear-solver/lib/mathObjects/matrix.js";

export default class computeSumFromMatrix {
    constructor(mbym, shader, list = null) {
        this._matrix = new matrix(mbym);
        this.shader = shader;

        if (list != null) {
            this._matrix.setMatrix(list);
        } else {
            this._matrix.fillMatrixRandom(-100, 100);
        }

        this._device = null;

        this._matrixBuffer = null;
        this._resultBuffer = null;
        this._readBuffer = null;

        this._pipeline = null;
        this._bindGroup = null;

        this._result = null;
    }

    async init(device) {

        this._device = device;

        const matrixData = new Float32Array(this._matrix.getMatrix());
        const matrixLengthData = new Uint32Array([matrixData.length]);

        this._matrixBuffer = device.createBuffer({
            size: matrixData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(this._matrixBuffer, 0, matrixData);

        this._lengthBuffer = device.createBuffer({
            size: matrixLengthData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(this._lengthBuffer, 0, matrixLengthData);

        this._resultBuffer = device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });

        this._readBuffer = device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        const shaderModule = device.createShaderModule({
            code: this.shader
        });

        this._pipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: shaderModule,
                entryPoint: "computeMain"
            }
        });

        this._bindGroup = device.createBindGroup({
            layout: this._pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this._matrixBuffer
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this._resultBuffer
                    }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this._lengthBuffer
                    }
                }
            ]
        });
    }

    compute(encoder) {
        const pass = encoder.beginComputePass();

        pass.setPipeline(this._pipeline);
        pass.setBindGroup(0, this._bindGroup);
        pass.dispatchWorkgroups(1);

        pass.end();
    }

    async readResult() {
        const encoder = this._device.createCommandEncoder();

        encoder.copyBufferToBuffer(
            this._resultBuffer,
            0,
            this._readBuffer,
            0,
            4
        );

        this._device.queue.submit([encoder.finish()]);

        await this._readBuffer.mapAsync(GPUMapMode.READ);

        const data = new Float32Array(this._readBuffer.getMappedRange());
        this._result = data[0];

        this._readBuffer.unmap();

        return this._result;
    }

    getMatrix() {
        return this._matrix.getMatrix();
    }

    getResult() {
        return this._result;
    }
}