import { useEffect } from 'react';
import type { AnimationMachine } from './animationMachine';
import { useCharacterStore } from '../state/useCharacterStore';

/**
 * Wires the character store to an AnimationMachine.
 *
 * Shared by the procedural stand-in and the GLB character so both behave
 * identically: same pose persistence, same ability-then-return, same handling
 * of repeated clicks. Only the per-source extras (head tracking, blinking)
 * live in the components themselves.
 *
 * The caller still owns the per-frame `machine.update(dt)` call, so it can run
 * head tracking immediately afterwards and have it compose onto the clip
 * rather than be overwritten by the next mixer tick.
 */
export function useAnimationDriver(machine: AnimationMachine, reduced: boolean) {
  const pose = useCharacterStore((s) => s.pose);
  const playingAbility = useCharacterStore((s) => s.playingAbility);
  const abilityNonce = useCharacterStore((s) => s.abilityNonce);
  const clearAbility = useCharacterStore((s) => s.clearAbility);
  const speed = useCharacterStore((s) => s.speed);
  const paused = useCharacterStore((s) => s.paused);

  useEffect(() => {
    machine.requestPose('base');
  }, [machine]);

  useEffect(() => {
    if (playingAbility) return;
    machine.requestPose(pose);
  }, [pose, playingAbility, machine]);

  useEffect(() => {
    if (!playingAbility) return;
    machine.requestAbility(playingAbility, pose);
    // Release the flag once the ability's own beat has played, so the button
    // settles while the character is still walking back to its stance.
    const ms = 6500 / Math.max(speed, 0.25);
    const timer = window.setTimeout(() => clearAbility(), ms);
    return () => window.clearTimeout(timer);
    // `pose` and `speed` are read intentionally at trigger time only: changing
    // the speed slider mid-demo should not restart the demonstration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingAbility, abilityNonce, machine]);

  useEffect(() => {
    machine.setSpeed(reduced ? 0 : speed);
  }, [speed, reduced, machine]);

  useEffect(() => {
    machine.setPaused(paused);
  }, [paused, machine]);
}
