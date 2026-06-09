@group(0) @binding(0)
var<storage, read> matrixData: array<f32>;

@group(0) @binding(1)
var<storage, read_write> result: array<f32>;

struct MatrixInfo {
    matrixLength: u32,
};

@group(0) @binding(2)
var<uniform> info: MatrixInfo;

@compute
@workgroup_size(1)
fn computeMain() {
    var sum: f32 = 0.0;

    for (var i: u32 = 0u; i < info.matrixLength; i = i + 1u) {
        sum = sum + matrixData[i];
    }

    result[0] = sum;
}