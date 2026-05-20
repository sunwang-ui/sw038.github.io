export default class Renderer {
    constructor(canvas) {
        this._canvas = canvas;
        this._objects = [];
        this._clearColor = { r: 0, g: 56/255, b: 101/255, a: 1 }; // Blue
    }

    async init() {
        // Check if it supports WebGPU
        if (!navigator.gpu) {
            throw Error("WebGPU is not supported in this browser.");
        }
        // Get an GPU adapter
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw Error("Couldn't request WebGPU adapter.");
        }
        // Get a GPU device
        this._device = await adapter.requestDevice();
        // Get and set the context
        this._context = this._canvas.getContext("webgpu");
        this._canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this._context.configure({
            device: this._device,
            format: this._canvasFormat,
        });
        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas.bind(this));
    }

    resizeCanvas() {
        // Resize the canvas to match the window size
        const devicePixelRatio = window.devicePixelRatio || 1;
        const width = window.innerWidth * devicePixelRatio;
        const height = window.innerHeight * devicePixelRatio;
        this._canvas.width = width;
        this._canvas.height = height;
        // Scale the canvas using CSS
        this._canvas.style.width = `${window.innerWidth}px`;
        this._canvas.style.height = `${window.innerHeight}px`;
        this.render();
    }

    async appendSceneObject(obj) {
        await obj.init();
        this._objects.push(obj);
    }

    renderToSelectedView(outputView) {
        // update cpu geometry if needed
        for (const obj of this._objects) {
            obj?.updateGeometry();
        }
        // Create a gpu command encoder
        let encoder = this._device.createCommandEncoder();
        // Use the encoder to begin render pass
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: outputView,
                clearValue: this._clearColor,
                loadOp: "clear",
                storeOp: "store",
            }]
        });
        // add more render pass to draw
        for (const obj of this._objects) {
            obj?.render(pass);
        }
        pass.end(); // end the pass
        const computePass = encoder.beginComputePass();
        // add compute pass to compute
        for (const obj of this._objects) {
            obj?.compute(computePass);
        }
        computePass.end(); // end the pass
        // Create the command buffer
        const commandBuffer = encoder.finish();
        // Submit to the device to render
        this._device.queue.submit([commandBuffer]);
    }

    render() {
        this.renderToSelectedView(this._context.getCurrentTexture().createView());
    }
}