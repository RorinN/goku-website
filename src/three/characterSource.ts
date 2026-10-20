import type * as THREE from 'three';
import type { ClipKey } from '../config/assets';

/** What a character source reports back once it is live. */
export interface CharacterHandles {
  bones: Map<string, THREE.Object3D>;
  clips: Array<{ name: string; duration: number }>;
  source: 'procedural' | 'glb';
  /** Problems worth surfacing in the UI rather than only the console. */
  warnings: string[];
  /** Logical clips with nothing playable behind them. */
  missingClips: ClipKey[];
}

export interface CharacterSourceProps {
  onReady?: (handles: CharacterHandles) => void;
  light?: boolean;
  reduced?: boolean;
}
