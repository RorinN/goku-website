import * as THREE from 'three';
import { createCelMaterial, createOutlineMaterial, palette } from './celMaterial';
import type { ClipKey } from '../config/assets';

/**
 * Procedural stand-in character.
 *
 * This exists so the site is a working, genuinely 3D, genuinely animated
 * experience BEFORE any generated asset arrives — and so the animation state
 * machine is exercised against real THREE.AnimationClips on a real bone
 * hierarchy. It is labelled as a stand-in throughout the UI and is not
 * presented as the finished character.
 *
 * It is built to be swapped out, not to be kept:
 *  - Bone names follow the usual Mixamo/Meshy convention minus the prefix, so
 *    clips authored here and clips arriving on a generated rig address the
 *    same joints.
 *  - Clip names are exactly the ClipKey values the machine asks for, so a GLB
 *    that provides those names drops straight in.
 *
 * Two invariants are enforced by construction rather than by hand-tuning:
 *  - No root drift: the hips translation track never varies in X or Z.
 *  - Foot contact: for every grounded pose the hips height is SOLVED from
 *    forward kinematics so the sole lands on y=0, instead of being guessed.
 */

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

interface BoneDef {
  name: string;
  parent: string | null;
  pos: [number, number, number];
}

/** Rest layout: arms out along ±X, legs down along -Y. Metres. */
const BONE_DEFS: BoneDef[] = [
  { name: 'Hips', parent: null, pos: [0, 0.92, 0] },
  { name: 'Spine', parent: 'Hips', pos: [0, 0.12, 0] },
  { name: 'Spine1', parent: 'Spine', pos: [0, 0.13, 0] },
  { name: 'Spine2', parent: 'Spine1', pos: [0, 0.13, 0] },
  { name: 'Neck', parent: 'Spine2', pos: [0, 0.13, 0] },
  { name: 'Head', parent: 'Neck', pos: [0, 0.08, 0] },

  { name: 'LeftShoulder', parent: 'Spine2', pos: [0.06, 0.08, 0] },
  { name: 'LeftArm', parent: 'LeftShoulder', pos: [0.15, 0, 0] },
  { name: 'LeftForeArm', parent: 'LeftArm', pos: [0.28, 0, 0] },
  { name: 'LeftHand', parent: 'LeftForeArm', pos: [0.25, 0, 0] },

  { name: 'RightShoulder', parent: 'Spine2', pos: [-0.06, 0.08, 0] },
  { name: 'RightArm', parent: 'RightShoulder', pos: [-0.15, 0, 0] },
  { name: 'RightForeArm', parent: 'RightArm', pos: [-0.28, 0, 0] },
  { name: 'RightHand', parent: 'RightForeArm', pos: [-0.25, 0, 0] },

  { name: 'LeftUpLeg', parent: 'Hips', pos: [0.11, -0.06, 0] },
  { name: 'LeftLeg', parent: 'LeftUpLeg', pos: [0, -0.42, 0] },
  { name: 'LeftFoot', parent: 'LeftLeg', pos: [0, -0.4, 0] },

  { name: 'RightUpLeg', parent: 'Hips', pos: [-0.11, -0.06, 0] },
  { name: 'RightLeg', parent: 'RightUpLeg', pos: [0, -0.42, 0] },
  { name: 'RightFoot', parent: 'RightLeg', pos: [0, -0.4, 0] },

  // Sash tails, driven as secondary cloth motion.
  { name: 'SashL1', parent: 'Hips', pos: [0.1, -0.02, -0.07] },
  { name: 'SashL2', parent: 'SashL1', pos: [0, -0.16, 0] },
  { name: 'SashL3', parent: 'SashL2', pos: [0, -0.15, 0] },
  { name: 'SashR1', parent: 'Hips', pos: [-0.09, -0.03, -0.08] },
  { name: 'SashR2', parent: 'SashR1', pos: [0, -0.15, 0] },
  { name: 'SashR3', parent: 'SashR2', pos: [0, -0.14, 0] },
];

/** Distance from the ankle bone down to the sole, used for the ground solve. */
const SOLE_DROP = 0.075;

export interface Rig {
  root: THREE.Bone;
  bones: Map<string, THREE.Bone>;
}

export function buildSkeleton(): Rig {
  const bones = new Map<string, THREE.Bone>();
  let root: THREE.Bone | null = null;
  for (const def of BONE_DEFS) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    bone.position.set(...def.pos);
    bones.set(def.name, bone);
    if (def.parent === null) root = bone;
    else bones.get(def.parent)!.add(bone);
  }
  return { root: root!, bones };
}

// ---------------------------------------------------------------------------
// Body geometry
// ---------------------------------------------------------------------------

type Pose = Record<string, [number, number, number]>;

interface BuiltBody {
  meshes: THREE.Mesh[];
  outlines: THREE.Mesh[];
  eyes: THREE.Mesh[];
  dispose: () => void;
}

/**
 * Attaches geometry to the bones. Segments are parented to the bone they
 * follow and offset halfway toward the child joint, so a rotation on the bone
 * swings the segment the way a skinned limb would.
 */
export function buildBody(rig: Rig, withOutlines: boolean): BuiltBody {
  const meshes: THREE.Mesh[] = [];
  const outlines: THREE.Mesh[] = [];
  const eyes: THREE.Mesh[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const mat = (color: string, shadow: string, rim = 0.3) => {
    const m = createCelMaterial({ color, shadowTint: shadow, bands: 3, rim, rimColor: '#fff6e8' });
    materials.push(m);
    return m;
  };

  const skin = mat(palette.skin, palette.skinShadow, 0.22);
  const hair = mat(palette.hair, palette.hairShadow, 0.55);
  const trouser = mat(palette.trouser, palette.trouserShadow, 0.2);
  const sash = mat(palette.sash, palette.sashShadow, 0.35);
  const wrap = mat(palette.wrap, '#000000', 0.3);

  const add = (
    boneName: string,
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
  ) => {
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    rig.bones.get(boneName)!.add(mesh);
    meshes.push(mesh);

    if (withOutlines) {
      const outlineMat = createOutlineMaterial(0.0055);
      materials.push(outlineMat);
      const outline = new THREE.Mesh(geo, outlineMat);
      outline.position.copy(mesh.position);
      outline.rotation.copy(mesh.rotation);
      rig.bones.get(boneName)!.add(outline);
      outlines.push(outline);
    }
    return mesh;
  };

  /**
   * A ring of the swept profile: half-width in X, half-depth in Z, at height
   * y, optionally pushed along Z so a form can lean (chest forward, seat back).
   */
  interface Ring { y: number; rx: number; rz: number; dz?: number }

  /**
   * Sweeps a profile into a smooth, closed form.
   *
   * This is what replaces the capsule-per-bone build. A capsule can only be a
   * tube, so a body made of them reads as plumbing; a swept profile can carry
   * a deltoid, a pec shelf, a narrow waist and a gathered trouser cuff, which
   * is what actually makes the silhouette look drawn rather than assembled.
   */
  const sweep = (rings: Ring[], radial = 24, capTop = true, capBottom = true) => {
    const positions: number[] = [];
    const indices: number[] = [];
    const ringStart: number[] = [];

    for (const ring of rings) {
      ringStart.push(positions.length / 3);
      for (let i = 0; i < radial; i++) {
        const a = (i / radial) * Math.PI * 2;
        positions.push(
          Math.cos(a) * ring.rx,
          ring.y,
          Math.sin(a) * ring.rz + (ring.dz ?? 0),
        );
      }
    }

    for (let r = 0; r < rings.length - 1; r++) {
      const a0 = ringStart[r];
      const b0 = ringStart[r + 1];
      for (let i = 0; i < radial; i++) {
        const j = (i + 1) % radial;
        indices.push(a0 + i, b0 + i, a0 + j);
        indices.push(a0 + j, b0 + i, b0 + j);
      }
    }

    // Caps: a single apex vertex each, which keeps the ends rounded-off
    // rather than showing a flat disc edge.
    if (capBottom) {
      const first = rings[0];
      const apex = positions.length / 3;
      positions.push(0, first.y - Math.min(first.rx, first.rz) * 0.85, first.dz ?? 0);
      for (let i = 0; i < radial; i++) {
        const j = (i + 1) % radial;
        indices.push(apex, ringStart[0] + j, ringStart[0] + i);
      }
    }
    if (capTop) {
      const last = rings[rings.length - 1];
      const apex = positions.length / 3;
      positions.push(0, last.y + Math.min(last.rx, last.rz) * 0.85, last.dz ?? 0);
      const base = ringStart[rings.length - 1];
      for (let i = 0; i < radial; i++) {
        const j = (i + 1) % radial;
        indices.push(apex, base + i, base + j);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  };

  /** Sweeps along a bone's direction rather than along +Y. */
  /**
   * Sweeps along a bone's direction. NOTE: ring `y` is distance ALONG the
   * bone, measured from the joint, and is therefore always positive — the
   * rotation below maps +Y onto the bone direction, so a negative value
   * places geometry on the far side of the joint.
   */
  const sweepAlong = (
    boneName: string,
    to: [number, number, number],
    rings: Ring[],
    material: THREE.Material,
    radial = 20,
  ) => {
    const v = new THREE.Vector3(...to);
    const geo = sweep(rings, radial);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      v.clone().normalize(),
    );
    const e = new THREE.Euler().setFromQuaternion(q);
    return add(boneName, geo, material, [0, 0, 0], [e.x, e.y, e.z]);
  };

  // --- Torso -------------------------------------------------------------
  // One continuous profile split across four bones. Radii MATCH at every
  // split, so the seams are invisible while the spine is near-straight and
  // the whole thing still deforms with the breathing and sway tracks.
  //
  // Reference silhouette: very broad lats and chest, narrow waist, heavy
  // hip flare where the sash sits.
  add('Hips', sweep([
    { y: -0.10, rx: 0.138, rz: 0.108, dz: -0.012 },
    { y: -0.05, rx: 0.160, rz: 0.118, dz: -0.014 },
    { y:  0.00, rx: 0.166, rz: 0.118, dz: -0.008 },
    { y:  0.06, rx: 0.152, rz: 0.106 },
  ], 28, false, true), skin);

  add('Spine', sweep([
    { y: -0.06, rx: 0.152, rz: 0.106 },
    { y:  0.00, rx: 0.139, rz: 0.098 },
    { y:  0.065, rx: 0.146, rz: 0.100 },
  ], 28, false, false), skin);

  add('Spine1', sweep([
    { y: -0.065, rx: 0.146, rz: 0.100 },
    { y:  0.00, rx: 0.168, rz: 0.110 },
    { y:  0.065, rx: 0.196, rz: 0.118, dz: 0.004 },
  ], 28, false, false), skin);

  // Chest: the pec shelf and the trap slope into the neck.
  add('Spine2', sweep([
    { y: -0.065, rx: 0.196, rz: 0.118, dz: 0.004 },
    { y:  0.00, rx: 0.222, rz: 0.128, dz: 0.008 },
    { y:  0.045, rx: 0.228, rz: 0.130, dz: 0.010 },
    { y:  0.085, rx: 0.205, rz: 0.118, dz: 0.004 },
    { y:  0.125, rx: 0.150, rz: 0.102 },
  ], 28, true, false), skin);

  add('Neck', sweep([
    { y: -0.01, rx: 0.068, rz: 0.062 },
    { y:  0.05, rx: 0.060, rz: 0.058 },
  ], 18, false, false), skin);

  // --- Head --------------------------------------------------------------
  const skull = new THREE.SphereGeometry(0.115, 28, 20);
  skull.scale(0.94, 1.1, 1);
  add('Head', skull, skin, [0, 0.1, 0]);

  // Jaw: tapered to a point rather than spherical, for the angular chin.
  add('Head', sweep([
    { y: -0.03, rx: 0.052, rz: 0.058, dz: 0.012 },
    { y:  0.01, rx: 0.075, rz: 0.080, dz: 0.010 },
    { y:  0.055, rx: 0.090, rz: 0.088, dz: 0.004 },
    { y:  0.09, rx: 0.095, rz: 0.090 },
  ], 24, false, true), skin, [0, 0.04, 0.014]);

  // Hair: large, sharply swept spikes. Four-sided cones read as the hard
  // faceted shapes manga hair is drawn with; round cones look like fur.
  // x, y, z, length, baseRadius, tiltX(rad), rollZ(rad)
  const SPIKES: Array<[number, number, number, number, number, number, number]> = [
    [0.0, 0.215, -0.045, 0.30, 0.062, -0.30, 0],
    [0.082, 0.205, -0.015, 0.27, 0.058, -0.16, 0.26],
    [-0.082, 0.205, -0.015, 0.27, 0.058, -0.16, -0.26],
    [0.128, 0.165, -0.055, 0.24, 0.052, -0.46, 0.62],
    [-0.128, 0.165, -0.055, 0.24, 0.052, -0.46, -0.62],
    [0.055, 0.185, -0.105, 0.26, 0.055, -0.86, 0.14],
    [-0.055, 0.185, -0.105, 0.26, 0.055, -0.86, -0.14],
    [0.138, 0.125, 0.015, 0.20, 0.048, -0.10, 0.95],
    [-0.138, 0.125, 0.015, 0.20, 0.048, -0.10, -0.95],
    [0.042, 0.225, 0.055, 0.22, 0.052, 0.34, 0.18],
    [-0.042, 0.225, 0.055, 0.22, 0.052, 0.34, -0.18],
    [0.105, 0.21, 0.025, 0.21, 0.05, 0.08, 0.44],
    [-0.105, 0.21, 0.025, 0.21, 0.05, 0.08, -0.44],
    // Front fringe, angled down over the brow.
    [0.0, 0.175, 0.082, 0.15, 0.044, 2.05, 0],
    [0.068, 0.168, 0.07, 0.14, 0.042, 1.98, 0.32],
    [-0.068, 0.168, 0.07, 0.14, 0.042, 1.98, -0.32],
  ];
  for (const [x, y, z, len, rad, tilt, roll] of SPIKES) {
    const spike = new THREE.ConeGeometry(rad, len, 4);
    add('Head', spike, hair, [x, y, z], [tilt, Math.PI / 4, roll]);
  }

  // Crown shell. It must stop ABOVE the brow: a larger cap swallows the face.
  const cap = new THREE.SphereGeometry(0.122, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.40);
  add('Head', cap, hair, [0, 0.098, -0.006]);
  const nape = new THREE.SphereGeometry(0.119, 22, 16, Math.PI * 0.52, Math.PI * 0.96, 0, Math.PI * 0.74);
  add('Head', nape, hair, [0, 0.1, -0.004]);

  // Eyes, sat on the skull surface rather than inside it. Scaled on Y to blink.
  for (const sx of [1, -1]) {
    const eyeGeo = new THREE.SphereGeometry(0.022, 12, 10);
    eyeGeo.scale(1.15, 1.0, 0.45);
    geometries.push(eyeGeo);
    const eyeMat = new THREE.MeshBasicMaterial({ color: palette.ink });
    materials.push(eyeMat);
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.043 * sx, 0.1, 0.103);
    eye.rotation.z = -0.12 * sx;
    rig.bones.get('Head')!.add(eye);
    eyes.push(eye);
    meshes.push(eye);
  }

  // Heavy angled brows: the single biggest contributor to a focused, intense
  // expression rather than a blank one.
  for (const sx of [1, -1]) {
    const brow = new THREE.BoxGeometry(0.058, 0.016, 0.014);
    add('Head', brow, wrap, [0.042 * sx, 0.132, 0.101], [0, 0, -0.26 * sx]);
  }

  const mouth = new THREE.BoxGeometry(0.034, 0.008, 0.012);
  add('Head', mouth, wrap, [0, 0.05, 0.1]);

  // --- Arms --------------------------------------------------------------
  // Deltoid, bicep swell, then a taper into the wrist.
  for (const [bone, dir] of [['LeftArm', 1], ['RightArm', -1]] as const) {
    sweepAlong(bone, [0.28 * dir, 0, 0], [
      { y: -0.045, rx: 0.080, rz: 0.080 },
      { y: 0.02, rx: 0.086, rz: 0.084 },
      { y: 0.10, rx: 0.079, rz: 0.075 },
      { y: 0.20, rx: 0.064, rz: 0.062 },
      { y: 0.28, rx: 0.054, rz: 0.053 },
    ], skin, 20);
  }
  for (const [bone, dir] of [['LeftForeArm', 1], ['RightForeArm', -1]] as const) {
    sweepAlong(bone, [0.25 * dir, 0, 0], [
      { y: 0.0, rx: 0.054, rz: 0.053 },
      { y: 0.06, rx: 0.060, rz: 0.058 },
      { y: 0.15, rx: 0.046, rz: 0.045 },
      { y: 0.215, rx: 0.038, rz: 0.038 },
    ], skin, 18);
  }

  // Dark wrist wraps at the end of each forearm.
  for (const [bone, dir] of [['LeftForeArm', 1], ['RightForeArm', -1]] as const) {
    sweepAlong(bone, [0.25 * dir, 0, 0], [
      { y: 0.165, rx: 0.046, rz: 0.046 },
      { y: 0.195, rx: 0.052, rz: 0.052 },
      { y: 0.235, rx: 0.048, rz: 0.048 },
    ], wrap, 16);
  }

  // Clenched fists, as in the reference.
  for (const [bone, dir] of [['LeftHand', 1], ['RightHand', -1]] as const) {
    const fist = new THREE.SphereGeometry(0.056, 16, 12);
    fist.scale(1.2, 1.0, 0.82);
    add(bone, fist, skin, [0.04 * dir, 0, 0]);
    const knuckles = new THREE.BoxGeometry(0.045, 0.072, 0.072);
    add(bone, knuckles, skin, [0.07 * dir, 0.004, 0.004]);
  }

  // --- Legs: heavy, baggy trousers gathered at the ankle ------------------
  for (const bone of ['LeftUpLeg', 'RightUpLeg']) {
    sweepAlong(bone, [0, -0.42, 0], [
      { y: 0.0, rx: 0.124, rz: 0.122 },
      { y: 0.07, rx: 0.138, rz: 0.136 },
      { y: 0.18, rx: 0.142, rz: 0.142 },
      { y: 0.31, rx: 0.132, rz: 0.133 },
      { y: 0.42, rx: 0.120, rz: 0.122 },
    ], trouser, 22);
  }
  for (const bone of ['LeftLeg', 'RightLeg']) {
    sweepAlong(bone, [0, -0.40, 0], [
      { y: 0.0, rx: 0.120, rz: 0.121 },
      { y: 0.09, rx: 0.125, rz: 0.126 },
      { y: 0.20, rx: 0.114, rz: 0.116 },
      { y: 0.31, rx: 0.092, rz: 0.094 },
      { y: 0.40, rx: 0.074, rz: 0.076 },
    ], trouser, 22);
  }

  for (const bone of ['LeftFoot', 'RightFoot']) {
    add(bone, sweep([
      { y: -0.028, rx: 0.052, rz: 0.105, dz: 0.035 },
      { y: 0.0, rx: 0.056, rz: 0.110, dz: 0.035 },
      { y: 0.035, rx: 0.050, rz: 0.070, dz: 0.012 },
    ], 16, true, true), sash, [0, -0.045, 0]);
  }

  // --- Waist sash --------------------------------------------------------
  add('Hips', sweep([
    { y: -0.02, rx: 0.158, rz: 0.112 },
    { y: 0.015, rx: 0.172, rz: 0.122 },
    { y: 0.055, rx: 0.160, rz: 0.114 },
  ], 26, false, false), sash);

  for (const side of ['L', 'R'] as const) {
    for (const seg of [1, 2, 3] as const) {
      const w = 0.082 - seg * 0.008;
      const tail = new THREE.BoxGeometry(w, seg === 3 ? 0.15 : 0.165, 0.026);
      const bone = `Sash${side}${seg}`;
      add(bone, tail, sash, [0, seg === 3 ? -0.072 : -0.082, 0]);
    }
  }

  return {
    meshes,
    outlines,
    eyes,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Poses — absolute local rotations per bone, in DEGREES (x, y, z).
// Authored per side explicitly rather than mirrored in code, because the
// mirror rule differs between the X-axis arm chain and the Y-axis leg chain
// and silent sign errors there are miserable to debug.
// ---------------------------------------------------------------------------

const RELAXED: Pose = {
  LeftArm: [0, 6, -72], RightArm: [0, -6, 72],
  LeftForeArm: [0, -14, -8], RightForeArm: [0, 14, 8],
  LeftHand: [0, -4, 0], RightHand: [0, 4, 0],
  LeftShoulder: [0, 0, -4], RightShoulder: [0, 0, 4],
  LeftUpLeg: [-1, 0, 3], RightUpLeg: [-1, 0, -3],
  LeftLeg: [3, 0, 0], RightLeg: [3, 0, 0],
  LeftFoot: [-2, 2, 0], RightFoot: [-2, -2, 0],
  Spine: [1, 0, 0], Spine1: [1, 0, 0], Spine2: [-1, 0, 0],
  Neck: [1, 0, 0], Head: [-1, 0, 0],
  SashL1: [4, 0, 2], SashL2: [3, 0, 1], SashL3: [2, 0, 0],
  SashR1: [4, 0, -2], SashR2: [3, 0, -1], SashR3: [2, 0, 0],
};

/** Grounded fighting stance: bladed body, lead guard up, weight settled. */
const COMBAT: Pose = {
  Hips: [0, 26, 0],
  Spine: [2, -6, 0], Spine1: [3, -6, 0], Spine2: [-2, -4, 0],
  Neck: [2, -14, 0], Head: [-3, -8, 0],
  LeftShoulder: [0, -6, 4], RightShoulder: [0, 6, -2],
  LeftArm: [-8, -34, -58], RightArm: [6, 22, 62],
  LeftForeArm: [0, -78, -4], RightForeArm: [0, 86, 6],
  LeftHand: [0, -12, 0], RightHand: [0, 10, 0],
  LeftUpLeg: [-20, 14, 5], RightUpLeg: [10, -10, -7],
  LeftLeg: [34, 0, 0], RightLeg: [26, 0, 0],
  LeftFoot: [-12, 6, 0], RightFoot: [-14, -8, 0],
  SashL1: [10, 0, 3], SashL2: [8, 0, 2], SashL3: [6, 0, 1],
  SashR1: [12, 0, -3], SashR2: [9, 0, -2], SashR3: [6, 0, -1],
};

/**
 * Two-handed charge: hands cupped at the right hip, braced, face kept clear.
 *
 * The arm and spine angles here are SOLVED, not eyeballed. The left hand has
 * to cross the body, and shoulder-to-opposite-hip is further than the arm is
 * long — so the torso twist is part of the solution, not decoration.
 * scripts/verify-poses.mjs re-checks the resulting hand separation.
 */
const CHARGE: Pose = {
  Hips: [0, 30, 0],
  Spine: [12, -26, 10], Spine1: [-5, -20, 8], Spine2: [-10, 22, -10],
  Neck: [0, -16, 0], Head: [-2, -10, 0],
  LeftShoulder: [-14, -22, -18], RightShoulder: [-14, 22, 18],
  LeftArm: [13, -95, -58], RightArm: [-84, -61, -36],
  LeftForeArm: [-37, -40, -18], RightForeArm: [57, 79, 40],
  LeftHand: [10, -18, -8], RightHand: [-10, 16, 8],
  LeftUpLeg: [-24, 16, 5], RightUpLeg: [14, -12, -7],
  LeftLeg: [40, 0, 0], RightLeg: [30, 0, 0],
  LeftFoot: [-14, 6, 0], RightFoot: [-16, -8, 0],
  SashL1: [14, 0, 4], SashL2: [11, 0, 3], SashL3: [8, 0, 2],
  SashR1: [16, 0, -4], SashR2: [12, 0, -3], SashR3: [8, 0, -2],
};

/** Mid-release: palms thrust forward, hips driving through. */
const THRUST: Pose = {
  Hips: [0, 6, 0],
  Spine: [-4, 2, 0], Spine1: [-5, 2, 0], Spine2: [2, 2, 0],
  Neck: [2, 0, 0], Head: [-2, 0, 0],
  LeftShoulder: [0, -10, 6], RightShoulder: [0, 10, -6],
  LeftArm: [0, -74, -52], RightArm: [0, 74, 52],
  LeftForeArm: [0, -16, -4], RightForeArm: [0, 16, 4],
  LeftHand: [14, -8, -6], RightHand: [-14, 8, 6],
  LeftUpLeg: [-18, 8, 5], RightUpLeg: [8, -6, -7],
  LeftLeg: [30, 0, 0], RightLeg: [22, 0, 0],
  LeftFoot: [-10, 4, 0], RightFoot: [-12, -6, 0],
  SashL1: [-16, 0, 4], SashL2: [-12, 0, 3], SashL3: [-8, 0, 2],
  SashR1: [-18, 0, -4], SashR2: [-13, 0, -3], SashR3: [-8, 0, -2],
};

/** Two fingers to the forehead. Face stays unobstructed by the forearm. */
const TRANSMISSION: Pose = {
  Hips: [0, 8, 0],
  Spine: [1, -2, 0], Spine1: [1, -2, 0], Spine2: [0, -2, 0],
  Neck: [-2, -4, 0], Head: [2, -2, 0],
  RightShoulder: [0, 8, -14],
  // Solved rather than eyeballed: these put the wrist at the temple with the
  // elbow high and out to the side, so the forearm never crosses the face.
  // See scripts/verify-poses.mjs, which re-checks it.
  RightArm: [-82, 50, 22],
  RightForeArm: [-24, 124, 8],
  RightHand: [-18, 10, -6],
  LeftShoulder: [0, 0, -2],
  LeftArm: [0, 8, -70], LeftForeArm: [0, -18, -8], LeftHand: [0, -4, 0],
  LeftUpLeg: [-2, 0, 3], RightUpLeg: [-2, 0, -3],
  LeftLeg: [4, 0, 0], RightLeg: [4, 0, 0],
  LeftFoot: [-2, 2, 0], RightFoot: [-2, -2, 0],
  SashL1: [5, 0, 2], SashL2: [4, 0, 1], SashL3: [3, 0, 0],
  SashR1: [5, 0, -2], SashR2: [4, 0, -1], SashR3: [3, 0, 0],
};

/** Controlled hover: legs trailing slightly, arms loose, body upright. */
const HOVER: Pose = {
  Spine: [-3, 0, 0], Spine1: [-3, 0, 0], Spine2: [2, 0, 0],
  Neck: [2, 0, 0], Head: [-2, 0, 0],
  LeftShoulder: [0, 0, -8], RightShoulder: [0, 0, 8],
  LeftArm: [0, 14, -62], RightArm: [0, -14, 62],
  LeftForeArm: [0, -26, -10], RightForeArm: [0, 26, 10],
  LeftHand: [0, -6, 0], RightHand: [0, 6, 0],
  LeftUpLeg: [16, 2, 4], RightUpLeg: [14, -2, -4],
  LeftLeg: [22, 0, 0], RightLeg: [26, 0, 0],
  LeftFoot: [14, 2, 0], RightFoot: [16, -2, 0],
  SashL1: [26, 0, 4], SashL2: [20, 0, 3], SashL3: [14, 0, 2],
  SashR1: [28, 0, -4], SashR2: [21, 0, -3], SashR3: [14, 0, -2],
};

/** Evasive slip to the character's left, weight transferred onto one leg. */
const DODGE: Pose = {
  Hips: [0, -22, 12],
  Spine: [4, 8, -10], Spine1: [5, 8, -9], Spine2: [-2, 6, -6],
  Neck: [-2, 10, 4], Head: [2, 6, 2],
  LeftShoulder: [0, 6, -10], RightShoulder: [0, -6, 14],
  LeftArm: [-10, 26, -40], RightArm: [12, -30, 44],
  LeftForeArm: [0, -58, -8], RightForeArm: [0, 64, 8],
  LeftHand: [0, -10, 0], RightHand: [0, 8, 0],
  LeftUpLeg: [-28, -8, 10], RightUpLeg: [18, 10, -14],
  LeftLeg: [44, 0, 0], RightLeg: [16, 0, 0],
  LeftFoot: [-18, -4, 0], RightFoot: [-8, 6, 0],
  SashL1: [-10, 0, 16], SashL2: [-8, 0, 12], SashL3: [-5, 0, 8],
  SashR1: [-12, 0, 14], SashR2: [-9, 0, 10], SashR3: [-5, 0, 6],
};

export const POSE_LIBRARY = {
  relaxed: RELAXED,
  combat: COMBAT,
  charge: CHARGE,
  thrust: THRUST,
  transmission: TRANSMISSION,
  hover: HOVER,
  dodge: DODGE,
} as const;

// ---------------------------------------------------------------------------
// Pose maths
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;
const ALL_BONES = BONE_DEFS.map((b) => b.name).filter((n) => n !== 'Hips');

const euler = (p: Pose, bone: string): [number, number, number] => p[bone] ?? [0, 0, 0];

const lerpEuler = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const smooth = (t: number) => t * t * (3 - 2 * t);

const quatFromDeg = (e: [number, number, number]) =>
  new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0] * DEG, e[1] * DEG, e[2] * DEG, 'XYZ'));

/**
 * Forward-kinematics ground solve.
 *
 * Applies a pose to a scratch skeleton and returns the hips Y that puts the
 * lower sole exactly on y=0. This is why a deep stance keeps its feet planted
 * without anyone eyeballing a hips offset.
 */
function solveHipsY(pose: Pose): number {
  const scratch = buildSkeleton();
  for (const name of ALL_BONES) {
    scratch.bones.get(name)!.quaternion.copy(quatFromDeg(euler(pose, name)));
  }
  const hipsRot = euler(pose, 'Hips');
  scratch.root.quaternion.copy(quatFromDeg(hipsRot));
  scratch.root.position.y = 0.92;
  scratch.root.updateMatrixWorld(true);

  const v = new THREE.Vector3();
  let lowest = Infinity;
  for (const foot of ['LeftFoot', 'RightFoot']) {
    v.setFromMatrixPosition(scratch.bones.get(foot)!.matrixWorld);
    lowest = Math.min(lowest, v.y);
  }
  // Shift the hips by however far the sole is from the ground.
  return 0.92 + (SOLE_DROP - lowest);
}

const HIPS_Y = {
  relaxed: solveHipsY(RELAXED),
  combat: solveHipsY(COMBAT),
  charge: solveHipsY(CHARGE),
  thrust: solveHipsY(THRUST),
  transmission: solveHipsY(TRANSMISSION),
  dodge: solveHipsY(DODGE),
  // Hover is the one pose that is deliberately off the ground.
  hover: solveHipsY(RELAXED) + 0.34,
} as const;

type PoseName = keyof typeof POSE_LIBRARY;

// ---------------------------------------------------------------------------
// Clip construction
// ---------------------------------------------------------------------------

/** Per-bone overlay oscillators, as amplitude in degrees + whole-cycle count. */
interface LifeOptions {
  /** Breath amplitude multiplier. 1 = relaxed breathing. */
  breath: number;
  /** Balance-shift amplitude multiplier. */
  sway: number;
  /** Cycle counts must be INTEGERS so the loop closes seamlessly. */
  breathCycles: number;
  swayCycles: number;
  /** Secondary sash motion amplitude. */
  cloth: number;
  clothCycles: number;
  /** Vertical float, hover only. */
  floatY?: number;
  floatCycles?: number;
}

const RELAXED_LIFE: LifeOptions = {
  breath: 1, sway: 1, breathCycles: 2, swayCycles: 3, cloth: 1, clothCycles: 2,
};
/** Tenser, shallower, quicker — a held stance under load, not a rest. */
const BRACED_LIFE: LifeOptions = {
  breath: 0.6, sway: 0.45, breathCycles: 3, swayCycles: 5, cloth: 0.55, clothCycles: 3,
};
const HOVER_LIFE: LifeOptions = {
  breath: 0.8, sway: 0.7, breathCycles: 2, swayCycles: 2, cloth: 1.6, clothCycles: 2,
  floatY: 0.035, floatCycles: 1,
};

const FPS = 24;

/**
 * Builds a seamless held-pose loop: the authored pose plus layered breathing,
 * balance shift, head drift and trailing cloth. Every oscillator completes a
 * whole number of cycles over the duration, so the first and last frame match
 * in both value and velocity.
 */
function holdClip(name: string, poseName: PoseName, duration: number, life: LifeOptions): THREE.AnimationClip {
  const pose = POSE_LIBRARY[poseName];
  const frames = Math.round(duration * FPS);
  const times: number[] = [];
  for (let i = 0; i <= frames; i++) times.push((i / frames) * duration);

  const tracks: THREE.KeyframeTrack[] = [];
  const quatValues = new Map<string, number[]>();
  for (const bone of ALL_BONES) quatValues.set(bone, []);
  const hipsQuat: number[] = [];
  const hipsPos: number[] = [];
  const spineScale: number[] = [];

  const TAU = Math.PI * 2;

  for (const t of times) {
    const phase = t / duration;
    const breath = Math.sin(TAU * life.breathCycles * phase);
    // Offset so the chest and the shoulders are not perfectly in step.
    const breathLag = Math.sin(TAU * life.breathCycles * phase - 0.6);
    const sway = Math.sin(TAU * life.swayCycles * phase);
    const swayB = Math.cos(TAU * life.swayCycles * phase);
    const cloth = Math.sin(TAU * life.clothCycles * phase);

    for (const bone of ALL_BONES) {
      const base = euler(pose, bone);
      let [rx, ry, rz] = base;

      switch (bone) {
        case 'Spine':
          rx += breath * 1.1 * life.breath;
          rz += sway * 0.5 * life.sway;
          break;
        case 'Spine1':
          rx += breath * 1.6 * life.breath;
          rz += sway * 0.7 * life.sway;
          break;
        case 'Spine2':
          rx += breathLag * 1.3 * life.breath;
          rz += swayB * 0.5 * life.sway;
          break;
        case 'Neck':
          rx += -breathLag * 0.9 * life.breath;
          ry += swayB * 1.2 * life.sway;
          break;
        case 'Head':
          // Kept small and natural: a drift, not a scan.
          rx += breath * 0.5 * life.breath;
          ry += sway * 1.6 * life.sway;
          rz += swayB * 0.6 * life.sway;
          break;
        case 'LeftShoulder':
          rz += breathLag * 1.4 * life.breath;
          break;
        case 'RightShoulder':
          rz -= breathLag * 1.4 * life.breath;
          break;
        case 'LeftArm':
          rz += -breathLag * 1.0 * life.breath + sway * 0.8 * life.sway;
          break;
        case 'RightArm':
          rz += breathLag * 1.0 * life.breath - sway * 0.8 * life.sway;
          break;
        case 'LeftForeArm':
          ry += breath * 0.9 * life.breath;
          break;
        case 'RightForeArm':
          ry -= breath * 0.9 * life.breath;
          break;
        // Subtle hand tension, so fists are not dead weight.
        case 'LeftHand':
          rz += breath * 1.4 * life.breath;
          break;
        case 'RightHand':
          rz -= breath * 1.4 * life.breath;
          break;
        // Knees take the balance shift; this is what sells weight.
        case 'LeftLeg':
          rx += Math.max(sway, 0) * 1.1 * life.sway;
          break;
        case 'RightLeg':
          rx += Math.max(-sway, 0) * 1.1 * life.sway;
          break;
        default:
          break;
      }

      // Sash tails lag progressively down the chain.
      const sashMatch = /^Sash([LR])(\d)$/.exec(bone);
      if (sashMatch) {
        const seg = Number(sashMatch[2]);
        const side = sashMatch[1] === 'L' ? 1 : -1;
        const lag = Math.sin(TAU * life.clothCycles * phase - seg * 0.75);
        rx += lag * 2.6 * seg * 0.55 * life.cloth;
        rz += cloth * 1.4 * seg * 0.4 * life.cloth * side;
      }

      const q = quatFromDeg([rx, ry, rz]);
      quatValues.get(bone)!.push(q.x, q.y, q.z, q.w);
    }

    // Hips: rotation sways, translation NEVER moves in X or Z.
    const hipsBase = euler(pose, 'Hips');
    const hq = quatFromDeg([
      hipsBase[0],
      hipsBase[1] + sway * 1.0 * life.sway,
      hipsBase[2] + swayB * 0.8 * life.sway,
    ]);
    hipsQuat.push(hq.x, hq.y, hq.z, hq.w);

    const floatY =
      life.floatY && life.floatCycles
        ? Math.sin(TAU * life.floatCycles * phase) * life.floatY
        : 0;
    hipsPos.push(0, HIPS_Y[poseName] + floatY, 0);

    // Chest expansion carried on scale, which the attached geometry inherits.
    const s = 1 + breath * 0.016 * life.breath;
    spineScale.push(1 + breath * 0.01 * life.breath, s, s);
  }

  for (const bone of ALL_BONES) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, quatValues.get(bone)!));
  }
  tracks.push(new THREE.QuaternionKeyframeTrack('Hips.quaternion', times, hipsQuat));
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipsPos));
  tracks.push(new THREE.VectorKeyframeTrack('Spine1.scale', times, spineScale));

  const clip = new THREE.AnimationClip(name, duration, tracks);
  return clip;
}

/** Eased A-to-B transition. Easing lives in the sampled data. */
function transitionClip(
  name: string,
  from: PoseName,
  to: PoseName,
  duration: number,
): THREE.AnimationClip {
  return sequenceClip(name, [{ at: 0, pose: from }, { at: 1, pose: to }], duration);
}

/** Multi-key action clip. `at` is a normalised 0..1 time. */
function sequenceClip(
  name: string,
  keys: Array<{ at: number; pose: PoseName }>,
  duration: number,
): THREE.AnimationClip {
  const frames = Math.max(Math.round(duration * FPS), 2);
  const times: number[] = [];
  for (let i = 0; i <= frames; i++) times.push((i / frames) * duration);

  const quatValues = new Map<string, number[]>();
  for (const bone of ALL_BONES) quatValues.set(bone, []);
  const hipsQuat: number[] = [];
  const hipsPos: number[] = [];

  for (const t of times) {
    const u = t / duration;
    // Locate the segment this sample falls in.
    let i = 0;
    while (i < keys.length - 2 && u > keys[i + 1].at) i++;
    const a = keys[i];
    const b = keys[Math.min(i + 1, keys.length - 1)];
    const span = Math.max(b.at - a.at, 1e-6);
    const local = smooth(THREE.MathUtils.clamp((u - a.at) / span, 0, 1));

    const poseA = POSE_LIBRARY[a.pose];
    const poseB = POSE_LIBRARY[b.pose];

    for (const bone of ALL_BONES) {
      const e = lerpEuler(euler(poseA, bone), euler(poseB, bone), local);
      const q = quatFromDeg(e);
      quatValues.get(bone)!.push(q.x, q.y, q.z, q.w);
    }

    const hq = quatFromDeg(lerpEuler(euler(poseA, 'Hips'), euler(poseB, 'Hips'), local));
    hipsQuat.push(hq.x, hq.y, hq.z, hq.w);
    hipsPos.push(0, THREE.MathUtils.lerp(HIPS_Y[a.pose], HIPS_Y[b.pose], local), 0);
  }

  const tracks: THREE.KeyframeTrack[] = [];
  for (const bone of ALL_BONES) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, quatValues.get(bone)!));
  }
  tracks.push(new THREE.QuaternionKeyframeTrack('Hips.quaternion', times, hipsQuat));
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipsPos));
  return new THREE.AnimationClip(name, duration, tracks);
}

/**
 * The full clip set, named exactly as the state machine's ClipKeys so that a
 * generated GLB providing the same names substitutes without code changes.
 */
export function buildProceduralClips(): THREE.AnimationClip[] {
  return [
    holdClip('idle', 'relaxed', 6.5, RELAXED_LIFE),

    transitionClip('combat_enter', 'relaxed', 'combat', 1.1),
    holdClip('combat_hold', 'combat', 5.0, BRACED_LIFE),
    transitionClip('combat_exit', 'combat', 'relaxed', 1.0),

    transitionClip('charge_enter', 'relaxed', 'charge', 1.2),
    holdClip('charge_hold', 'charge', 4.5, BRACED_LIFE),
    sequenceClip(
      'charge_release',
      [
        { at: 0, pose: 'charge' },
        { at: 0.28, pose: 'thrust' },
        { at: 0.62, pose: 'thrust' },
        { at: 1, pose: 'relaxed' },
      ],
      1.7,
    ),

    transitionClip('transmission_enter', 'relaxed', 'transmission', 1.2),
    holdClip('transmission_hold', 'transmission', 4.8, BRACED_LIFE),
    transitionClip('transmission_exit', 'transmission', 'relaxed', 1.0),

    transitionClip('hover_enter', 'relaxed', 'hover', 1.4),
    holdClip('hover_hold', 'hover', 5.2, HOVER_LIFE),
    transitionClip('hover_exit', 'hover', 'relaxed', 1.2),

    sequenceClip(
      'dodge',
      [{ at: 0, pose: 'relaxed' }, { at: 0.45, pose: 'dodge' }, { at: 1, pose: 'dodge' }],
      0.8,
    ),
    sequenceClip(
      'recover',
      [{ at: 0, pose: 'dodge' }, { at: 0.5, pose: 'combat' }, { at: 1, pose: 'relaxed' }],
      1.0,
    ),
  ];
}

/** Everything the stand-in genuinely provides, for honest capability reporting. */
export const PROCEDURAL_CAPABILITIES: {
  clips: ClipKey[];
  headTracking: boolean;
  blink: boolean;
  cloth: boolean;
} = {
  clips: [
    'idle',
    'combat_enter', 'combat_hold', 'combat_exit',
    'charge_enter', 'charge_hold', 'charge_release',
    'transmission_enter', 'transmission_hold', 'transmission_exit',
    'hover_enter', 'hover_hold', 'hover_exit',
    'dodge', 'recover',
  ],
  headTracking: true,
  blink: true,
  cloth: true,
};
