export default class ComputeRenderer {
    constructor() {
        this._device = null;
        this._computeObjects = [];
    }

    async init() {
        if (!navigator.gpu){
            throw new Error("Webgpu not supported");
        }
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter){
            throw new Error("no adapter :|");
        }

        this._device = await adapter.requestDevice();
    }

    appendComputeObject(obj) {
        this._computeObjects.push(obj);
    }

    async initObjects() {
        for (const obj of this._computeObjects) {
            await obj.init(this._device);
        }
    }

    compute(){
        const encoder = this._device.createCommandEncoder();

        for (const obj of this._computeObjects){
            obj.compute(encoder);
        }

        this._device.queue.submit([encoder.finish()]);
    }
}