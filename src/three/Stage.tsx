import * as THREE from 'three';
import { useMemo } from 'react';

/**
 * Restrained lighting and a graphic backdrop.
 *
 * The cel material does its own single-direction shading, so these lights
 * exist for the floor and for a little bounce — not to light the character.
 * That keeps the look flat and drawn instead of drifting toward render-y.
 */
export function Stage({ light }: { light: boolean }) {
  // Backdrop: a large inward-facing sphere with a vertical ink gradient and a
  // single hard graphic disc behind the figure, for the negative-space look.
  const backdrop = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTop: { value: new THREE.Color('#111115') },
          uBottom: { value: new THREE.Color('#1c1b1e') },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uBottom;
          varying vec2 vUv;
          void main() {
            gl_FragColor = vec4(mix(uBottom, uTop, smoothstep(0.25, 0.9, vUv.y)), 1.0);
            #include <colorspace_fragment>
          }
        `,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  );

  return (
    <group>
      <mesh>
        <sphereGeometry args={[22, 24, 16]} />
        <primitive object={backdrop} attach="material" />
      </mesh>

      {/* The vermilion disc: a flat graphic shape, not a light source. */}
      <mesh position={[0, 1.2, -4.2]}>
        <circleGeometry args={[1.25, 64]} />
        <meshBasicMaterial color="#6d1521" />
      </mesh>

      <ambientLight intensity={0.45} />
      <directionalLight position={[-3, 5, 4]} intensity={0.8} castShadow={!light} />
      <directionalLight position={[3, 2, -3]} intensity={0.25} color="#8fb6d9" />

      {/* Floor: dark, matte, just enough to ground the figure. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[20, 64]} />
        <meshStandardMaterial color="#0e0e11" roughness={0.95} metalness={0} />
      </mesh>

      {/* A single contact ring, which reads as a drawn ground line. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <ringGeometry args={[1.28, 1.31, 64]} />
        <meshBasicMaterial color="#2e2d31" />
      </mesh>
    </group>
  );
}
