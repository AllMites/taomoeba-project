// Shader materials for the microgravity flame. Additive, no post-processing pass, cheap enough for a phone.
import { AdditiveBlending, Color, DoubleSide, ShaderMaterial } from "three";
import { FX_PAINT } from "./palette.ts";

// Shell: a sphere (or ellipsoid) shaded by how much each point faces the camera. Facing points are the
// pale core; grazing points are the blue shell, so the shell is brightest at the edge, like the real
// flames filmed on the ISS. A faint orange band between them stands in for the soot ring.
const shellVertex = /* glsl */ `
  uniform float uTime;
  uniform float uLean;
  uniform float uFlicker;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 p = position;
    // Lean downstream (+x): stretch the downstream half, blunt the upstream half.
    float sx = p.x > 0.0 ? 1.0 + uLean : 1.0 - 0.3 * uLean;
    p.x *= sx;
    vec3 n = normalize(vec3(normal.x / sx, normal.y, normal.z));
    // Flicker: a slow wobble of the surface. Off when uFlicker is 0 (calm).
    float w = sin(uTime * 7.1 + p.y * 9.0) * sin(uTime * 5.3 + p.z * 7.0 + p.x * 4.0);
    p *= 1.0 + uFlicker * 0.05 * w;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * n);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const shellFragment = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uShell;
  uniform vec3 uSoot;
  uniform float uBright;
  uniform float uTime;
  uniform float uFlicker;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
    float edge = 1.0 - f;
    float shell = pow(edge, 1.5) * 1.4;
    float soot = exp(-pow((edge - 0.42) / 0.12, 2.0)) * 0.3;
    float core = pow(f, 3.0) * 0.12;
    float rim = smoothstep(0.0, 0.12, f);
    float pulse = 1.0 + uFlicker * 0.08 * sin(uTime * 11.0);
    vec3 col = (uShell * shell + uSoot * soot + uCore * core) * rim * uBright * pulse;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// Halo: a larger sphere whose facing points glow softly and fade to nothing at its silhouette.
const haloFragment = /* glsl */ `
  uniform vec3 uShell;
  uniform vec3 uSoot;
  uniform float uBright;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
    float g = pow(f, 2.6) * 0.32;
    vec3 col = mix(uShell, uSoot, 0.1) * g * uBright;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function makeShellMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLean: { value: 0 },
      uFlicker: { value: 1 },
      uBright: { value: 1 },
      uCore: { value: new Color(FX_PAINT.core) },
      uShell: { value: new Color(FX_PAINT.shell) },
      uSoot: { value: new Color(FX_PAINT.soot) },
    },
    vertexShader: shellVertex,
    fragmentShader: shellFragment,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

export function makeHaloMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLean: { value: 0 },
      uFlicker: { value: 0 },
      uBright: { value: 1 },
      uShell: { value: new Color(FX_PAINT.shell) },
      uSoot: { value: new Color(FX_PAINT.soot) },
    },
    vertexShader: shellVertex,
    fragmentShader: haloFragment,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

// Char trail: a unit strip (x 0..1 along the flow) laid on the sample. Dark char, mottled, with an
// ember band at the burning edge (x = 1) that glows warm and fades upstream.
const charVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const charFragment = /* glsl */ `
  uniform vec3 uChar;
  uniform vec3 uEmber;
  uniform float uGlow;
  uniform float uBandK;
  uniform float uTime;
  uniform float uSegments;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float d = 1.0 - vUv.x;
    float ember = exp(-d * uBandK) * uGlow;
    float m = hash(floor(vUv * vec2(uSegments, 5.0)));
    float shimmer = 0.8 + 0.2 * sin(uTime * 3.0 + vUv.y * 17.0);
    vec3 col = uChar * (0.55 + 0.45 * m) + uEmber * ember * shimmer;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function makeCharMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uChar: { value: new Color(FX_PAINT.char) },
      uEmber: { value: new Color(FX_PAINT.ember) },
      uGlow: { value: 1 },
      uBandK: { value: 10 },
      uTime: { value: 0 },
      uSegments: { value: 40 },
    },
    vertexShader: charVertex,
    fragmentShader: charFragment,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: false,
  });
}
