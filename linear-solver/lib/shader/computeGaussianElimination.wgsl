@group(0) @binding(0)
var<storage, read_write> A: array<f32>;

@group(0) @binding(1)
var<storage, read_write> B: array<f32>;

@group(0) @binding(2)
var<uniform> size: vec2u;

fn indexA(row: u32, col: u32, n: u32) -> u32 {
    return row * n + col;
}

fn indexB(row: u32, col: u32, m: u32) -> u32 {
    return row * m + col;
}

fn absValue(x: f32) -> f32 {
    if (x < 0.0) {
        return -x;
    }

    return x;
}

fn swapRowsA(row1: u32, row2: u32, n: u32) {
    for (var col: u32 = 0u; col < n; col = col + 1u) {
        let i1 = indexA(row1, col, n);
        let i2 = indexA(row2, col, n);

        let temp = A[i1];
        A[i1] = A[i2];
        A[i2] = temp;
    }
}

fn swapRowsB(row1: u32, row2: u32, m: u32) {
    for (var col: u32 = 0u; col < m; col = col + 1u) {
        let i1 = indexB(row1, col, m);
        let i2 = indexB(row2, col, m);

        let temp = B[i1];
        B[i1] = B[i2];
        B[i2] = temp;
    }
}

@compute
@workgroup_size(1)
fn computeMain(@builtin(global_invocation_id) global_id: vec3u) {
    let n = size.x;
    let m = size.y;

    if (global_id.x != 0u) {
        return;
    }

    /*
        Forward elimination.

        This changes A into an upper triangular matrix.
        It also applies the same row operations to B.
    */
    for (var pivot: u32 = 0u; pivot < n; pivot = pivot + 1u) {
        var bestRow = pivot;
        var bestValue = absValue(A[indexA(pivot, pivot, n)]);

        /*
            Find the best pivot row by searching downward
            in the current pivot column.
        */
        for (var row: u32 = pivot + 1u; row < n; row = row + 1u) {
            let value = absValue(A[indexA(row, pivot, n)]);

            if (value > bestValue) {
                bestValue = value;
                bestRow = row;
            }
        }

        /*
            Swap rows if a better pivot was found.
        */
        if (bestRow != pivot) {
            swapRowsA(pivot, bestRow, n);
            swapRowsB(pivot, bestRow, m);
        }

        let pivotValue = A[indexA(pivot, pivot, n)];

        /*
            If pivotValue is 0, the matrix is singular.
            WGSL cannot throw an error, so we just stop.
        */
        if (absValue(pivotValue) < 0.000001) {
            return;
        }

        /*
            Eliminate values below the pivot.
        */
        for (var row: u32 = pivot + 1u; row < n; row = row + 1u) {
            let factor = A[indexA(row, pivot, n)] / pivotValue;

            A[indexA(row, pivot, n)] = 0.0;

            for (var col: u32 = pivot + 1u; col < n; col = col + 1u) {
                A[indexA(row, col, n)] =
                    A[indexA(row, col, n)] -
                    factor * A[indexA(pivot, col, n)];
            }

            for (var rhsCol: u32 = 0u; rhsCol < m; rhsCol = rhsCol + 1u) {
                B[indexB(row, rhsCol, m)] =
                    B[indexB(row, rhsCol, m)] -
                    factor * B[indexB(pivot, rhsCol, m)];
            }
        }
    }

    /*
        Back substitution.

        This solves for X.
        We overwrite B with X.
    */
    for (var rhsCol: u32 = 0u; rhsCol < m; rhsCol = rhsCol + 1u) {
        var row: i32 = i32(n) - 1;

        loop {
            if (row < 0) {
                break;
            }

            let urow = u32(row);

            var sum = B[indexB(urow, rhsCol, m)];

            for (var col: u32 = urow + 1u; col < n; col = col + 1u) {
                sum = sum - A[indexA(urow, col, n)] * B[indexB(col, rhsCol, m)];
            }

            B[indexB(urow, rhsCol, m)] = sum / A[indexA(urow, urow, n)];

            row = row - 1;
        }
    }
}