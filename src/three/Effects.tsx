import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCharacterStore } from '../state/useCharacterStore';
import { transformAssets } from '../config/assets';

/**
 * Aura, ki particles, ground glow and the beam are separate layers rather than
 * one baked effect, so each responds independently to the aura-intensity and
 * speed controls. Nothing here flashes or shakes the camera: brightness is
 * driven by smoothed values, and the motion is continuous.
 */

const vertexCommon = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/** Soft fresnel shell that sits around the silhouette. */
function useAuraMaterial(color: string) {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uIntensity: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: vertexCommon,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uIntensity;
          uniform float uTime;
          varying vec3 vNormalW;
          varying vec3 vViewDir;
          varying vec2 vUv;

          void main() {
            float fres = pow(1.0 - clamp(dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0), 5.0);
            // Vertical licks of energy, continuous rather than strobing.
            float lick = sin(vUv.y * 22.0 - uTime * 3.2) * 0.5 + 0.5;
            lick = mix(0.65, 1.0, lick);
            float a = fres * uIntensity * lick;
            // Fade both ends so the shell has no hard rim top or bottom.
            a *= smoothstep(1.0, 0.62, vUv.y) * smoothstep(0.0, 0.14, vUv.y);
            gl_FragColor = vec4(uColor, a);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    [color],
  );
}

export function Aura({ light }: { light: boolean }) {
  const transform = useCharacterStore((s) => s.transform);
  const color = transformAssets[transform]?.auraColor ?? '#e8e2d6';
  const material = useAuraMaterial(color);
  const smoothed = useRef(0);

  useFrame((state, delta) => {
    const { auraIntensity, chargeLevel, paused } = useCharacterStore.getState();
    // Charging adds on top of the slider, so the press-and-hold reads visibly.
    const target = Math.min(1, auraIntensity * 0.85 + chargeLevel * 0.6);
    // Smoothing is what keeps this from flickering as values change.
    smoothed.current += (target - smoothed.current) * Math.min(delta * 4, 1);
    material.uniforms.uIntensity.value = smoothed.current * 0.42;
    if (!paused) material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  // Update the colour in place rather than rebuilding the material.
  useFrame(() => {
    (material.uniforms.uColor.value as THREE.Color).lerp(new THREE.Color(color), 0.08);
  });

  return (
    <mesh position={[0, 0.95, 0]} scale={light ? [1.06, 1.0, 1.06] : [1.1, 1.02, 1.1]}>
      <capsuleGeometry args={[0.42, 1.0, 6, 24]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Rising ki motes. Count drops hard in light mode. */
export function KiParticles({ light }: { light: boolean }) {
  const count = light ? 90 : 320;
  const transform = useCharacterStore((s) => s.transform);
  const color = transformAssets[transform]?.auraColor ?? '#e8e2d6';

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Seeded in a column around the body, denser low down.
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.22 + Math.pow(Math.random(), 0.6) * 0.5;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 1.9;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uSize: { value: light ? 14 : 20 },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uSize;
        varying float vFade;
        void main() {
          vec3 p = position;
          // Rise and loop. The modulo keeps the column populated forever
          // without respawning particles on the CPU.
          float speed = 0.5 + aSeed * 0.7;
          p.y = mod(p.y + uTime * speed, 2.1);
          // Drift inward as it rises, so the column tapers.
          float taper = 1.0 - p.y / 2.6;
          p.xz *= taper;
          p.x += sin(uTime * 1.6 + aSeed * 12.0) * 0.045;
          p.z += cos(uTime * 1.4 + aSeed * 9.0) * 0.045;

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * uIntensity * (1.0 / -mv.z) * (0.5 + aSeed * 0.8);
          vFade = (1.0 - p.y / 2.1) * uIntensity;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vFade;
        void main() {
          // Round, soft-edged mote.
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float a = (1.0 - d * 2.0) * vFade;
          gl_FragColor = vec4(uColor, a);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return { geometry: geo, material: mat };
  }, [count, light, color]);

  const smoothed = useRef(0);
  useFrame((state, delta) => {
    const { auraIntensity, chargeLevel, paused, speed } = useCharacterStore.getState();
    const target = Math.min(1, auraIntensity * 0.9 + chargeLevel * 0.7);
    smoothed.current += (target - smoothed.current) * Math.min(delta * 3.5, 1);
    material.uniforms.uIntensity.value = smoothed.current;
    (material.uniforms.uColor.value as THREE.Color).lerp(new THREE.Color(color), 0.08);
    if (!paused) material.uniforms.uTime.value = state.clock.elapsedTime * speed;
  });

  return <points geometry={geometry} material={material} />;
}

/** Ground bloom under the feet, tied to the same intensity. */
export function GroundGlow() {
  const transform = useCharacterStore((s) => s.transform);
  const color = transformAssets[transform]?.auraColor ?? '#e8e2d6';

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uIntensity: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uIntensity;
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float core = smoothstep(1.0, 0.0, d);
            // One slow expanding ring, not a pulse train.
            float ring = smoothstep(0.06, 0.0, abs(d - fract(uTime * 0.25)));
            float a = (core * 0.5 + ring * 0.35) * uIntensity;
            gl_FragColor = vec4(uColor, a);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [color],
  );

  const smoothed = useRef(0);
  useFrame((state, delta) => {
    const { auraIntensity, chargeLevel, paused } = useCharacterStore.getState();
    const target = Math.min(1, auraIntensity * 0.7 + chargeLevel * 0.8);
    smoothed.current += (target - smoothed.current) * Math.min(delta * 3, 1);
    material.uniforms.uIntensity.value = smoothed.current;
    (material.uniforms.uColor.value as THREE.Color).lerp(new THREE.Color(color), 0.08);
    if (!paused) material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
      <planeGeometry args={[3.2, 3.2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/**
 * The released beam. Driven by the ability flag rather than by a clip event,
 * so it stays decoupled from whichever asset is supplying the animation.
 */
export function Beam() {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
        vertexShader: vertexCommon,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uOpacity;
          varying vec2 vUv;
          void main() {
            // Hot white core falling off to a cooler edge.
            float radial = 1.0 - abs(vUv.x - 0.5) * 2.0;
            float core = pow(radial, 2.5);
            vec3 col = mix(vec3(0.44, 0.76, 1.0), vec3(1.0), core);
            float flow = sin(vUv.y * 30.0 - uTime * 14.0) * 0.08 + 0.92;
            gl_FragColor = vec4(col, core * uOpacity * flow);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  const strength = useRef(0);
  useFrame((state, delta) => {
    const { playingAbility, paused } = useCharacterStore.getState();
    // Only the Kamehameha fires a beam; everything else keeps it at zero.
    const target = playingAbility === 'kamehameha' ? 1 : 0;
    strength.current += (target - strength.current) * Math.min(delta * (target ? 5 : 3), 1);
    material.uniforms.uOpacity.value = strength.current;
    if (!paused) material.uniforms.uTime.value = state.clock.elapsedTime;
    if (ref.current) ref.current.visible = strength.current > 0.01;
  });

  return (
    <mesh ref={ref} position={[0, 1.08, 1.9]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <cylinderGeometry args={[0.17, 0.3, 3.6, 16, 1, true]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
