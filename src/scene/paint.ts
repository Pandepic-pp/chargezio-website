import * as THREE from 'three'
import { ARCH_R, AXLE_X, WHEEL_R, PORT_X, PORT_Y } from './carShape'

// Shared, mutable uniforms. The scene updates these each frame (lamps wake up when the car starts).
export const carUniforms = {
  uHead: { value: 0 }, // headlamp daytime running lights
  uTail: { value: 0 }, // tail lamp brightness
  uCharge: { value: 0 }, // charging glow on the port flap outline
  uAtlas: { value: null as THREE.Texture | null },
}

const COMMON = /* glsl */ `
varying vec3 vP;
varying vec3 vN0;
varying float vTh;
float cov(float d){ float w = fwidth(d) * 0.75 + 1e-5; return 1.0 - smoothstep(-w, w, d); }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdRBox(vec2 p, vec2 b, float r){ return sdBox(p, b - r) - r; }
float sdCap(vec2 p, vec2 a, vec2 b, float ra, float rb){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float sdSeg(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
`

const VERT_COMMON = /* glsl */ `
varying vec3 vP;
varying vec3 vN0;
varying float vTh;
attribute float aTh;
`

function patchVertex(shader: THREE.WebGLProgramParametersWithUniforms, withTh: boolean) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + VERT_COMMON)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n vP = position; vN0 = normal; vTh = ' + (withTh ? 'aTh' : '0.0') + ';')
}

// ---------------------------------------------------------------- body paint

const BODY_COLOR = /* glsl */ `
vec3 P = vP;
float az = abs(P.z);
vec3 Nn = normalize(vN0);
float px = 0.0015;

// Wheel arches are real holes in the skin (the liner and the tyre show through).
float archD = min(length(P.xy - vec2(${AXLE_X.toFixed(3)}, ${WHEEL_R})), length(P.xy - vec2(-${AXLE_X.toFixed(3)}, ${WHEEL_R})));
if (az > 0.45 && archD < ${ARCH_R}) discard;

// Charge port opening on the near rear quarter.
vec2 pc = P.xy - vec2(${PORT_X}, ${PORT_Y});
float portD = sdRBox(pc, vec2(0.098, 0.108), 0.028);
if (P.z > 0.3 && P.x < -1.8 && portD < 0.0) discard;

float sideM = smoothstep(0.45, 0.8, abs(Nn.z));
float topM = smoothstep(0.55, 0.85, Nn.y);
float under = smoothstep(-0.2, -0.5, Nn.y);

// Lower plastic trim: sills, bumper valances and the underside.
float yTrim = 0.315 + 0.24 * smoothstep(1.8, 2.12, abs(P.x));
float trim = 1.0 - smoothstep(yTrim - 0.004, yTrim + 0.004, P.y);
trim = max(trim, under);

// Panel gaps (door cuts, hood, trunk, charge flap).
float gap = 0.0;
vec2 sq = P.xy;
float lw = 0.0022;
gap = max(gap, sideM * cov(sdSeg(sq, vec2(0.905, 0.958), vec2(0.875, 0.32)) - lw));
gap = max(gap, sideM * cov(sdSeg(sq, vec2(-0.205, 0.962), vec2(-0.255, 0.32)) - lw));
gap = max(gap, sideM * cov(sdSeg(sq, vec2(-1.235, 0.972), vec2(-1.19, 0.745)) - lw));
vec2 tq = vec2(P.x, az);
float hood = 0.0;
hood = max(hood, cov(sdSeg(tq, vec2(0.93, 0.0), vec2(0.93, 0.7)) - lw));
hood = max(hood, cov(sdSeg(tq, vec2(0.93, 0.7), vec2(2.08, 0.62)) - lw));
hood = max(hood, cov(sdSeg(tq, vec2(-1.975, 0.0), vec2(-1.975, 0.66)) - lw));
hood = max(hood, cov(sdSeg(tq, vec2(-1.975, 0.66), vec2(-2.16, 0.58)) - lw));
gap = max(gap, topM * hood);
float flapLine = cov(abs(sdRBox(pc, vec2(0.1075, 0.1175), 0.032)) - 0.0008);
gap = max(gap, step(0.3, P.z) * step(P.x, -1.8) * flapLine * 0.7);

// Brand stripe along the lower doors.
float stripe = (1.0 - smoothstep(0.0055, 0.0085, abs(P.y - 0.475))) * sideM;
stripe *= smoothstep(-2.05, -1.9, P.x) * (1.0 - smoothstep(1.9, 2.05, P.x));
stripe *= 1.0 - trim;

// Headlamps (front) and tail lamps (rear) are painted as glass with an LED line.
vec2 lq = vec2(az, P.y);
float frontZ = smoothstep(1.8, 1.9, P.x);
float rearZ = smoothstep(-1.8, -1.9, P.x);
float headD = sdCap(lq, vec2(0.81, 0.640), vec2(0.4, 0.675), 0.031, 0.011);
float headLens = cov(headD) * frontZ;
float drl = cov(sdCap(lq, vec2(0.78, 0.656), vec2(0.43, 0.681), 0.0062, 0.0032)) * frontZ;
float tailD = min(sdCap(lq, vec2(0.82, 0.805), vec2(0.45, 0.838), 0.05, 0.022), sdCap(lq, vec2(0.46, 0.838), vec2(0.0, 0.838), 0.02, 0.02));
float tailLens = cov(tailD) * rearZ;
float tailLed = cov(sdCap(lq, vec2(0.8, 0.838), vec2(0.0, 0.846), 0.0085, 0.0075)) * rearZ;
float reverseL = cov(sdBox(lq - vec2(0.62, 0.545), vec2(0.06, 0.012))) * rearZ;
float frontFace = smoothstep(0.15, 0.4, Nn.x) * step(1.95, P.x);
float rearFace = smoothstep(0.15, 0.4, -Nn.x) * step(P.x, -2.0);

// Number plates and badges come from a small atlas texture.
vec4 plate = vec4(0.0);
vec2 fpq = vec2((-P.z) / 0.52 + 0.5, (P.y - 0.43) / 0.116 + 0.5);
if (frontFace > 0.0 && fpq.x > 0.0 && fpq.x < 1.0 && fpq.y > 0.0 && fpq.y < 1.0) plate = texture2D(uAtlas, vec2(fpq.x * 0.5, 0.55 + fpq.y * 0.45)) * frontFace;
vec2 rpq = vec2(P.z / 0.52 + 0.5, (P.y - 0.60) / 0.116 + 0.5);
if (rearFace > 0.0 && rpq.x > 0.0 && rpq.x < 1.0 && rpq.y > 0.0 && rpq.y < 1.0) plate = texture2D(uAtlas, vec2(0.5 + rpq.x * 0.5, 0.55 + rpq.y * 0.45)) * rearFace;
vec2 wpq = vec2(P.z / 0.34 + 0.5, (P.y - 0.735) / 0.07 + 0.5);
vec4 word = vec4(0.0);
if (rearFace > 0.0 && wpq.x > 0.0 && wpq.x < 1.0 && wpq.y > 0.0 && wpq.y < 1.0) word = texture2D(uAtlas, vec2(wpq.x * 0.5, 0.05 + wpq.y * 0.42)) * rearFace;
vec2 bpq = vec2((-P.z) / 0.19 + 0.5, (P.y - 0.585) / 0.1 + 0.5);
vec4 badge = vec4(0.0);
if (frontFace > 0.0 && bpq.x > 0.0 && bpq.x < 1.0 && bpq.y > 0.0 && bpq.y < 1.0) badge = texture2D(uAtlas, vec2(0.5 + bpq.x * 0.2, 0.05 + bpq.y * 0.42)) * frontFace;

vec3 paintCol = diffuseColor.rgb;
diffuseColor.rgb = mix(paintCol, vec3(0.016, 0.018, 0.022), trim);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0015, 0.533, 0.098), stripe);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.006, 0.008, 0.012), headLens);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.008, 0.014), tailLens);
diffuseColor.rgb = mix(diffuseColor.rgb, plate.rgb, plate.a);
diffuseColor.rgb = mix(diffuseColor.rgb, word.rgb, word.a * 0.9);
diffuseColor.rgb = mix(diffuseColor.rgb, badge.rgb, badge.a);
diffuseColor.rgb *= 1.0 - 0.9 * gap;
`

const BODY_ROUGH = /* glsl */ `
roughnessFactor = mix(roughnessFactor, 0.62, trim);
roughnessFactor = mix(roughnessFactor, 0.05, max(headLens, tailLens));
roughnessFactor = mix(roughnessFactor, 0.5, max(plate.a, word.a));
roughnessFactor = mix(roughnessFactor, 0.9, gap);
`

const BODY_EMIT = /* glsl */ `
totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * drl * (0.25 + 2.2 * uHead);
totalEmissiveRadiance += vec3(1.0, 0.05, 0.07) * tailLed * (0.18 + 2.6 * uTail);
totalEmissiveRadiance += vec3(1.0, 0.1, 0.1) * tailLens * 0.05 * (0.4 + uTail);
totalEmissiveRadiance += vec3(1.0, 1.0, 1.0) * reverseL * 0.12;
totalEmissiveRadiance += vec3(0.02, 0.9, 0.35) * flapLine * step(0.3, P.z) * uCharge * 1.6;
`

export function makeBodyMaterial(high: boolean) {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#f1f3f4',
    roughness: 0.3,
    metalness: 0,
    clearcoat: high ? 1 : 0,
    clearcoatRoughness: 0.06,
  })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, carUniforms)
    patchVertex(sh, false)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMMON + '\nuniform float uHead; uniform float uTail; uniform float uCharge; uniform sampler2D uAtlas;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + BODY_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + BODY_ROUGH)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + BODY_EMIT)
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\n material.clearcoat *= (1.0 - 0.85 * trim) * (1.0 - 0.7 * max(plate.a, word.a));\n#endif',
      )
  }
  m.customProgramCacheKey = () => 'czBody' + (high ? 'H' : 'L')
  return m
}

// ---------------------------------------------------------------- greenhouse (glass, roof, pillars)

const CABIN_COLOR = /* glsl */ `
vec3 P = vP;
float th = vTh;
float ax = P.x;
float ay = P.y;
float e = 0.0016;

// 1 inside [a, b]
#define BAND(v, a, b, w) (smoothstep((a) - (w), (a) + (w), v) * (1.0 - smoothstep((b) - (w), (b) + (w), v)))

float upper = smoothstep(-0.02, 0.02, th);
float sideZone = 1.0 - smoothstep(0.93, 0.97, th);      // flanks of the greenhouse
float topZone = 1.0 - sideZone;

// side windows: front door glass, B pillar, rear door glass
float winX = max(BAND(ax, -0.205, 0.905, e), BAND(ax, -1.30, -0.315, e));
float winOuter = winX * BAND(ay, 0.968, 5.0, e) * (1.0 - smoothstep(0.9, 0.94, th)) * upper;
float winInner = max(BAND(ax, -0.19, 0.89, e), BAND(ax, -1.285, -0.33, e)) * BAND(ay, 0.988, 5.0, e) * (1.0 - smoothstep(0.84, 0.88, th)) * upper;
float sideGlass = winInner * sideZone;
float sideFrame = max(winOuter - winInner, 0.0) * sideZone;

// windshield, roof and rear glass (top surfaces)
float wsOuter = BAND(ax, 0.22, 1.0, e);
float wsInner = BAND(ax, 0.235, 0.985, e) * smoothstep(0.97, 1.0, th);
float rgOuter = BAND(ax, -2.1, -1.19, e);
float rgInner = BAND(ax, -2.085, -1.205, e) * smoothstep(0.97, 1.0, th);
float topGlass = max(wsInner, rgInner) * topZone;
float roofPanel = BAND(ax, -1.19, 0.22, e) * topZone;

// C pillar / sail panel stays body coloured, everything else around the glass is gloss black.
float sail = (1.0 - smoothstep(-1.31, -1.29, ax)) * sideZone * upper;

float glass = max(sideGlass, topGlass);
float isRoof = roofPanel;

vec3 paintCol = vec3(0.89, 0.9, 0.91);
vec3 blackCol = vec3(0.008, 0.009, 0.012);
vec3 col = blackCol;
col = mix(col, paintCol, sail);
col = mix(col, vec3(0.016, 0.02, 0.028), isRoof);
// belt chrome
float beltLine = BAND(ay, 0.962, 0.985, e) * sideZone * upper;
col = mix(col, vec3(0.45, 0.47, 0.5), beltLine * (1.0 - sail));
diffuseColor.rgb = mix(col, vec3(0.004, 0.006, 0.009), glass);
float glassA = glass * 0.7;
diffuseColor.a = 1.0 - glassA;
`

const CABIN_ROUGH = /* glsl */ `
roughnessFactor = mix(0.18, 0.04, max(glass, isRoof));
roughnessFactor = mix(roughnessFactor, 0.35, beltLine);
`
const CABIN_METAL = /* glsl */ `
metalnessFactor = mix(0.0, 0.8, beltLine * (1.0 - sail));
`

export function makeCabinMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.1,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.05,
    transparent: true,
    // Glass keeps its full reflection and only dims what is behind it.
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    envMapIntensity: 1.0,
  })
  m.onBeforeCompile = (sh) => {
    patchVertex(sh, true)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMMON)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + CABIN_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + CABIN_ROUGH)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + CABIN_METAL)
  }
  m.customProgramCacheKey = () => 'czCabin'
  return m
}
