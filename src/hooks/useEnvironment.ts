import { useEffect, useState } from 'react';
import { useUiStore } from '../state/useUiStore';

/** OS-level reduced-motion preference, with a live subscription. */
export function usePrefersReducedMotion(): boolean {
  const override = useUiStore((s) => s.reducedMotionOverride);
  const [system, setSystem] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // An explicit user choice beats the OS setting in both directions.
  return override ?? system;
}

/**
 * True while the page is hidden, so animation and rendering can be stopped.
 * Also fires on window blur, which covers the case of another window taking
 * focus without the tab being hidden.
 */
export function usePageHidden(): boolean {
  const [hidden, setHidden] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  return hidden;
}

export type WebGLStatus = 'checking' | 'ok' | 'unavailable';

/** One-time WebGL capability probe. The context is released immediately. */
export function useWebGLStatus(): WebGLStatus {
  const [status, setStatus] = useState<WebGLStatus>('checking');
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
      if (!gl) {
        setStatus('unavailable');
        return;
      }
      // Hand the context back rather than leaving it allocated.
      const lose = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
      lose?.loseContext();
      setStatus('ok');
    } catch {
      setStatus('unavailable');
    }
  }, []);
  return status;
}

/**
 * Picks the lighter rendering path. Driven by viewport width, device memory
 * and core count rather than by user-agent sniffing, and re-evaluated on
 * resize so rotating a tablet is handled.
 */
export function useAutoLightMode(): boolean {
  const lightMode = useUiStore((s) => s.lightMode);
  const setLightMode = useUiStore((s) => s.setLightMode);

  useEffect(() => {
    const evaluate = () => {
      const narrow = window.innerWidth < 860;
      const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
      const weak = (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4;
      const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      setLightMode(narrow || weak || coarse);
    };
    evaluate();
    window.addEventListener('resize', evaluate);
    return () => window.removeEventListener('resize', evaluate);
  }, [setLightMode]);

  return lightMode;
}
