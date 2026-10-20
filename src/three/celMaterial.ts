import * as THREE from 'three';

/**
 * Cel shading with hard tone bands plus a thin rim, and a separate
 * inverted-hull outline material.
 *
 * Why hand-written rather than MeshToonMaterial: we want control over the
 * number of bands, the shadow hue (manga shading is tinted, not just darker),
 * and a rim that reads as drawn light rather than a specular highlight.
 * Lighting is a single fixed key direction so the look stays art-directed
 * instead of shifting as the camera orbits.
 */

const KEY_LIGHT = new THREE.Vector3(-0.45, 0.8, 0.6).normalize();

export interface CelOptions {
  color: THREE.ColorRepresentation;
  /** Hue the shadow bands lean toward. Manga shadow is cool and inky. */
  shadowTint?: THREE.ColorRepresentation;
  /** Number of hard bands, 2 or 3 reads best. */
  bands?: number;
  /** 0 disables the rim. */
  rim?: number;
  rimColor?: THREE.ColorRepresentation;
  /** Slight darkening of the lowest band, 0..1. */
  ambient?: number;
}

const vertexShader = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    // Normal matrix handles the non-uniform scale we apply for breathing.
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uShadow;
  uniform vec3 uRimColor;
  uniform vec3 uLightDir;
  uniform float uBands;
  uniform float uRim;
  uniform float uAmbient;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    vec3 n = normalize(vNormalW);
    float ndl = dot(n, normalize(uLightDir)) * 0.5 + 0.5;

    // Quantise into hard bands. The small bias keeps the terminator off the
    // exact silhouette edge, where it would fight the outline.
    float stepped = floor(ndl * uBands + 0.35) / max(uBands - 1.0, 1.0);
    stepped = clamp(stepped, 0.0, 1.0);

    vec3 lit = mix(uShadow * (1.0 - uAmbient), uColor, stepped);

    // Rim: a drawn edge light, strongest where the surface turns away.
    float fres = pow(1.0 - clamp(dot(n, normalize(vViewDir)), 0.0, 1.0), 3.0);
    lit += uRimColor * fres * uRim;

    gl_FragColor = vec4(lit, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createCelMaterial(opts: CelOptions): THREE.ShaderMaterial {
  const base = new THREE.Color(opts.color);
  const shadow = new THREE.Color(opts.shadowTint ?? base.clone().multiplyScalar(0.42));
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: base },
      uShadow: { value: shadow },
      uRimColor: { value: new THREE.Color(opts.rimColor ?? '#ffffff') },
      uLightDir: { value: KEY_LIGHT.clone() },
      uBands: { value: opts.bands ?? 3 },
      uRim: { value: opts.rim ?? 0.28 },
      uAmbient: { value: opts.ambient ?? 0.25 },
    },
    vertexShader,
    fragmentShader,
  });
}

/**
 * Inverted-hull outline. The vertex is pushed along its normal by an amount
 * scaled with view distance, so the line keeps a near-constant screen weight
 * instead of thinning out as the camera pulls back.
 */
export function createOutlineMaterial(thickness = 0.0055): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uThickness: { value: thickness }, uColor: { value: new THREE.Color('#0b0b0d') } },
    vertexShader: /* glsl */ `
      uniform float uThickness;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec3 n = normalize(mat3(modelMatrix) * normal);
        float dist = length(cameraPosition - world.xyz);
        world.xyz += n * uThickness * dist;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() { gl_FragColor = vec4(uColor, 1.0); }
    `,
    side: THREE.BackSide,
  });
}

/** Art-directed palette, taken from the brief's colour direction. */
export const palette = {
  skin: '#e9d5bd',
  skinShadow: '#b2866b',
  hair: '#eef1f4',
  hairShadow: '#8e9aa8',
  trouser: '#cf4a1e',
  trouserShadow: '#6e2410',
  sash: '#16161a',
  sashShadow: '#000000',
  wrap: '#1c1c20',
  ivory: '#f2ece0',
  vermilion: '#d7263d',
  ink: '#0b0b0d',
  silver: '#c9d2dc',
} as const;
