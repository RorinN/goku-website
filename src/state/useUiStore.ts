import { create } from 'zustand';
import type { CharacterHandles } from '../three/characterSource';

export type SectionId = 'hero' | 'explorer' | 'abilities' | 'transformations' | 'training';

interface UiState {
  section: SectionId;
  /** Hotspot currently selected in the explorer, or null. */
  activeHotspot: string | null;
  /** Ability whose panel is expanded. */
  openAbility: string | null;
  openTransform: string | null;
  /** Lighter rendering: fewer particles, lower resolution. Auto-set on mobile. */
  lightMode: boolean;
  /** User override of the OS reduced-motion preference, if they flip it. */
  reducedMotionOverride: boolean | null;
  /** True once the 3D scene has reported itself ready. */
  sceneReady: boolean;
  /** Set when WebGL or the asset load fails; drives the poster fallback. */
  sceneFailed: boolean;
  /** What the live character source actually provides. Drives honest labelling. */
  assetReport: CharacterHandles | null;

  setSection: (s: SectionId) => void;
  setHotspot: (h: string | null) => void;
  setOpenAbility: (a: string | null) => void;
  setOpenTransform: (t: string | null) => void;
  setLightMode: (v: boolean) => void;
  setReducedMotionOverride: (v: boolean | null) => void;
  setSceneReady: (v: boolean) => void;
  setSceneFailed: (v: boolean) => void;
  setAssetReport: (r: CharacterHandles) => void;
}

export const useUiStore = create<UiState>((set) => ({
  section: 'hero',
  activeHotspot: null,
  openAbility: null,
  openTransform: null,
  lightMode: false,
  reducedMotionOverride: null,
  sceneReady: false,
  sceneFailed: false,
  assetReport: null,

  setSection: (s) => set({ section: s }),
  setHotspot: (h) => set({ activeHotspot: h }),
  setOpenAbility: (a) => set({ openAbility: a }),
  setOpenTransform: (t) => set({ openTransform: t }),
  setLightMode: (v) => set({ lightMode: v }),
  setReducedMotionOverride: (v) => set({ reducedMotionOverride: v }),
  setSceneReady: (v) => set({ sceneReady: v }),
  setSceneFailed: (v) => set({ sceneFailed: v }),
  setAssetReport: (r) => set({ assetReport: r }),
}));
