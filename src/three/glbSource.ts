import * as THREE from 'three';
import { character, type ClipKey } from '../config/assets';

/**
 * GLB clip resolution and rig verification.
 *
 * Generated-asset pipelines (Higgsfield/Meshy among them) return ONE clip per
 * job, so a multi-clip character arrives as several files. These helpers merge
 * the extra files' clips onto the primary skeleton and report — rather than
 * silently paper over — a rig that does not match.
 */

export interface RigReport {
  meshes: string[];
  materials: string[];
  boneCount: number;
  boneNames: string[];
  clips: Array<{ name: string; duration: number }>;
  /** Clips whose tracks address bones the primary skeleton does not have. */
  incompatibleClips: string[];
  warnings: string[];
  morphTargets: string[];
}

/** Bone names present anywhere under a root. */
export function collectBones(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) names.push(o.name);
  });
  return names;
}

/**
 * Checks a clip's tracks against a set of available node names. A clip whose
 * tracks address unknown bones will animate nothing, so it is better to flag
 * it than to let it play as a frozen pose.
 */
export function clipTargetsMatch(clip: THREE.AnimationClip, available: Set<string>): boolean {
  let hits = 0;
  for (const track of clip.tracks) {
    const node = track.name.split('.')[0];
    if (available.has(node)) hits++;
  }
  // Demand a real majority: a couple of incidental matches is not a shared rig.
  return clip.tracks.length > 0 && hits / clip.tracks.length > 0.6;
}

export function buildRigReport(
  root: THREE.Object3D,
  clips: THREE.AnimationClip[],
): RigReport {
  const meshes: string[] = [];
  const materials = new Set<string>();
  const morphTargets = new Set<string>();

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      meshes.push(mesh.name || '(unnamed)');
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) if (m) materials.add(m.name || m.type);
      if (mesh.morphTargetDictionary) {
        for (const key of Object.keys(mesh.morphTargetDictionary)) morphTargets.add(key);
      }
    }
  });

  const boneNames = collectBones(root);
  const available = new Set<string>();
  root.traverse((o) => { if (o.name) available.add(o.name); });

  const incompatibleClips = clips
    .filter((c) => !clipTargetsMatch(c, available))
    .map((c) => c.name);

  const warnings: string[] = [];
  if (boneNames.length === 0) {
    warnings.push('No skeleton found. This GLB is a static mesh — no clip can play on it.');
  }
  if (clips.length === 0) {
    warnings.push('No animation clips found in this GLB.');
  }
  if (incompatibleClips.length > 0) {
    warnings.push(
      `${incompatibleClips.length} clip(s) address bones that are not in this skeleton: ${incompatibleClips.join(', ')}.`,
    );
  }
  if (morphTargets.size === 0) {
    warnings.push('No morph targets: blinking cannot be driven from the face. Set blinkMorph to null.');
  }

  return {
    meshes,
    materials: [...materials],
    boneCount: boneNames.length,
    boneNames,
    clips: clips.map((c) => ({ name: c.name, duration: c.duration })),
    incompatibleClips,
    warnings,
    morphTargets: [...morphTargets],
  };
}

/**
 * Builds the logical-key to clip lookup from the config mapping, falling back
 * to a case-insensitive name match so a GLB whose clip is literally called
 * "idle" works without an explicit mapping entry.
 */
export function makeClipResolver(clips: THREE.AnimationClip[]) {
  const byName = new Map<string, THREE.AnimationClip>();
  for (const clip of clips) byName.set(clip.name.toLowerCase(), clip);

  return (key: ClipKey): THREE.AnimationClip | null => {
    const mapped = character.clipNames[key];
    if (mapped) {
      for (const name of mapped) {
        const hit = byName.get(name.toLowerCase());
        if (hit) return hit;
      }
    }
    return byName.get(key.toLowerCase()) ?? null;
  };
}

/**
 * Strips translation from every track except the root's, and flattens the
 * root's X/Z. Generated clips very often carry forward motion baked into the
 * hips, which reads as the character sliding away from the camera.
 */
export function stripRootMotion(clip: THREE.AnimationClip, rootName: string): THREE.AnimationClip {
  const tracks = clip.tracks.filter((track) => {
    const [node, prop] = track.name.split('.');
    if (prop !== 'position') return true;
    return node === rootName;
  });

  for (const track of tracks) {
    const [node, prop] = track.name.split('.');
    if (prop === 'position' && node === rootName) {
      const values = track.values as Float32Array;
      // Keep Y (vertical motion is wanted for hover), zero the drift.
      for (let i = 0; i < values.length; i += 3) {
        values[i] = 0;
        values[i + 2] = 0;
      }
    }
  }

  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}
