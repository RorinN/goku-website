import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { AnimationMachine } from './animationMachine';
import { useAnimationDriver } from './useAnimationDriver';
import { buildRigReport, makeClipResolver, stripRootMotion, clipTargetsMatch } from './glbSource';
import { character } from '../config/assets';
import { useCharacterStore } from '../state/useCharacterStore';
import { useUiStore } from '../state/useUiStore';
import type { CharacterSourceProps } from './characterSource';

const MAX_YAW = THREE.MathUtils.degToRad(28);
const MAX_PITCH = THREE.MathUtils.degToRad(15);

/** Every GLB the character needs: the rig, plus any extra single-clip files. */
const URLS = [character.url, ...character.additionalClipUrls];

/**
 * Loads the real character.
 *
 * Generated-asset pipelines return ONE clip per job, so a multi-clip character
 * arrives as several GLBs. This component loads them all, keeps the first
 * file's scene as the rig, and merges every other file's clips onto it —
 * dropping, with a warning, any clip whose tracks do not address this
 * skeleton. A clip that silently animates nothing is worse than a missing one,
 * because it looks like a frozen pose.
 */
export function GlbCharacter({ onReady, light = false, reduced = false }: CharacterSourceProps) {
  const camera = useThree((s) => s.camera);
  const paused = useCharacterStore((s) => s.paused);
  const setSceneReady = useUiStore((s) => s.setSceneReady);

  // URLS is a module constant, so this hook call is stable.
  const loaded = useGLTF(URLS) as unknown as Array<{
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
  }>;

  const built = useMemo(() => {
    const primary = loaded[0];
    // Clone so React strict-mode double-mounting cannot leave the cached
    // scene graph mutated by a previous mount's animation state.
    const scene = primary.scene.clone(true);

    const available = new Set<string>();
    scene.traverse((o) => { if (o.name) available.add(o.name); });

    const warnings: string[] = [];
    const clips: THREE.AnimationClip[] = [];
    const rootName = scene.children[0]?.name ?? scene.name;

    loaded.forEach((file, i) => {
      for (const clip of file.animations) {
        if (!clipTargetsMatch(clip, available)) {
          warnings.push(
            `Clip "${clip.name}" from ${URLS[i]} does not match this skeleton and was dropped.`,
          );
          continue;
        }
        clips.push(stripRootMotion(clip, rootName));
      }
    });

    const report = buildRigReport(scene, clips);
    warnings.push(...report.warnings);

    const bones = new Map<string, THREE.Object3D>();
    scene.traverse((o) => { if ((o as THREE.Bone).isBone) bones.set(o.name, o); });

    return { scene, clips, warnings, report, bones };
  }, [loaded]);

  const machine = useMemo(() => {
    const resolve = makeClipResolver(built.clips);
    return new AnimationMachine(built.scene, resolve);
  }, [built]);

  useAnimationDriver(machine, reduced);

  useEffect(() => {
    // Report what the asset ACTUALLY provides, so the UI can say so rather
    // than implying full coverage.
    onReady?.({
      bones: built.bones,
      clips: built.clips.map((c) => ({ name: c.name, duration: c.duration })),
      source: 'glb',
      warnings: built.warnings,
      missingClips: machine.missingKeys,
    });
    setSceneReady(true);
    return () => machine.dispose();
  }, [machine, built, onReady, setSceneReady]);

  // Release GPU memory for the cloned scene when this unmounts. The cached
  // original stays with drei; only the clone's own resources are ours.
  useEffect(() => {
    const scene = built.scene;
    return () => {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) m?.dispose();
      });
    };
  }, [built.scene]);

  const headBone = character.headBone ? built.bones.get(character.headBone) ?? null : null;
  const blink = useRef({ next: 2.6, closing: 0, t: 0 });
  const headTrack = useRef(new THREE.Quaternion());
  const tmpVec = useRef(new THREE.Vector3());

  // Blink only where the asset genuinely supports it.
  const blinkTargets = useMemo(() => {
    if (!character.blinkMorph) return [];
    const found: Array<{ mesh: THREE.Mesh; index: number }> = [];
    built.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.morphTargetDictionary) return;
      const index = mesh.morphTargetDictionary[character.blinkMorph!];
      if (index !== undefined) found.push({ mesh, index });
    });
    return found;
  }, [built.scene]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    machine.update(dt);
    if (paused || reduced) return;

    // Head tracking only when the config named a bone that actually exists.
    if (headBone && !light) {
      headBone.updateMatrixWorld();
      tmpVec.current.setFromMatrixPosition(headBone.matrixWorld);
      const toCam = camera.position.clone().sub(tmpVec.current);
      const parent = headBone.parent!;
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
      headBone.quaternion.multiply(headTrack.current);
    }

    if (blinkTargets.length > 0) {
      const b = blink.current;
      b.t += dt;
      if (b.closing > 0) {
        b.closing -= dt;
        const v = b.closing > 0.06 ? 1 : 0;
        for (const t of blinkTargets) {
          if (t.mesh.morphTargetInfluences) t.mesh.morphTargetInfluences[t.index] = v;
        }
      } else if (b.t >= b.next) {
        b.closing = 0.12;
        b.t = 0;
        b.next = 2.4 + Math.random() * 3.2;
      }
    }
  });

  return <primitive object={built.scene} />;
}

// Warm the cache so the model starts downloading with the bundle rather than
// after the scene mounts.
if (character.enabled) useGLTF.preload(URLS);
