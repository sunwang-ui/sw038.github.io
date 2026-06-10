import ComputeRenderer from "/linear-solver/lib/renderer/ComputeRenderer.js";
import computeGaussianElimination from "/linear-solver/lib/scene/computeLinearSolutionsBackSubstitutions.js";

let renderer = null;
let GaussianElimination = null;

function createNumberInput(value = 0) {
    const input = document.createElement("input");

    input.type = "number";
    input.value = value;
    input.step = "any";

    input.style.width = "60px";
    input.style.margin = "3px";

    return input;
}

function createMatrixInputs(container, name, rows, cols, defaultValues = null) {
    container.innerHTML = "";

    const title = document.createElement("h3");
    title.textContent = name + " (" + rows + " x " + cols + ")";
    container.appendChild(title);

    const inputs = [];

    for (let row = 0; row < rows; row++) {
        const rowDiv = document.createElement("div");

        for (let col = 0; col < cols; col++) {
            const index = row * cols + col;

            let value = 0;

            if (defaultValues != null && index < defaultValues.length) {
                value = defaultValues[index];
            }

            const input = createNumberInput(value);

            rowDiv.appendChild(input);
            inputs.push(input);
        }

        container.appendChild(rowDiv);
    }

    return inputs;
}

function readMatrixInputs(inputs) {
    return inputs.map(input => Number(input.value));
}

function formatMatrix(list, rows, cols) {
    let text = "";

    for (let row = 0; row < rows; row++) {
        let line = "[ ";

        for (let col = 0; col < cols; col++) {
            const value = list[row * cols + col];

            if (Number.isFinite(value)) {
                line += Number(value.toFixed(5)) + " ";
            } else {
                line += value + " ";
            }
        }

        line += "]";
        text += line + "\n";
    }

    return text;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createRandomMatrix(length, min = -100, max = 100) {
    const list = [];

    for (let i = 0; i < length; i++) {
        list.push(getRandomInt(min, max));
    }

    return list;
}

function indexA(row, col, n) {
    return row * n + col;
}

function indexB(row, col, m) {
    return row * m + col;
}

function swapRowsA(A, row1, row2, n) {
    for (let col = 0; col < n; col++) {
        const i1 = indexA(row1, col, n);
        const i2 = indexA(row2, col, n);

        const temp = A[i1];
        A[i1] = A[i2];
        A[i2] = temp;
    }
}

function swapRowsB(B, row1, row2, m) {
    for (let col = 0; col < m; col++) {
        const i1 = indexB(row1, col, m);
        const i2 = indexB(row2, col, m);

        const temp = B[i1];
        B[i1] = B[i2];
        B[i2] = temp;
    }
}

function solveMatrixCPU(n, m, originalA, originalB) {
    const A = [...originalA];
    const B = [...originalB];

    const epsilon = 0.000001;

    /*
        Forward elimination.

        This turns A into an upper triangular matrix.
        It also applies the same row operations to B.
    */
    for (let pivot = 0; pivot < n; pivot++) {
        let bestRow = pivot;
        let bestValue = Math.abs(A[indexA(pivot, pivot, n)]);

        for (let row = pivot + 1; row < n; row++) {
            const value = Math.abs(A[indexA(row, pivot, n)]);

            if (value > bestValue) {
                bestValue = value;
                bestRow = row;
            }
        }

        if (bestRow !== pivot) {
            swapRowsA(A, pivot, bestRow, n);
            swapRowsB(B, pivot, bestRow, m);
        }

        const pivotValue = A[indexA(pivot, pivot, n)];

        if (Math.abs(pivotValue) < epsilon) {
            throw new Error("CPU solver stopped: matrix is singular or nearly singular.");
        }

        for (let row = pivot + 1; row < n; row++) {
            const factor = A[indexA(row, pivot, n)] / pivotValue;

            A[indexA(row, pivot, n)] = 0;

            for (let col = pivot + 1; col < n; col++) {
                A[indexA(row, col, n)] =
                    A[indexA(row, col, n)] -
                    factor * A[indexA(pivot, col, n)];
            }

            for (let rhsCol = 0; rhsCol < m; rhsCol++) {
                B[indexB(row, rhsCol, m)] =
                    B[indexB(row, rhsCol, m)] -
                    factor * B[indexB(pivot, rhsCol, m)];
            }
        }
    }

    /*
        Back substitution.

        This overwrites B with the solution matrix X.
    */
    for (let rhsCol = 0; rhsCol < m; rhsCol++) {
        for (let row = n - 1; row >= 0; row--) {
            let sum = B[indexB(row, rhsCol, m)];

            for (let col = row + 1; col < n; col++) {
                sum =
                    sum -
                    A[indexA(row, col, n)] *
                    B[indexB(col, rhsCol, m)];
            }

            const diagonal = A[indexA(row, row, n)];

            if (Math.abs(diagonal) < epsilon) {
                throw new Error("CPU back substitution stopped: zero diagonal.");
            }

            B[indexB(row, rhsCol, m)] = sum / diagonal;
        }
    }

    return B;
}

async function solveMatrixGPU(n, m, A, B) {
    const gaussianObject = new computeGaussianElimination(
        n,
        m,
        GaussianElimination,
        A,
        B
    );

    await gaussianObject.init(renderer._device);

    const encoder = renderer._device.createCommandEncoder();

    gaussianObject.compute(encoder);

    renderer._device.queue.submit([encoder.finish()]);

    const result = await gaussianObject.readResult();

    return result;
}

async function init() {
    renderer = new ComputeRenderer();
    await renderer.init();

    const shaderResponse = await fetch("../linear-solver/lib/shader/computeGaussianElimination.wgsl");

    if (!shaderResponse.ok) {
        throw new Error("Failed to load WGSL shader.");
    }

    GaussianElimination = await shaderResponse.text();

    const app = document.createElement("div");
    app.style.fontFamily = "Arial, sans-serif";
    app.style.padding = "20px";

    document.body.appendChild(app);

    const title = document.createElement("h2");
    title.textContent = "Gaussian Elimination Solver: AX = B";
    app.appendChild(title);

    const dimensionsDiv = document.createElement("div");
    app.appendChild(dimensionsDiv);

    const nLabel = document.createElement("label");
    nLabel.textContent = "A size n x n, n: ";
    dimensionsDiv.appendChild(nLabel);

    const nInput = createNumberInput(3);
    nInput.min = "1";
    nInput.step = "1";
    dimensionsDiv.appendChild(nInput);

    const mLabel = document.createElement("label");
    mLabel.textContent = "   B columns m: ";
    dimensionsDiv.appendChild(mLabel);

    const mInput = createNumberInput(2);
    mInput.min = "1";
    mInput.step = "1";
    dimensionsDiv.appendChild(mInput);

    const createButton = document.createElement("button");
    createButton.textContent = "Create Matrices";
    createButton.style.marginLeft = "10px";
    dimensionsDiv.appendChild(createButton);

    const matrixArea = document.createElement("div");
    matrixArea.style.display = "flex";
    matrixArea.style.gap = "40px";
    matrixArea.style.marginTop = "20px";
    app.appendChild(matrixArea);

    const matrixAContainer = document.createElement("div");
    const matrixBContainer = document.createElement("div");

    matrixArea.appendChild(matrixAContainer);
    matrixArea.appendChild(matrixBContainer);

    const solveButton = document.createElement("button");
    solveButton.textContent = "Solve AX = B";
    solveButton.style.display = "block";
    solveButton.style.marginTop = "20px";
    solveButton.style.padding = "8px 12px";
    app.appendChild(solveButton);

    const outputTitle = document.createElement("h3");
    outputTitle.textContent = "Output X";
    app.appendChild(outputTitle);

    const output = document.createElement("pre");
    output.style.background = "#f2f2f2";
    output.style.padding = "10px";
    output.style.minHeight = "80px";
    app.appendChild(output);

    let matrixAInputs = [];
    let matrixBInputs = [];

    let hiddenA = null;
    let hiddenB = null;

    function buildMatrices() {
        const n = Number(nInput.value);
        const m = Number(mInput.value);

        if (!Number.isInteger(n) || n <= 0) {
            output.textContent = "n must be a positive integer.";
            return;
        }

        if (!Number.isInteger(m) || m <= 0) {
            output.textContent = "m must be a positive integer.";
            return;
        }

        matrixAContainer.innerHTML = "";
        matrixBContainer.innerHTML = "";

        matrixAInputs = [];
        matrixBInputs = [];

        hiddenA = null;
        hiddenB = null;

        if (n > 5) {
            hiddenA = createRandomMatrix(n * n, -100, 100);
            hiddenB = createRandomMatrix(n * m, -100, 100);

            output.textContent =
                "n is greater than 5, so matrices were created randomly and hidden. Press Solve AX = B to calculate.";

            return;
        }

        let defaultA = createRandomMatrix(n * n, -100, 100);
        let defaultB = createRandomMatrix(n * m, -100, 100);

        if (n === 3 && m === 2) {
            defaultA = [
                2, 1, -1,
                -3, -1, 2,
                -2, 1, 2
            ];

            defaultB = [
                8, 3,
                -11, -3,
                -3, 5
            ];
        }

        matrixAInputs = createMatrixInputs(
            matrixAContainer,
            "Matrix A",
            n,
            n,
            defaultA
        );

        matrixBInputs = createMatrixInputs(
            matrixBContainer,
            "Matrix B",
            n,
            m,
            defaultB
        );

        output.textContent = "Matrices created. Edit entries, then press Solve AX = B.";
    }

    createButton.addEventListener("click", () => {
        buildMatrices();
    });

    solveButton.addEventListener("click", async () => {
        try {
            const n = Number(nInput.value);
            const m = Number(mInput.value);

            let A = null;
            let B = null;

            if (n > 5) {
                if (hiddenA == null || hiddenB == null) {
                    hiddenA = createRandomMatrix(n * n, -100, 100);
                    hiddenB = createRandomMatrix(n * m, -100, 100);
                }

                A = hiddenA;
                B = hiddenB;
            } else {
                A = readMatrixInputs(matrixAInputs);
                B = readMatrixInputs(matrixBInputs);
            }

            if (A.length !== n * n) {
                output.textContent = "Matrix A has the wrong number of entries.";
                return;
            }

            if (B.length !== n * m) {
                output.textContent = "Matrix B has the wrong number of entries.";
                return;
            }

            const cpuStartTime = performance.now();
            const cpuResult = solveMatrixCPU(n, m, A, B);
            const cpuEndTime = performance.now();
            const cpuElapsedTime = cpuEndTime - cpuStartTime;

            const gpuStartTime = performance.now();
            const gpuResult = await solveMatrixGPU(n, m, A, B);
            const gpuEndTime = performance.now();
            const gpuElapsedTime = gpuEndTime - gpuStartTime;

            if (n > 5) {
                output.textContent =
                    "Solved hidden random system with A size " +
                    n +
                    " x " +
                    n +
                    " and B size " +
                    n +
                    " x " +
                    m +
                    ".\n\n" +
                    "CPU JavaScript time: " +
                    cpuElapsedTime.toFixed(3) +
                    " ms\n" +
                    "GPU WebGPU time: " +
                    gpuElapsedTime.toFixed(3) +
                    " ms\n\n" +
                    "Check console for matrices and results.";

                console.log("Hidden random A:", A);
                console.log("Hidden random B:", B);
                console.log("CPU Solution X:", cpuResult);
                console.log("GPU Solution X:", gpuResult);
                console.log("CPU JavaScript time:", cpuElapsedTime.toFixed(3), "ms");
                console.log("GPU WebGPU time:", gpuElapsedTime.toFixed(3), "ms");

                return;
            }

            output.textContent =
                "CPU JavaScript Solution X:\n" +
                formatMatrix(cpuResult, n, m) +
                "\nGPU WebGPU Solution X:\n" +
                formatMatrix(gpuResult, n, m) +
                "\nCPU JavaScript time: " +
                cpuElapsedTime.toFixed(3) +
                " ms\n" +
                "GPU WebGPU time: " +
                gpuElapsedTime.toFixed(3) +
                " ms";

            console.log("A:", A);
            console.log("B:", B);
            console.log("CPU Solution X:", cpuResult);
            console.log("GPU Solution X:", gpuResult);
            console.log("CPU JavaScript time:", cpuElapsedTime.toFixed(3), "ms");
            console.log("GPU WebGPU time:", gpuElapsedTime.toFixed(3), "ms");

        } catch (error) {
            output.textContent = error.message;
            console.error(error);
        }
    });

    buildMatrices();

    return renderer;
}

init()
    .then(ret => {
        console.log(ret);
    })
    .catch(error => {
        const pTag = document.createElement("p");
        pTag.innerHTML = navigator.userAgent + "</br>" + error.message;
        document.body.appendChild(pTag);
        console.error(error);
    });