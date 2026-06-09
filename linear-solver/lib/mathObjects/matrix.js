export default class matrix {
    constructor(size) {
        this._rows = null;
        this._cols = null;

        if (Array.isArray(size)) {
            this._rows = size[0];
            this._cols = size[1];
        } else {
            this._rows = size;
            this._cols = size;
        }

        this._matrix = [];
    }

    fillMatrixRandom(rangeStart, rangeEnd) {
        let list = [];

        for (let i = 0; i < this._rows * this._cols; i++) {
            list.push(this.getRandomInt(rangeStart, rangeEnd));
        }

        this._matrix = list;
    }

    setMatrix(matrixList) {
        if (matrixList.length !== this._rows * this._cols) {
            throw new Error(
                "Matrix list has wrong size. Expected " +
                (this._rows * this._cols) +
                " values, got " +
                matrixList.length +
                "."
            );
        }

        this._matrix = matrixList;
    }

    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }

    getMatrix() {
        return this._matrix;
    }

    getRows() {
        return this._rows;
    }

    getCols() {
        return this._cols;
    }
}