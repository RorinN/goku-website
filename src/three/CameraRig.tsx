import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useCameraStore } from '../state/useCameraStore';

/**
 * Controlled orbit: rotation and zoom within bounds, no panning. Panning is
 * what lets a visitor lose the character off-screen, so it stays off and
 * Reset view is always one control away.
 *
 * Preset moves are eased rather than snapped, and a user drag cancels the
 * move in progress so the controls never feel like they are fighting back.
 */

const FRAMING: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
  hero:     { pos: [1.8, 1.45, 3.9], target: [0, 0.95, 0] },
  explorer: { pos: [0.5, 1.3, 4.05], target: [0, 0.98, 0] },
  ability:  { pos: [2.2, 1.35, 3.45], target: [0, 0.95, 0] },
  transform:{ pos: [0, 1.35, 4.15], target: [0, 0.98, 0] },
  training: { pos: [1.5, 1.4, 3.95], target: [0, 0.95, 0] },
};

export function CameraRig({ enabled = true, reduced = false }: { enabled?: boolean; reduced?: boolean }) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const camera = useThree((s) => s.camera);
  const requested = useCameraStore((s) => s.requestedPreset);
  const consume = useCameraStore((s) => s.consume);
  const focus = useCameraStore((s) => s.focus);

  const move = useRef<{
    from: THREE.Vector3; to: THREE.Vector3;
    fromT: THREE.Vector3; toT: THREE.Vector3;
    t: number; dur: number;
  } | null>(null);

  const startMove = (key: string, duration: number) => {
    const framing = FRAMING[key] ?? FRAMING.hero;
    if (!controls.current) return;
    move.current = {
      from: camera.position.clone(),
      to: new THREE.Vector3(...framing.pos),
      fromT: controls.current.target.clone(),
      toT: new THREE.Vector3(...framing.target),
      t: 0,
      // Reduced motion gets an instant cut instead of a sweep.
      dur: reduced ? 0.001 : duration,
    };
  };

  useEffect(() => {
    if (!requested) return;
    if (requested === 'front') {
      if (!controls.current) return;
      move.current = {
        from: camera.position.clone(),
        to: new THREE.Vector3(0, 1.15, 4.05),
        fromT: controls.current.target.clone(),
        toT: new THREE.Vector3(0, 0.98, 0),
        t: 0,
        dur: reduced ? 0.001 : 0.9,
      };
    } else if (requested === 'reset') {
      startMove(focus, 0.9);
    }
    consume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, focus, reduced]);

  // Each section owns its default framing.
  useEffect(() => {
    startMove(focus, 1.2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // A manual drag wins: cancel any eased move so input is never overridden.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const cancel = () => { move.current = null; };
    c.addEventListener('start', cancel);
    return () => c.removeEventListener('start', cancel);
  }, []);

  useFrame((_, delta) => {
    const m = move.current;
    if (!m || !controls.current) return;
    m.t = Math.min(m.t + delta, m.dur);
    const u = m.dur <= 0.002 ? 1 : m.t / m.dur;
    const e = u * u * (3 - 2 * u);
    camera.position.lerpVectors(m.from, m.to, e);
    controls.current.target.lerpVectors(m.fromT, m.toT, e);
    controls.current.update();
    if (u >= 1) move.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      enabled={enabled}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.7}
      zoomSpeed={0.6}
      minDistance={2.2}
      maxDistance={6.5}
      // Stops the camera going under the floor or directly overhead.
      minPolarAngle={Math.PI * 0.14}
      maxPolarAngle={Math.PI * 0.52}
      target={[0, 0.95, 0]}
      makeDefault
    />
  );
}
