import { create } from 'zustand';

export type CameraPreset = 'free' | 'front' | 'reset';

/**
 * Camera intent, not camera transform. The rig in src/three/CameraRig.tsx
 * reads `requestedPreset` and clears it once the move has been handed to the
 * controls, so a request is a one-shot event rather than sticky state.
 */
interface CameraState {
  requestedPreset: CameraPreset | null;
  /** Section-driven framing, so each section can own its default view. */
  focus: 'hero' | 'explorer' | 'ability' | 'transform' | 'training';
  request: (p: CameraPreset) => void;
  consume: () => void;
  setFocus: (f: CameraState['focus']) => void;
}

export const useCameraStore = create<CameraState>((set) => ({
  requestedPreset: null,
  focus: 'hero',
  request: (p) => set({ requestedPreset: p }),
  consume: () => set({ requestedPreset: null }),
  setFocus: (f) => set({ focus: f }),
}));
