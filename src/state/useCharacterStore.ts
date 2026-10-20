import { create } from 'zustand';
import type { AbilityId } from '../data/abilities';
import type { TransformId } from '../data/transformations';

/** The pose the character holds until told otherwise. */
export type PoseId = 'base' | 'combat' | 'charge' | 'transmission' | 'hover';

/**
 * Character state only. Camera, UI and effect concerns live in their own
 * stores so a pose change does not re-render the interface chrome and a
 * camera nudge does not touch the animation machine.
 */
interface CharacterState {
  /** The pose the user selected. The machine returns here after any action. */
  pose: PoseId;
  /** Non-null while a one-shot ability action is playing. */
  playingAbility: AbilityId | null;
  /** Monotonic counter: bump to re-trigger the same ability deliberately. */
  abilityNonce: number;
  transform: TransformId;
  /** 0..1 aura strength, driven by the training-mode slider and charging. */
  auraIntensity: number;
  /** 0.25..2 animation playback rate. */
  speed: number;
  /** User-facing pause. Distinct from the automatic page-hidden pause. */
  paused: boolean;
  /** True while the charge control is held down. */
  charging: boolean;
  /** 0..1 charge build-up, integrated while `charging`. */
  chargeLevel: number;

  setPose: (p: PoseId) => void;
  playAbility: (a: AbilityId) => void;
  clearAbility: () => void;
  setTransform: (t: TransformId) => void;
  setAura: (v: number) => void;
  setSpeed: (v: number) => void;
  togglePaused: () => void;
  setPaused: (v: boolean) => void;
  setCharging: (v: boolean) => void;
  setChargeLevel: (v: number) => void;
  reset: () => void;
}

export const useCharacterStore = create<CharacterState>((set) => ({
  pose: 'base',
  playingAbility: null,
  abilityNonce: 0,
  transform: 'base',
  auraIntensity: 0.22,
  speed: 1,
  paused: false,
  charging: false,
  chargeLevel: 0,

  setPose: (p) => set({ pose: p }),
  // Bumping the nonce lets a repeated click restart the action cleanly
  // instead of being swallowed as "already playing that ability".
  playAbility: (a) =>
    set((s) => ({ playingAbility: a, abilityNonce: s.abilityNonce + 1 })),
  clearAbility: () => set({ playingAbility: null }),
  setTransform: (t) => set({ transform: t }),
  setAura: (v) => set({ auraIntensity: Math.min(1, Math.max(0, v)) }),
  setSpeed: (v) => set({ speed: Math.min(2, Math.max(0.25, v)) }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
  setPaused: (v) => set({ paused: v }),
  setCharging: (v) => set({ charging: v }),
  setChargeLevel: (v) => set({ chargeLevel: Math.min(1, Math.max(0, v)) }),
  reset: () =>
    set({
      pose: 'base',
      playingAbility: null,
      transform: 'base',
      auraIntensity: 0.22,
      speed: 1,
      paused: false,
      charging: false,
      chargeLevel: 0,
    }),
}));
