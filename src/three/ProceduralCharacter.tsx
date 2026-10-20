import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildBody, buildProceduralClips, buildSkeleton } from './proceduralCharacter';
import { AnimationMachine } from './animationMachine';
import { useAnimationDriver } from './useAnimationDriver';
import { useCharacterStore } from '../state/useCharacterStore';
import { useUiStore } from '../state/useUiStore';
import type { CharacterSourceProps } from './characterSource';

/** Head tracking is clamped to angles a neck actually reaches. */
const MAX_YAW = THREE.MathUtils.degToRad(28);
const MAX_PITCH = THREE.MathUtils.degToRad(15);

/**
 * The procedural stand-in: a real bone hierarchy with authored clips, used
 * until a verified GLB is configured. It is labelled as a stand-in in the UI.
 */
export function ProceduralCharacter({ onReady, light = false, reduced = false }: CharacterSourceProps) {
  const camera = useThree((s) => s.camera);
  const paused = useCharacterStore((s) => s.paused);
  const setSceneReady = useUiStore((s) => s.setSceneReady);

  const built = useMemo(() => {
    const rig = buildSkeleton();
    const body = buildBody(rig, !light);
    const clips = buildProceduralClips();
    const container = new THREE.Group();
    container.add(rig.root);
    return { rig, body, clips, container };
  }, [light]);

  const machine = useMemo(() => {
    const byName = new Map(built.clips.map((c) => [c.name, c]));
    return new AnimationMachine(built.container, (key) => byName.get(key) ?? null);
  }, [built]);

  useAnimationDriver(machine, reduced);

  useEffect(() => {
    onReady?.({
      bones: new Map<string, THREE.Object3D>(built.rig.bones),
      clips: built.clips.map((c) => ({ name: c.name, duration: c.duration })),
      source: 'procedural',
      warnings: [],
      missingClips: [],
    });
    setSceneReady(true);
    return () => {
      machine.dispose();
      built.body.dispose();
    };
  }, [machine, built, onReady, setSceneReady]);

  const blink = useRef({ next: 2.4, closing: 0, t: 0 });
  const headTrack = useRef(new THREE.Quaternion());
  const tmpVec = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    // Clamp: a backgrounded tab must not resume with one huge step that
    // teleports the animation through the middle of a transition.
    const dt = Math.min(delta, 1 / 20);
    machine.update(dt);
    if (paused || reduced) return;

    const head = built.rig.bones.get('Head');
    if (head && !light) {
      head.updateMatrixWorld();
      tmpVec.current.setFromMatrixPosition(head.matrixWorld);
      const toCam = camera.position.clone().sub(tmpVec.current);
      const parent = head.parent!;
      const local = toCam.applyQuaternion(
        parent.getWorldQuaternion(new THREE.Quaternion()).invert(),
      );
      const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -MAX_YAW, MAX_YAW);
      const pitch = THREE.MathUtils.clamp(
        -Math.atan2(local.y, Math.hypot(local.x, local.z)),
        -MAX_PITCH,
        MAX_PITCH,
      );
      headTrack.current.setFromEuler(new THREE.Euler(pitch * 0.45, yaw * 0.5, 0, 'XYZ'));
      head.quaternion.multiply(headTrack.current);
    }

    const b = blink.current;
    b.t += dt;
    if (b.closing > 0) {
      b.closing -= dt;
      const openness = b.closing > 0.06 ? 0.08 : 1;
      for (const eye of built.body.eyes) eye.scale.y = openness;
      if (b.closing <= 0) for (const eye of built.body.eyes) eye.scale.y = 1;
    } else if (b.t >= b.next) {
      b.closing = 0.12;
      b.t = 0;
      b.next = 2.2 + Math.random() * 3.4;
    }
  });

  return <primitive object={built.container} />;
}
