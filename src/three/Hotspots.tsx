import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { hotspots } from '../data/hotspots';
import { useUiStore } from '../state/useUiStore';

/**
 * Hotspots track the model: each marker's position is recomputed every frame
 * from the bone it is attached to, falling back to a static local anchor when
 * the loaded rig does not provide that bone.
 *
 * Touch usability: the visible marker is small, but an invisible larger
 * sphere carries the pointer events so the tap target stays comfortable on a
 * phone without making the marker itself heavy on screen.
 */
export function Hotspots({ bones }: { bones: Map<string, THREE.Object3D> | null }) {
  const active = useUiStore((s) => s.activeHotspot);
  const setHotspot = useUiStore((s) => s.setHotspot);
  const groupRefs = useRef<Record<string, THREE.Group | null>>({});
  const camera = useThree((s) => s.camera);
  const tmp = useRef(new THREE.Vector3());

  useFrame(() => {
    for (const spot of hotspots) {
      const group = groupRefs.current[spot.id];
      if (!group) continue;

      const bone = spot.bone ? bones?.get(spot.bone) : null;
      if (bone) {
        bone.updateWorldMatrix(true, false);
        tmp.current.setFromMatrixPosition(bone.matrixWorld);
        group.position.copy(tmp.current);
      } else {
        group.position.set(...spot.position);
      }
      // Face the camera so the ring never turns edge-on and vanish.
      group.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <group>
      {hotspots.map((spot) => {
        const isActive = active === spot.id;
        return (
          <group key={spot.id} ref={(el) => { groupRefs.current[spot.id] = el; }}>
            {/* Oversized invisible hit area for touch. */}
            <mesh
              onPointerDown={(e) => {
                e.stopPropagation();
                setHotspot(isActive ? null : spot.id);
              }}
              onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = ''; }}
            >
              <sphereGeometry args={[0.13, 8, 6]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            <mesh>
              <ringGeometry args={[0.042, 0.055, 24]} />
              <meshBasicMaterial
                color={isActive ? '#d7263d' : '#f2ece0'}
                transparent
                opacity={isActive ? 1 : 0.85}
                depthWrite={false}
              />
            </mesh>
            <mesh>
              <circleGeometry args={[0.018, 16]} />
              <meshBasicMaterial
                color={isActive ? '#d7263d' : '#f2ece0'}
                depthWrite={false}
              />
            </mesh>

            <Html
              center
              // No distanceFactor: a constant-size label stays legible at any
              // zoom and, being small, stops the five labels colliding.
              position={[0.1, 0.09, 0]}
              style={{ pointerEvents: 'none' }}
              zIndexRange={[20, 0]}
            >
              <span className={`hotspot-tag${isActive ? ' is-active' : ''}`}>{spot.label}</span>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
