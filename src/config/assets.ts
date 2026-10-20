/**
 * SINGLE SOURCE OF TRUTH FOR ASSET MAPPING.
 *
 * Nothing else in the app hardcodes a file path or a clip name. To wire up
 * Higgsfield (or any other) exports, edit this file only.
 *
 * Workflow:
 *   1. Drop GLB files into `public/assets/goku/`.
 *   2. Run `npm run inspect:glb -- public/assets/goku/<file>.glb` to read the
 *      real clip names, durations, skeleton and mesh list out of the file.
 *   3. Paste the reported clip names into `clipNames` below.
 *   4. Flip `character.enabled` to true.
 *
 * Until `character.enabled` is true the app runs on the procedural stand-in
 * rig (`src/three/proceduralCharacter.ts`), which is clearly labelled in the
 * UI as a stand-in and is NOT presented as the finished character.
 */

/** Logical animation states the state machine can ask for. */
export type ClipKey =
  | 'idle'
  | 'combat_enter' | 'combat_hold' | 'combat_exit'
  | 'charge_enter' | 'charge_hold' | 'charge_release'
  | 'transmission_enter' | 'transmission_hold' | 'transmission_exit'
  | 'hover_enter' | 'hover_hold' | 'hover_exit'
  | 'dodge' | 'recover';

export interface CharacterAsset {
  /** Flip to true once a real GLB is in place and verified. */
  enabled: boolean;
  /** Primary skinned+rigged character, relative to /public. */
  url: string;
  /**
   * Extra GLBs whose clips get merged onto the primary skeleton. Higgsfield /
   * Meshy return ONE clip per job, so a multi-clip character arrives as
   * several files. The loader merges them by bone name and warns on mismatch.
   */
  additionalClipUrls: string[];
  /**
   * Maps a logical ClipKey to the clip name(s) actually present in the GLBs.
   * First match wins; later entries are fallbacks. An unmapped or missing key
   * degrades gracefully (see `fallbackChain` in animationMachine.ts) rather
   * than throwing.
   */
  clipNames: Partial<Record<ClipKey, string[]>>;
  /** Uniform scale applied on load. Set from the inspector's reported height. */
  scale: number;
  /** Y offset so the feet sit on the ground plane at y=0. */
  yOffset: number;
  /** Rotation in radians applied on load, to face +Z. */
  yRotation: number;
  /**
   * Bone name used for procedural head tracking. Leave null to disable it.
   * Only set this if the inspector confirms the bone exists.
   */
  headBone: string | null;
  /** Bones driven as secondary cloth motion (sash tails). Empty = disabled. */
  sashBones: string[];
  /** Morph target name for blinking. Leave null unless the inspector finds it. */
  blinkMorph: string | null;
}

export const character: CharacterAsset = {
  enabled: false,
  url: '/assets/goku/goku_base.glb',
  additionalClipUrls: [],
  clipNames: {
    // Example of the shape this takes once assets are inspected:
    // idle: ['Idle', 'mixamo.com'],
    // combat_hold: ['Fighting_Idle'],
  },
  scale: 1,
  yOffset: 0,
  yRotation: 0,
  headBone: null,
  sashBones: [],
  blinkMorph: null,
};

/**
 * Transformation visuals. `hasModel` must stay false unless a genuinely
 * distinct asset exists for that form. A hair recolour is NOT a
 * transformation, and the UI says so rather than pretending otherwise.
 */
export interface TransformAsset {
  id: string;
  hasModel: boolean;
  url: string | null;
  /** Palette used only for the ambient/aura treatment, never sold as a form swap. */
  auraColor: string;
}

export const transformAssets: Record<string, TransformAsset> = {
  base:            { id: 'base',            hasModel: false, url: null, auraColor: '#e8e2d6' },
  super_saiyan:    { id: 'super_saiyan',    hasModel: false, url: null, auraColor: '#f2c14e' },
  super_saiyan_god:{ id: 'super_saiyan_god',hasModel: false, url: null, auraColor: '#d7263d' },
  super_saiyan_blue:{id: 'super_saiyan_blue',hasModel: false,url: null, auraColor: '#2e8bc0' },
  ultra_instinct:  { id: 'ultra_instinct',  hasModel: false, url: null, auraColor: '#cfd8e3' },
};

/** Optional cinematic video fallback. Only surfaces if `enabled` is true. */
export const videoFallback = {
  enabled: false,
  /** Maps a pose/ability id to a fixed-camera clip. */
  clips: {} as Record<string, string>,
  poster: '/assets/poster/goku_poster.jpg',
};

/** Still image used when WebGL is unavailable or the GLB fails to load. */
export const posterImage = {
  enabled: false,
  url: '/assets/poster/goku_poster.jpg',
};
