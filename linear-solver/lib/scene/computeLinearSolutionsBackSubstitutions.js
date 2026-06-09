import matrix from "../linear-solver/lib/mathObjects/matrix.js";

export default class computeGaussianElimination {
    constructor(n, m, shader = GaussianElimination, listA = null, listB = null) {
        this._n = n;
        this._m = m;

        this._matrixA = new matrix(n);
        this._matrixB = new matrix([n, m]);

        this.shader = shader;

        if (listA != null) {
            this._matrixA.setMatrix(listA);
        } else {
            this._matrixA.fillMatrixRandom(-100, 100);
        }

        if (listB != null) {
            this._matrixB.setMatrix(listB);
        } else {
            this._matrixB.fillMatrixRandom(-100, 100);
        }

        this._device = null;

        this._matrixABuffer = null;
        this._matrixBBuffer = null;
        this._sizeBuffer = null;
        this._readBuffer = null;

        this._pipeline = null;
        this._bindGroup = null;

        this._result = null;
    }

    async init(device) {

        this._device = device;

        const matrixAData = new Float32Array(this._matrixA.getMatrix());
        const matrixBData = new Float32Array(this._matrixB.getMatrix());

        const sizeData = new Uint32Array([this._n, this._m]);

        this._matrixABuffer = device.createBuffer({
            size: matrixAData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(this._matrixABuffer, 0, matrixAData);

        this._matrixBBuffer = device.createBuffer({
            size: matrixBData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });

        device.queue.writeBuffer(this._matrixBBuffer, 0, matrixBData);

        this._sizeBuffer = device.createBuffer({
            size: sizeData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(this._sizeBuffer, 0, sizeData);

        this._readBuffer = device.createBuffer({
            size: matrixBData.byteLength,
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
                        buffer: this._matrixABuffer
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this._matrixBBuffer
                    }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this._sizeBuffer
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

        const resultByteLength = this._n * this._m * 4;

        encoder.copyBufferToBuffer(
            this._matrixBBuffer,
            0,
            this._readBuffer,
            0,
            resultByteLength
        );

        this._device.queue.submit([encoder.finish()]);

        await this._readBuffer.mapAsync(GPUMapMode.READ);

        const data = new Float32Array(this._readBuffer.getMappedRange());
        this._result = Array.from(data);

        this._readBuffer.unmap();

        return this._result;
    }

    getMatrixA() {
        return this._matrixA.getMatrix();
    }

    getMatrixB() {
        return this._matrixB.getMatrix();
    }

    getResult() {
        return this._result;
    }
}