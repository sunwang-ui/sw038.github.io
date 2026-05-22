struct tint_symbol_2 {
  /* @offset(0) */
  tint_symbol_3 : vec4f,
  /* @offset(16) */
  tint_symbol_4 : vec2f,
}

alias Arr = array<vec2f, 6u>;

var<private> tint_symbol_6_1 : u32;

var<private> tint_symbol_3_1 = vec4f();

var<private> tint_symbol_4_1 = vec2f();

var<private> tint_symbol_4_2 : vec2f;

var<private> value = vec4f();

@group(0) @binding(0) var tint_symbol : texture_2d<f32>;

@group(0) @binding(1) var tint_symbol_1 : sampler;

const x_35 = vec2f(1.0f, -1.0f);

const x_36 = vec2f(-1.0f, 1.0f);

const x_37 = vec2f(1.0f);

fn tint_symbol_5_inner(tint_symbol_6 : u32) -> tint_symbol_2 {
  var tint_symbol_3 = array<vec2f, 6u>();
  var tint_symbol_4 = array<vec2f, 6u>();
  var tint_symbol_7 = tint_symbol_2(vec4f(), vec2f());
  tint_symbol_3 = Arr(vec2f(-1.0f), x_35, x_36, x_35, x_37, x_36);
  tint_symbol_4 = Arr(vec2f(0.0f, 1.0f), x_37, vec2f(), x_37, vec2f(1.0f, 0.0f), vec2f());
  let x_54 = tint_symbol_3[tint_symbol_6];
  tint_symbol_7.tint_symbol_3 = vec4f(x_54.x, x_54.y, 0.0f, 1.0f);
  tint_symbol_7.tint_symbol_4 = tint_symbol_4[tint_symbol_6];
  let x_62 = tint_symbol_7;
  return x_62;
}

fn tint_symbol_5_1() {
  let x_68 = tint_symbol_6_1;
  let x_67 = tint_symbol_5_inner(x_68);
  tint_symbol_3_1 = x_67.tint_symbol_3;
  tint_symbol_4_1 = x_67.tint_symbol_4;
  return;
}

struct tint_symbol_5_out {
  @builtin(position)
  tint_symbol_3_1_1 : vec4f,
  @location(0)
  tint_symbol_4_1_1 : vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) tint_symbol_6_1_param : u32) -> tint_symbol_5_out {
  tint_symbol_6_1 = tint_symbol_6_1_param;
  tint_symbol_5_1();
  return tint_symbol_5_out(tint_symbol_3_1, tint_symbol_4_1);
}

fn tint_symbol_8_inner(tint_symbol_4_3 : vec2f) -> vec4f {
  let x_75 = textureSample(tint_symbol, tint_symbol_1, tint_symbol_4_3);
  return x_75;
}

fn tint_symbol_8_1() {
  let x_83 = tint_symbol_4_2;
  let x_82 = tint_symbol_8_inner(x_83);
  value = x_82;
  return;
}

struct tint_symbol_8_out {
  @location(0)
  value_1 : vec4f,
}

@fragment
fn fragmentMain(@location(0) tint_symbol_4_2_param : vec2f) -> tint_symbol_8_out {
  tint_symbol_4_2 = tint_symbol_4_2_param;
  tint_symbol_8_1();
  return tint_symbol_8_out(value);
}
