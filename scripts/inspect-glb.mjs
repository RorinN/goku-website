#!/usr/bin/env node
/**
 * GLB inspector.
 *
 * Run this on every supplied asset BEFORE wiring it into src/config/assets.ts.
 * It reports what the file actually contains — meshes, materials, skeleton,
 * clip names and real durations — instead of letting you assume.
 *
 * It parses the GLB container and its JSON chunk directly rather than going
 * through a loader, so it needs no GL context and reports the file as it is
 * on disk, including things a loader would quietly normalise away.
 *
 * Usage:
 *   node scripts/inspect-glb.mjs public/assets/goku/goku_base.glb [more.glb ...]
 *
 * With two or more files it also cross-checks that the clips share a
 * compatible rig, which is the thing that actually decides whether separate
 * single-clip exports can be merged onto one skeleton.
 */
import fs from 'node:fs';
import path from 'node:path';

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 12) throw new Error('file is too short to be a GLB');
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    // A .gltf JSON file is still perfectly inspectable.
    try {
      return { json: JSON.parse(buf.toString('utf8')), binLength: 0, fileSize: buf.length };
    } catch {
      throw new Error('not a GLB and not valid glTF JSON');
    }
  }
  const version = view.getUint32(4, true);
  let offset = 12;
  let json = null;
  let binLength = 0;
  while (offset + 8 <= buf.length) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (chunkType === CHUNK_JSON) json = JSON.parse(buf.slice(start, start + chunkLength).toString('utf8'));
    else if (chunkType === CHUNK_BIN) binLength = chunkLength;
    offset = start + chunkLength + ((4 - (chunkLength % 4)) % 4);
  }
  if (!json) throw new Error('GLB contains no JSON chunk');
  return { json, binLength, version, fileSize: buf.length };
}

const bytes = (n) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`;

function describe(file) {
  const { json, binLength, version, fileSize } = readGlb(file);
  const nodes = json.nodes ?? [];
  const nodeName = (i) => nodes[i]?.name ?? `node#${i}`;

  // --- Meshes and primitives.
  const meshes = (json.meshes ?? []).map((m, i) => {
    const prims = m.primitives ?? [];
    const tris = prims.reduce((sum, p) => {
      const acc = p.indices !== undefined ? json.accessors?.[p.indices] : null;
      const count = acc ? acc.count : json.accessors?.[p.attributes?.POSITION]?.count ?? 0;
      return sum + Math.floor(count / 3);
    }, 0);
    const skinned = prims.some((p) => p.attributes?.JOINTS_0 !== undefined);
    const morphs = prims[0]?.targets?.length ?? 0;
    return { name: m.name ?? `mesh#${i}`, prims: prims.length, tris, skinned, morphs };
  });

  // --- Skeleton.
  const skins = (json.skins ?? []).map((s, i) => ({
    name: s.name ?? `skin#${i}`,
    joints: (s.joints ?? []).map(nodeName),
  }));
  const allJoints = new Set(skins.flatMap((s) => s.joints));

  // --- Animations. Duration comes from the input accessors' max time.
  const animations = (json.animations ?? []).map((a, i) => {
    let duration = 0;
    for (const s of a.samplers ?? []) {
      const acc = json.accessors?.[s.input];
      if (acc?.max?.[0] !== undefined) duration = Math.max(duration, acc.max[0]);
    }
    const targets = new Set();
    const paths = new Set();
    for (const c of a.channels ?? []) {
      if (c.target?.node !== undefined) targets.add(nodeName(c.target.node));
      if (c.target?.path) paths.add(c.target.path);
    }
    return {
      name: a.name ?? `clip#${i}`,
      duration,
      channels: (a.channels ?? []).length,
      targets: [...targets],
      paths: [...paths],
    };
  });

  const morphNames = json.meshes?.flatMap((m) => m.extras?.targetNames ?? []) ?? [];

  return {
    file,
    fileSize,
    version,
    binLength,
    generator: json.asset?.generator ?? 'unknown',
    meshes,
    materials: (json.materials ?? []).map((m, i) => m.name ?? `material#${i}`),
    textures: (json.textures ?? []).length,
    images: (json.images ?? []).length,
    skins,
    allJoints,
    animations,
    morphNames: [...new Set(morphNames)],
    nodeCount: nodes.length,
  };
}

function report(info) {
  const rel = path.relative(process.cwd(), info.file);
  console.log(`\n${'='.repeat(72)}\n${rel}  (${bytes(info.fileSize)})\n${'='.repeat(72)}`);
  console.log(`generator    : ${info.generator}`);
  console.log(`nodes        : ${info.nodeCount}   binary payload: ${bytes(info.binLength)}`);

  console.log(`\nMESHES (${info.meshes.length})`);
  if (info.meshes.length === 0) console.log('  none');
  for (const m of info.meshes) {
    console.log(
      `  ${m.name.padEnd(28)} ${String(m.tris).padStart(7)} tris  ` +
        `${m.skinned ? 'SKINNED' : 'static '}  ${m.morphs ? `${m.morphs} morph targets` : 'no morphs'}`,
    );
  }
  const totalTris = info.meshes.reduce((s, m) => s + m.tris, 0);
  console.log(`  total: ${totalTris} triangles`);

  console.log(`\nMATERIALS (${info.materials.length})  textures: ${info.textures}  images: ${info.images}`);
  for (const m of info.materials) console.log(`  ${m}`);

  console.log(`\nSKELETON`);
  if (info.skins.length === 0) {
    console.log('  NO SKIN. This is a static mesh — no animation clip can deform it.');
  } else {
    for (const s of info.skins) {
      console.log(`  ${s.name}: ${s.joints.length} joints`);
      console.log(`    root-ish: ${s.joints.slice(0, 6).join(', ')}${s.joints.length > 6 ? ' …' : ''}`);
    }
  }

  console.log(`\nANIMATION CLIPS (${info.animations.length})`);
  if (info.animations.length === 0) {
    console.log('  none — this file carries no animation.');
  }
  for (const a of info.animations) {
    const outside = a.targets.filter((t) => !info.allJoints.has(t));
    console.log(
      `  ${a.name.padEnd(26)} ${a.duration.toFixed(3)}s  ${String(a.channels).padStart(4)} channels  ` +
        `paths: ${a.paths.join('/')}  targets: ${a.targets.length}` +
        (outside.length ? `  (${outside.length} outside the skin)` : ''),
    );
  }

  console.log(`\nMORPH TARGET NAMES`);
  console.log(
    info.morphNames.length
      ? `  ${info.morphNames.join(', ')}`
      : '  none — blinking cannot be driven from the face; leave blinkMorph null.',
  );

  // --- Actionable notes.
  const notes = [];
  if (info.skins.length === 0) notes.push('No skeleton: cannot be used as the animated character.');
  if (info.animations.length === 0) notes.push('No clips: this file can only contribute geometry.');
  if (info.animations.length === 1) {
    notes.push(
      `Single clip ("${info.animations[0].name}"). Multi-clip characters arrive as several files — ` +
        'list the others in `additionalClipUrls` so their clips are merged onto this skeleton.',
    );
  }
  if (totalTris > 150000) notes.push(`${totalTris} triangles is heavy for the web; consider decimating.`);
  if (info.morphNames.length === 0) notes.push('No morph targets: set blinkMorph to null.');
  const rootCandidates = info.skins[0]?.joints?.filter((j) => /hip|root|pelvis/i.test(j)) ?? [];
  if (rootCandidates.length) notes.push(`Likely root bone for root-motion stripping: ${rootCandidates[0]}`);
  const headCandidates = info.skins[0]?.joints?.filter((j) => /head/i.test(j)) ?? [];
  notes.push(
    headCandidates.length
      ? `Head bone for procedural head tracking: set headBone to "${headCandidates[0]}".`
      : 'No head bone found: leave headBone null, head tracking stays off.',
  );

  console.log(`\nNOTES`);
  for (const n of notes) console.log(`  - ${n}`);

  console.log(`\nSUGGESTED config entry (src/config/assets.ts)`);
  console.log('  clipNames: {');
  for (const a of info.animations) {
    console.log(`    // '<ClipKey>': ['${a.name}'],   // ${a.duration.toFixed(2)}s`);
  }
  console.log('  },');
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/inspect-glb.mjs <file.glb> [more.glb ...]');
  process.exit(1);
}

const infos = [];
for (const f of files) {
  try {
    const info = describe(path.resolve(f));
    infos.push(info);
    report(info);
  } catch (err) {
    console.error(`\n${f}: FAILED TO READ — ${err.message}`);
  }
}

// --- Cross-file rig compatibility: the thing that decides whether separate
// single-clip exports can be merged onto one skeleton.
if (infos.length > 1) {
  console.log(`\n${'='.repeat(72)}\nRIG COMPATIBILITY\n${'='.repeat(72)}`);
  const base = infos[0];
  const baseJoints = base.allJoints;
  console.log(`Base: ${path.basename(base.file)} (${baseJoints.size} joints)\n`);
  let compatible = true;
  for (const other of infos.slice(1)) {
    const missing = [...other.allJoints].filter((j) => !baseJoints.has(j));
    const extra = [...baseJoints].filter((j) => !other.allJoints.has(j));
    const ok = missing.length === 0 && extra.length === 0;
    if (!ok) compatible = false;
    console.log(`${path.basename(other.file)}: ${ok ? 'IDENTICAL JOINT SET' : 'MISMATCH'}`);
    if (missing.length) console.log(`  joints not in base (${missing.length}): ${missing.slice(0, 10).join(', ')}`);
    if (extra.length) console.log(`  base joints missing here (${extra.length}): ${extra.slice(0, 10).join(', ')}`);

    // Even with matching names, clips must address those joints.
    for (const a of other.animations) {
      const hits = a.targets.filter((t) => baseJoints.has(t)).length;
      const ratio = a.targets.length ? hits / a.targets.length : 0;
      console.log(
        `  clip "${a.name}": ${(ratio * 100).toFixed(0)}% of targets exist in the base rig ` +
          `${ratio > 0.6 ? '-> mergeable' : '-> NOT mergeable, it would animate nothing'}`,
      );
    }
  }
  console.log(
    compatible
      ? '\nAll files share one joint set: their clips can be merged onto the primary skeleton.'
      : '\nJoint sets differ. Merging will drop the non-matching clips (the loader warns and skips them).',
  );
}
