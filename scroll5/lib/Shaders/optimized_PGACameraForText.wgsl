alias RTArr = array<u32>;

struct tint_symbol_block {
  /* @offset(0) */
  inner : RTArr,
}

struct tint_symbol_2 {
  /* @offset(0) */
  tint_symbol_3 : f32,
  /* @offset(4) */
  tint_symbol_4 : f32,
  /* @offset(8) */
  tint_symbol_5 : f32,
  /* @offset(12) */
  tint_symbol_6 : f32,
}

struct tint_symbol_10 {
  /* @offset(0) */
  tint_symbol_11 : tint_symbol_2,
  /* @offset(16) */
  tint_symbol_12 : vec2f,
}

struct tint_symbol_13_block {
  /* @offset(0) */
  inner : tint_symbol_10,
}

struct tint_symbol_7 {
  /* @offset(0) */
  tint_symbol_8 : vec4f,
  /* @offset(16) */
  tint_symbol_9 : f32,
}

var<private> tint_symbol_8_1 : vec2f;

var<private> tint_symbol_26_1 : u32;

var<private> tint_symbol_8_2 = vec4f();

var<private> tint_symbol_9_1 = 0.0f;

var<private> tint_symbol_9_2 : f32;

var<private> value = vec4f();

var<private> tint_symbol_32_1 : vec3u;

@group(0) @binding(1) var<storage> tint_symbol : tint_symbol_block;

@group(0) @binding(2) var<storage, read_write> tint_symbol_1 : tint_symbol_block;

@group(0) @binding(0) var<uniform> tint_symbol_13 : tint_symbol_13_block;

fn tint_symbol_14(tint_symbol_15 : tint_symbol_2, tint_symbol_16 : tint_symbol_2) -> tint_symbol_2 {
  return tint_symbol_2(((tint_symbol_15.tint_symbol_3 * tint_symbol_16.tint_symbol_3) - (tint_symbol_15.tint_symbol_4 * tint_symbol_16.tint_symbol_4)), ((tint_symbol_15.tint_symbol_3 * tint_symbol_16.tint_symbol_4) + (tint_symbol_15.tint_symbol_4 * tint_symbol_16.tint_symbol_3)), ((((tint_symbol_15.tint_symbol_3 * tint_symbol_16.tint_symbol_5) + (tint_symbol_15.tint_symbol_4 * tint_symbol_16.tint_symbol_6)) + (tint_symbol_15.tint_symbol_5 * tint_symbol_16.tint_symbol_3)) - (tint_symbol_15.tint_symbol_6 * tint_symbol_16.tint_symbol_4)), ((((tint_symbol_15.tint_symbol_3 * tint_symbol_16.tint_symbol_6) - (tint_symbol_15.tint_symbol_4 * tint_symbol_16.tint_symbol_5)) + (tint_symbol_15.tint_symbol_5 * tint_symbol_16.tint_symbol_4)) + (tint_symbol_15.tint_symbol_6 * tint_symbol_16.tint_symbol_3)));
}

fn tint_symbol_17(tint_symbol_15_1 : tint_symbol_2) -> tint_symbol_2 {
  return tint_symbol_2(tint_symbol_15_1.tint_symbol_3, -(tint_symbol_15_1.tint_symbol_4), -(tint_symbol_15_1.tint_symbol_5), -(tint_symbol_15_1.tint_symbol_6));
}

fn tint_symbol_18(tint_symbol_19 : tint_symbol_2, tint_symbol_20 : tint_symbol_2) -> tint_symbol_2 {
  let x_98 = tint_symbol_17(tint_symbol_20);
  let x_99 = tint_symbol_14(tint_symbol_19, x_98);
  let x_100 = tint_symbol_14(tint_symbol_20, x_99);
  return x_100;
}

fn tint_symbol_21(tint_symbol_19_1 : vec2f) -> tint_symbol_2 {
  return tint_symbol_2(0.0f, 1.0f, tint_symbol_19_1.y, -(tint_symbol_19_1.x));
}

fn tint_symbol_22(tint_symbol_19_2 : tint_symbol_2) -> vec2f {
  return vec2f((-(tint_symbol_19_2.tint_symbol_6) / tint_symbol_19_2.tint_symbol_4), (tint_symbol_19_2.tint_symbol_5 / tint_symbol_19_2.tint_symbol_4));
}

fn tint_symbol_23(tint_symbol_19_3 : vec2f, tint_symbol_20_1 : tint_symbol_2) -> vec2f {
  let x_127 = tint_symbol_21(tint_symbol_19_3);
  let x_128 = tint_symbol_18(x_127, tint_symbol_20_1);
  let x_129 = tint_symbol_22(x_128);
  return x_129;
}

fn tint_mod(lhs : u32, rhs : u32) -> u32 {
  return (lhs % select(rhs, 1u, (rhs == 0u)));
}

fn tint_div(lhs_1 : u32, rhs_1 : u32) -> u32 {
  return (lhs_1 / select(rhs_1, 1u, (rhs_1 == 0u)));
}

fn tint_symbol_25_inner(tint_symbol_8 : vec2f, tint_symbol_26 : u32) -> tint_symbol_7 {
  var x_162 = vec2f();
  var x_169 = vec2f();
  var x_174 = vec2f();
  var x_180 = vec2f();
  var tint_symbol_36 = tint_symbol_7(vec4f(), 0.0f);
  let x_154 = tint_mod(tint_symbol_26, 10u);
  let x_156 = tint_div(tint_symbol_26, 10u);
  let x_167 = (1.0f * 2.0f);
  let x_171 = -(1.0f);
  let x_178 = ((x_167 / 10.0f) * 0.5f);
  let x_187 = tint_symbol_13.inner.tint_symbol_11;
  let x_183 = tint_symbol_17(x_187);
  let x_188 = tint_symbol_23(((tint_symbol_8 / vec2f(10.0f)) + ((vec2f(x_171) + ((vec2f(f32(x_154), f32(x_156)) / vec2f(10.0f)) * x_167)) + vec2f(x_178))), x_183);
  let x_192 = (x_188 * tint_symbol_13.inner.tint_symbol_12);
  tint_symbol_36.tint_symbol_8 = vec4f(x_192.x, x_192.y, 0.0f, 1.0f);
  tint_symbol_36.tint_symbol_9 = f32(tint_symbol.inner[tint_symbol_26]);
  let x_207 = tint_symbol_36;
  return x_207;
}

fn tint_symbol_25_1() {
  let x_213 = tint_symbol_8_1;
  let x_214 = tint_symbol_26_1;
  let x_212 = tint_symbol_25_inner(x_213, x_214);
  tint_symbol_8_2 = x_212.tint_symbol_8;
  tint_symbol_9_1 = x_212.tint_symbol_9;
  return;
}

struct tint_symbol_25_out {
  @builtin(position)
  tint_symbol_8_2_1 : vec4f,
  @location(0)
  tint_symbol_9_1_1 : f32,
}

@vertex
fn vertexMain(@location(0) tint_symbol_8_1_param : vec2f, @builtin(instance_index) tint_symbol_26_1_param : u32) -> tint_symbol_25_out {
  tint_symbol_8_1 = tint_symbol_8_1_param;
  tint_symbol_26_1 = tint_symbol_26_1_param;
  tint_symbol_25_1();
  return tint_symbol_25_out(tint_symbol_8_2, tint_symbol_9_1);
}

fn tint_symbol_37_inner(tint_symbol_9 : f32) -> vec4f {
  return (vec4f(0.93333333730697631836f, 0.46274510025978088379f, 0.13725490868091583252f, 1.0f) * tint_symbol_9);
}

fn tint_symbol_37_1() {
  let x_229 = tint_symbol_9_2;
  let x_228 = tint_symbol_37_inner(x_229);
  value = x_228;
  return;
}

struct tint_symbol_37_out {
  @location(0)
  value_1 : vec4f,
}

@fragment
fn fragmentMain(@location(0) tint_symbol_9_2_param : f32) -> tint_symbol_37_out {
  tint_symbol_9_2 = tint_symbol_9_2_param;
  tint_symbol_37_1();
  return tint_symbol_37_out(value);
}

fn tint_symbol_38_inner(tint_symbol_32 : vec3u) {
  let x_234 = tint_symbol_32.x;
  let x_235 = tint_symbol_32.y;
  let x_240 = tint_symbol.inner[((x_235 * 10u) + (x_234 + 1u))];
  let x_245 = tint_symbol.inner[((x_235 * 10u) + (x_234 - 1u))];
  let x_251 = tint_symbol.inner[(((x_235 + 1u) * 10u) + x_234)];
  let x_257 = tint_symbol.inner[(((x_235 - 1u) * 10u) + x_234)];
  let x_260 = ((x_235 * 10u) + x_234);
  let x_261 = tint_mod((x_260 + (((x_240 + x_245) + x_251) + x_257)), 2u);
  if ((x_261 == 1u)) {
    tint_symbol_1.inner[x_260] = 1u;
  } else {
    tint_symbol_1.inner[x_260] = 0u;
  }
  return;
}

fn tint_symbol_38_1() {
  let x_273 = tint_symbol_32_1;
  tint_symbol_38_inner(x_273);
  return;
}

@compute @workgroup_size(4i, 4i, 1i)
fn computeMain(@builtin(global_invocation_id) tint_symbol_32_1_param : vec3u) {
  tint_symbol_32_1 = tint_symbol_32_1_param;
  tint_symbol_38_1();
}
