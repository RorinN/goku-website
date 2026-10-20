# Higgsfield → website: the asset handoff

How generated assets connect to this site, what the workspace can actually
produce, and — bluntly — what it cannot.

---

## 1. The connection in one picture

```
Higgsfield                                   This repo
──────────                                   ─────────
reference photo
   │
   │  generate_image ×4  (0.25 credits each)
   ▼
front / side / back / three-quarter views
   │
   │  multi_image_to_3d                      public/assets/goku/
   │  should_texture + enable_rigging            goku_base.glb
   ▼                                              │
rigged, textured GLB  +  ONE animation clip       │
   │                                              │
   │  3d_rigging ×N  (8 credits each)             │
   │  same model_url, different action id         ▼
   ▼                                     npm run inspect:glb
goku_combat.glb, goku_dodge.glb …              │
   │                                           reports real clip names,
   └───────────────────────────────────────▶   durations, joints
                                                  │
                                                  ▼
                                        src/config/assets.ts
                                        (the ONLY file you edit)
                                                  │
                                                  ▼
                                        AnimationMachine plays it
```

The website never knows an asset's filename or clip name. It asks for logical
keys — `idle`, `combat_hold`, `charge_release` — and `src/config/assets.ts`
maps those to whatever the files actually contain.

---

## 2. Step by step

### a. Get the reference in

Remote tools cannot read chat attachments, and this container cannot reach the
Higgsfield CDN. Upload the reference through the Higgsfield upload widget and
keep the returned `media_id`.

### b. Build a clean turnaround

One photo is not enough for coherent geometry; the back and sides have to be
invented. Generate four A-pose views from the reference — front, left profile,
back, three-quarter — all with:

- the **same** A-pose, so reconstruction has something consistent to fit;
- a plain flat background (a busy background bleeds into the mesh);
- the sword, lettering and watermarks from the reference explicitly excluded;
- nothing cropped — hair, hands and feet all inside the frame.

At 0.25 credits each this step is essentially free. Regenerate until the four
views genuinely agree with each other; inconsistent views are the single
biggest cause of a bad mesh.

### c. Convert to a rigged GLB

`multi_image_to_3d` with `should_texture: true`, `enable_rigging: true`,
`pose_mode: 'a-pose'`, `symmetry_mode: 'on'`, `rigging_height_meters: 1.75`,
`target_polycount: 30000`.

A-pose matters: rigging an already-posed mesh produces a skeleton baked into
that pose, which then fights every clip you play on it.

### d. Add more clips

**Each job returns exactly one clip.** To get several clips on *one* skeleton,
call `3d_rigging` repeatedly against the **same `model_url`** with a different
`animation_action_id`. Same mesh plus same rigging parameters should yield the
same joint set, which is what makes the clips mergeable.

Do not take that on trust — verify it:

```bash
npm run inspect:glb -- public/assets/goku/*.glb
```

The inspector's **RIG COMPATIBILITY** section cross-checks the joint sets and
tells you, per clip, what percentage of its targets exist in the base rig and
whether it is mergeable.

### e. Wire it up

```bash
npm run inspect:glb -- public/assets/goku/goku_base.glb
```

It prints the real meshes, materials, joints, clip names and durations, plus a
ready-to-paste `clipNames` block and suggested `headBone` / `blinkMorph`
values. Then in `src/config/assets.ts`:

```ts
export const character: CharacterAsset = {
  enabled: true,                                   // ← flip this last
  url: '/assets/goku/goku_base.glb',
  additionalClipUrls: [
    '/assets/goku/goku_combat.glb',
    '/assets/goku/goku_dodge.glb',
  ],
  clipNames: {
    idle:        ['Idle'],
    combat_hold: ['Fighting_Idle'],
    dodge:       ['Stand_Dodge'],
  },
  scale: 1,
  yOffset: 0,
  yRotation: 0,
  headBone: 'Head',      // only if the inspector found one
  sashBones: [],
  blinkMorph: null,      // only if the inspector found morph targets
};
```

Clips you do not map fall back down a chain defined in
`src/three/animationMachine.ts` (`charge_hold` → `charge_enter` →
`combat_hold` → `idle`), so a partial asset set degrades instead of breaking.

---

## 3. What this workspace can actually produce

Verified against the live catalogue, not assumed.

| Need | Available? | Notes |
| --- | --- | --- |
| Rigged humanoid mesh | **Yes** | Auto-rig, height-scaled, from A-pose input. |
| Browser materials + textures | **Yes** | GLB with baked base colour; PBR optional. |
| Consistent scale / root | **Yes** | `rigging_height_meters` sets it. |
| `idle` | **Yes** | 30+ idle variants in the library. |
| `dodge` | **Yes** | `Stand_Dodge`, `Roll_Dodge`, `Dodge_and_Counter`. |
| Fighting stance | **Partly** | Fighting/Blocking clips exist, but as actions, not a sustained stance. |
| Charging action | **Partly** | `Charged_Spell_Cast` is a single wind-up-and-release; there is no sustained charge hold. |
| **All clips on one skeleton** | **No, not directly** | One clip per job. Several files, merged by the loader after a compatibility check. |
| **`*_enter` / `*_hold` / `*_exit` triads** | **No** | The library has whole actions, not split transitions. |
| **`hover_*`** | **No** | There is no hover, float, fly or levitate clip in the library at all. |
| **`transmission_*`** (two fingers to forehead) | **No** | Nothing resembling it exists. |
| **`recover`** | **No** | No dedicated recovery clip. |
| **Custom clips authored from a written brief** | **No** | You pick from a fixed 678-action catalogue. It does not animate to a description. |
| **Blinking / face rig** | **No** | No blend shapes are produced, so blinking cannot come from the asset. |
| **Secondary cloth / sash simulation** | **No** | Not produced; it has to come from the engine or from bones you add. |
| In-place, no forward drift | **Needs fixing** | Library clips often carry root translation. The loader strips it (`stripRootMotion`). |

### Costs observed

| Operation | Credits |
| --- | --- |
| `generate_image` (one reference view) | 0.25 |
| `multi_image_to_3d`, textured, no rig | 38 |
| `multi_image_to_3d`, textured + rigged + 1 clip | 47.5 |
| `3d_rigging` on an existing GLB + 1 clip | 8 |

So the economical shape is: **one** expensive base generation, then 8 credits
per additional clip.

---

## 4. Honest list of remaining limitations

1. **The brief's clip list cannot be fully satisfied by this workspace.** Of
   the fifteen clips the site asks for, roughly four map onto real library
   actions. `hover_*`, `transmission_*`, `recover` and every `_enter`/`_exit`
   transition have no equivalent. Getting those means authoring them in
   Blender/Maya against the generated rig, or retargeting Mixamo clips onto it.

2. **Generated clips are generic.** They are stock humanoid motions, not
   performances directed to the reference. A library "fighting idle" will not
   carry the character's bearing the way an authored clip would.

3. **No face rig.** Blinking is impossible from the asset. The site only blinks
   when `blinkMorph` names a morph target that the inspector actually found —
   it does not fake it.

4. **No cloth.** The sash cannot move as cloth unless bones for it exist in the
   asset; `sashBones` stays empty otherwise.

5. **Identity drift is real.** The mesh is reconstructed from four *generated*
   views, which are themselves an interpretation of one photo. The back and
   sides are invented. Expect the face in particular to drift from the
   reference, and expect to iterate on the turnaround before the mesh is right.

6. **Auto-rig quality is variable.** Joint placement on stylised proportions —
   very broad shoulders, a narrow waist, a large hair mass — is often
   approximate. Check shoulder and hip deformation before trusting it.

7. **Hair is geometry, not a groom.** Tall spiky hair tends to be reconstructed
   as a solid mass. It will read as a helmet at some angles.

8. **The stand-in is not a likeness.** It is a rig test with a silhouette, and
   the interface says so wherever it appears. It will not come to resemble the
   reference by tuning; only a real asset fixes that.

### What the site does about all this

- Missing clips degrade down a fallback chain instead of breaking.
- Clips that do not match the skeleton are **dropped with a warning** rather
  than played — a clip that silently animates nothing looks like a frozen pose,
  which is worse than an absent one.
- Root motion is stripped on load.
- Head tracking and blinking only run when the rig genuinely supports them.
- Transformations offer visual switching only where a matching asset exists;
  otherwise the entry stays informative and says so.

---

## 5. If only video comes back

If a usable mesh never materialises and you only have rendered clips, set
`videoFallback.enabled = true` in `src/config/assets.ts` and map pose ids to
clip files. That path is a **cinematic fallback**: fixed-camera video with
interactive HTML around it. It is labelled as such, and it does not offer orbit
or zoom, because those would be a lie about what is on screen.
