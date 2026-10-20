import { Component, type ErrorInfo, type ReactNode, useCallback, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { CharacterRig } from './CharacterRig';
import type { CharacterHandles } from './characterSource';
import { Aura, Beam, GroundGlow, KiParticles } from './Effects';
import { Hotspots } from './Hotspots';
import { CameraRig } from './CameraRig';
import { Stage } from './Stage';
import { PosterFallback } from '../components/PosterFallback';
import { usePageHidden, usePrefersReducedMotion, useAutoLightMode, useWebGLStatus } from '../hooks/useEnvironment';
import { useUiStore } from '../state/useUiStore';

/**
 * Catches a render-time failure inside the 3D tree — a shader that will not
 * compile, a bad asset, a lost context — and shows the poster instead of a
 * blank page.
 */
class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept as a console error on purpose: this is a local project and the
    // stack is the useful artefact when an asset misbehaves.
    console.error('[scene] failed to render', error, info.componentStack);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function SceneCanvas({ showHotspots = false }: { showHotspots?: boolean }) {
  const webgl = useWebGLStatus();
  const hidden = usePageHidden();
  const reduced = usePrefersReducedMotion();
  const light = useAutoLightMode();
  const sceneFailed = useUiStore((s) => s.sceneFailed);
  const setSceneFailed = useUiStore((s) => s.setSceneFailed);
  const [handles, setHandles] = useState<CharacterHandles | null>(null);

  const onReady = useCallback((h: CharacterHandles) => {
    setHandles(h);
    // Surface asset problems in the UI, not only the console.
    useUiStore.getState().setAssetReport(h);
  }, []);
  const onError = useCallback(() => setSceneFailed(true), [setSceneFailed]);

  if (webgl === 'unavailable' || sceneFailed) {
    return (
      <PosterFallback
        reason={webgl === 'unavailable' ? 'webgl' : 'error'}
      />
    );
  }

  if (webgl === 'checking') {
    return <div className="scene-probe" aria-hidden="true" />;
  }

  return (
    <Canvas
      // Cap the pixel ratio: an unclamped DPR on a high-density laptop screen
      // is the single biggest avoidable cost here.
      dpr={light ? [1, 1.25] : [1, 1.75]}
      // `demand` would stall the idle animation, so the loop stays on — but
      // it is suspended entirely while the page is hidden.
      frameloop={hidden ? 'never' : 'always'}
      shadows={!light}
      gl={{
        antialias: !light,
        powerPreference: 'high-performance',
        alpha: false,
        // Preserving the buffer costs memory and buys nothing here.
        preserveDrawingBuffer: false,
      }}
      camera={{ position: [1.8, 1.45, 3.9], fov: 38, near: 0.1, far: 60 }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        scene.background = new THREE.Color('#14141a');
      }}
    >
      <SceneBoundary onError={onError}>
        <Stage light={light} />
        <CharacterRig onReady={onReady} light={light} reduced={reduced} />
        <GroundGlow />
        <Aura light={light} />
        <KiParticles light={light} />
        <Beam />
        {showHotspots && <Hotspots bones={handles?.bones ?? null} />}
        <CameraRig reduced={reduced} />
      </SceneBoundary>
    </Canvas>
  );
}
