import { useEffect, useRef } from 'react';
import { useCharacterStore } from '../state/useCharacterStore';

/**
 * Integrates the press-and-hold charge.
 *
 * Runs one rAF loop for the whole app rather than one per control, and bleeds
 * the level back down on release so letting go reads as a release rather than
 * a cut. Keyboard, mouse and touch all drive the same `charging` flag, so
 * there is no behavioural difference between them.
 */
export function useChargeIntegrator() {
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  useEffect(() => {
    const tick = (now: number) => {
      const dt = last.current ? Math.min((now - last.current) / 1000, 1 / 20) : 0;
      last.current = now;

      const { charging, chargeLevel, setChargeLevel, paused } = useCharacterStore.getState();
      if (!paused && dt > 0) {
        // ~1.4s to full, ~0.9s to bleed off.
        const next = charging
          ? Math.min(1, chargeLevel + dt / 1.4)
          : Math.max(0, chargeLevel - dt / 0.9);
        if (Math.abs(next - chargeLevel) > 0.0005) setChargeLevel(next);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      last.current = 0;
    };
  }, []);
}

/**
 * Wires a single control to the charge flag across mouse, touch and keyboard.
 * Space and Enter hold while down, matching the pointer behaviour, and a
 * blur or a pointer leaving the element releases — otherwise a drag off the
 * button would leave it charging forever.
 */
export function useChargeControl() {
  const setCharging = useCharacterStore((s) => s.setCharging);
  const held = useRef(false);

  const start = () => {
    if (held.current) return;
    held.current = true;
    setCharging(true);
  };
  const stop = () => {
    if (!held.current) return;
    held.current = false;
    setCharging(false);
  };

  // A key release or a window blur that happens off the element still needs
  // to end the charge.
  useEffect(() => {
    const onUp = () => stop();
    window.addEventListener('pointerup', onUp);
    window.addEventListener('blur', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('blur', onUp);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      start();
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        start();
      }
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        stop();
      }
    },
    onBlur: stop,
  };
}
