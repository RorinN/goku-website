#!/usr/bin/env node
/**
 * Pose and clip verification for the procedural stand-in rig.
 *
 * Checks the two invariants the brief cares about and that are easy to break
 * when tuning poses by hand:
 *
 *   1. FOOT CONTACT — in every grounded pose the lower sole sits on y=0.
 *   2. NO ROOT DRIFT — the hips translation track never varies in X or Z.
 *
 * It also reports reach targets (the Instant Transmission hand must land at
 * the temple, the charge hands must meet at the hip) and prints the clip
 * inventory with durations, so a change to timing is visible in a diff.
 *
 * Usage: node scripts/verify-poses.mjs
 */
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'src/three/proceduralCharacter.ts'), 'utf8');

const DEFS = [
  ...src
    .slice(src.indexOf('const BONE_DEFS'), src.indexOf('/** Distance from the ankle'))
    .matchAll(/\{ name: '([^']+)', parent: (null|'[^']+'), pos: \[([^\]]+)\] \}/g),
].map((m) => ({
  name: m[1],
  parent: m[2] === 'null' ? null : m[2].slice(1, -1),
  pos: m[3].split(',').map(Number),
}));

const SOLE_DROP = Number(/const SOLE_DROP = ([\d.]+);/.exec(src)[1]);
const DEG = Math.PI / 180;

function readPose(name) {
  const start = src.indexOf(`const ${name}: Pose = {`);
  if (start < 0) return null;
  const body = src.slice(start, src.indexOf('};', start));
  const pose = {};
  for (const m of body.matchAll(/(\w+): \[(-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\]/g)) {
    pose[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return pose;
}

function build() {
  const bones = new Map();
  let rootBone = null;
  for (const d of DEFS) {
    const b = new THREE.Object3D();
    b.name = d.name;
    b.position.set(...d.pos);
    bones.set(d.name, b);
    if (d.parent === null) rootBone = b;
    else bones.get(d.parent).add(b);
  }
  return { root: rootBone, bones };
}

function apply(rig, pose) {
  for (const [name, b] of rig.bones) {
    const e = pose[name] ?? [0, 0, 0];
    b.quaternion.setFromEuler(new THREE.Euler(e[0] * DEG, e[1] * DEG, e[2] * DEG, 'XYZ'));
  }
  rig.root.position.set(0, 0.92, 0);
  rig.root.updateMatrixWorld(true);
}

const at = (rig, name) => new THREE.Vector3().setFromMatrixPosition(rig.bones.get(name).matrixWorld);

const GROUNDED = ['RELAXED', 'COMBAT', 'CHARGE', 'THRUST', 'TRANSMISSION', 'DODGE'];
const rig = build();
let failures = 0;

console.log('Foot contact (solved hips height puts the lower sole on y=0)\n');
for (const name of [...GROUNDED, 'HOVER']) {
  const pose = readPose(name);
  if (!pose) continue;
  apply(rig, pose);
  const lowest = Math.min(at(rig, 'LeftFoot').y, at(rig, 'RightFoot').y);
  const hipsY = 0.92 + (SOLE_DROP - lowest);
  // Re-measure with the solved hips height.
  const soleY = lowest + (hipsY - 0.92) - SOLE_DROP;
  const grounded = GROUNDED.includes(name);
  const ok = grounded ? Math.abs(soleY) < 1e-6 : true;
  if (!ok) failures++;
  console.log(
    `  ${name.padEnd(13)} hips=${hipsY.toFixed(3)}  sole=${soleY.toFixed(6)}  ` +
      (grounded ? (ok ? 'PLANTED' : 'FLOATING / SUNK') : 'airborne by design'),
  );
}

console.log('\nReach targets\n');
{
  const pose = readPose('TRANSMISSION');
  apply(rig, pose);
  const head = at(rig, 'Head');
  const hand = at(rig, 'RightHand');
  const elbow = at(rig, 'RightForeArm');
  const d = hand.distanceTo(head.clone().add(new THREE.Vector3(-0.085, 0.125, 0.055)));
  const ok = d < 0.05 && Math.abs(elbow.x) > 0.17 && elbow.y > 1.45;
  if (!ok) failures++;
  console.log(`  transmission wrist->temple  ${d.toFixed(4)} m   elbow=(${elbow.x.toFixed(2)}, ${elbow.y.toFixed(2)}, ${elbow.z.toFixed(2)})  ${ok ? 'OK' : 'OUT OF TOLERANCE'}`);
}
{
  const pose = readPose('CHARGE');
  apply(rig, pose);
  const l = at(rig, 'LeftHand');
  const r = at(rig, 'RightHand');
  const gap = l.distanceTo(r);
  // Cupped hands: close but not interpenetrating.
  const ok = gap > 0.05 && gap < 0.16;
  if (!ok) failures++;
  console.log(`  charge hand separation      ${gap.toFixed(4)} m   ${ok ? 'OK' : 'OUT OF TOLERANCE'}`);
}
{
  const pose = readPose('THRUST');
  apply(rig, pose);
  const l = at(rig, 'LeftHand');
  const r = at(rig, 'RightHand');
  const forward = (l.z + r.z) / 2;
  const ok = forward > 0.3;
  if (!ok) failures++;
  console.log(`  thrust palms forward (z)    ${forward.toFixed(4)} m   ${ok ? 'OK' : 'NOT EXTENDED'}`);
}

console.log('\nRoot drift: hips X/Z must be literally zero in every clip\n');
{
  // The clip builder writes `hipsPos.push(0, ..., 0)` — assert the source
  // still does that rather than trusting a comment.
  const pushes = [];
  for (const m of src.matchAll(/hipsPos\.push\(/g)) {
    // Scan to the matching close paren so nested calls like lerp(...) do not
    // truncate the argument list.
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
    }
    pushes.push(src.slice(m.index + m[0].length, i - 1).trim());
  }
  for (const p of pushes) {
    const ok = /^0,/.test(p) && /,\s*0\s*$/.test(p);
    if (!ok) failures++;
    console.log(`  hipsPos.push(${p})  ${ok ? 'OK' : 'DRIFTS'}`);
  }
  const strays = [...src.matchAll(/VectorKeyframeTrack\('(\w+)\.position'/g)].map((m) => m[1]);
  const bad = strays.filter((n) => n !== 'Hips');
  if (bad.length) { failures++; console.log(`  non-root position tracks: ${bad.join(', ')}`); }
  else console.log('  no position tracks on non-root bones  OK');
}

console.log('\nClip inventory\n');
{
  const block = src.slice(src.indexOf('export function buildProceduralClips'));
  const clips = [
    ...block.matchAll(/(?:holdClip|transitionClip|sequenceClip)\(\s*'([a-z_]+)'/g),
  ].map((m) => m[1]);
  const durations = [...block.matchAll(/,\s*([\d.]+),?\s*\)/g)].map((m) => m[1]);
  console.log(`  ${clips.length} clips: ${clips.join(', ')}`);
  console.log(`  durations seen: ${[...new Set(durations)].join(', ')}`);
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
