# GOKU — interactive character study

A private, locally-run interactive character study: a cel-shaded 3D character
you can orbit and pose, alongside a written reference on his abilities and
transformations.

**This project is local-only.** It is not published, deployed, or indexed, and
it pulls nothing from third-party services at runtime — no analytics, no
webfonts, no CDNs. The dev server binds to `127.0.0.1` so it is not reachable
from your local network, and the page carries a `noindex` meta tag as a
belt-and-braces measure.

> If you ever do want it reachable from another device, an unlisted URL or a
> `noindex` tag is **not** privacy — both are open to anyone who gets the
> address. Real options are: keep it local and use an SSH tunnel to reach it
> from another machine; or put it behind HTTP Basic auth / an identity proxy
> (Tailscale, Cloudflare Access) so access needs a credential. Nothing in this
> repo sets any of that up, deliberately.

## Run it

```bash
npm install
npm run dev          # http://127.0.0.1:5173
```

Other scripts:

```bash
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build locally
npm run typecheck    # types only
npm run inspect:glb -- public/assets/goku/goku_base.glb   # inspect an asset
node scripts/verify-poses.mjs                             # pose/clip self-check
```

Requires Node 18+. Nothing else.

## What's here

| Section | What it does |
| --- | --- |
| **Hero** | Title, introduction, and the two entry actions. The entrance is a CSS transition over content that is interactive from the first frame — it never gates the page. |
| **Character explorer** | Controlled orbit and zoom, reset and front-view controls, and hotspots that track the model. Every hotspot also has a real button, so the section works by keyboard and on a phone. |
| **Ability explorer** | Ki Control, Flight, Kamehameha, Instant Transmission, Ultra Instinct — each with a plain explanation, in-story mechanics, limits, and a Demonstrate control wired to the state machine. |
| **Transformation explorer** | Base, Super Saiyan, Super Saiyan God, Super Saiyan Blue, Ultra Instinct. Visual switching is only offered where a matching asset exists. |
| **Training mode** | Pose selection, ability playback, aura intensity, animation speed, camera reset, pause, and a press-and-hold charge with equivalent mouse, touch and keyboard controls. |

## How the character is driven

Everything — selecting a pose, demonstrating an ability, recovering — is one
**script**: an ordered list of steps whose last step is usually an endless hold
loop. A single walker runs all of them, which is what makes the behaviour
uniform:

- A pose is entered via its `_enter` clip, then held on its `_hold` loop. It
  stays held until you pick something else.
- Leaving a pose plays its `_exit` first. Every `_enter` clip begins from the
  relaxed pose, so crossfading a held stance directly into one would snap.
- An ability appends the return-to-pose steps onto its own, so it always lands
  back on the stance you had selected.
- Repeated clicks are absorbed: asking for the pose you are already in is a
  no-op, and re-triggering an ability restarts it cleanly instead of layering
  a second copy on top.
- Crossfades overlap — the next step starts before the current one ends.

**A held pose is not a frozen frame.** Breathing, balance shift, subtle hand
tension, head drift and trailing cloth are layered over the authored pose. Each
oscillator completes a whole number of cycles across the clip, so the loop
closes seamlessly in both value and velocity.

Two things hold by construction rather than by eye:

- **No root drift.** The hips translation track never varies in X or Z.
- **Foot contact.** Every grounded pose *solves* its hips height from forward
  kinematics so the lower sole lands exactly on `y=0`.

`node scripts/verify-poses.mjs` re-checks both, plus the reach-critical poses
(the Instant Transmission hand must reach the temple; the charge hands must
actually meet).

## The stand-in character

Until a verified GLB is configured, the figure is a **procedural stand-in**: a
real humanoid bone hierarchy with authored clips, built from swept profile
forms. It exists so the orbit, poses, state machine, hotspots and effects are
all genuinely working before any asset arrives.

It is labelled as a stand-in everywhere it appears. It is not a likeness of the
reference and is not presented as one.

## Adding real assets

See **[docs/HIGGSFIELD.md](docs/HIGGSFIELD.md)** for the full handoff. The short
version:

1. Drop GLB files into `public/assets/goku/`.
2. `npm run inspect:glb -- public/assets/goku/<file>.glb` — read the real clip
   names, durations, skeleton and meshes out of the file.
3. Paste those clip names into `clipNames` in `src/config/assets.ts` and set
   `enabled: true`.

`src/config/assets.ts` is the only file that references an asset path or a clip
name. Nothing else needs to change.

## Layout

```
src/
  config/assets.ts        asset mapping — the single source of truth
  data/                   ability, transformation and hotspot content
  state/                  character / camera / interface stores, kept separate
  three/
    proceduralCharacter.ts  stand-in rig: bones, geometry, authored clips
    animationMachine.ts     the script walker
    GlbCharacter.tsx        real-asset path, incl. multi-file clip merging
    glbSource.ts            clip resolution, rig verification, root-motion strip
    Effects.tsx             aura / particles / ground / beam, as separate layers
    celMaterial.ts          cel shading + inverted-hull outlines
  sections/               the five page sections
scripts/
  inspect-glb.mjs         report what an asset actually contains
  verify-poses.mjs        foot contact, root drift, reach, clip inventory
```

## Accessibility and performance

- Every 3D interaction has a keyboard path; focus is always visible.
- `prefers-reduced-motion` is honoured, with a user override in training mode
  that can be handed back to the system setting.
- Pause stops the animation; the render loop and the state machine both stop
  when the page is hidden.
- Pixel ratio is capped, and a lighter mode (fewer particles, no outlines or
  shadows, lower DPR) engages automatically on small, touch or low-core
  devices.
- If WebGL is unavailable or the scene fails, a designed poster takes its
  place, and the written reference is unaffected.

## Content notes

The written material carries limits with the same weight as capabilities. There
are no invented power levels or multipliers. Anime and manga are distinguished
where they genuinely differ. Ultra Instinct is not described as unlimited
invincibility, and a recoloured aura is never presented as a transformation.

Goku and Dragon Ball are the property of their respective rights holders. This
is an unofficial, unaffiliated, private study project and is not for
distribution.
