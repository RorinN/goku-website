import * as THREE from 'three';
import type { ClipKey } from '../config/assets';
import type { PoseId } from '../state/useCharacterStore';
import type { AbilityId } from '../data/abilities';

/**
 * Animation state machine.
 *
 * Everything — selecting a pose, demonstrating an ability, recovering — is
 * expressed as a SCRIPT: an ordered list of steps, the last of which is
 * usually an endless hold loop. One walker drives all of them, which is what
 * keeps the guarantees uniform:
 *
 *  - A pose is entered via its `_enter` clip and then held on its `_hold`
 *    loop, so it stays active until something else is chosen.
 *  - Leaving a pose plays its `_exit` first. Crossfading a held stance
 *    straight into another pose's `_enter` would snap, because every `_enter`
 *    begins from the relaxed pose.
 *  - An ability appends the return-to-pose steps onto its own, so it always
 *    lands back on the stance that was selected before it ran.
 *  - Repeated clicks are absorbed: asking for the pose you are already in or
 *    heading to is a no-op, and re-triggering an ability restarts its script
 *    cleanly rather than layering a second copy on top.
 *
 * Crossfades always overlap: the next step is started `FADE` seconds before
 * the current one ends, so there is no frame where a single clip is snapping
 * to its first pose.
 */

export interface Step {
  key: ClipKey;
  loop: boolean;
  /** For loop steps: how long to stay. Infinity means "until told otherwise". */
  duration?: number;
}

/** Fallbacks used when a GLB simply does not provide a clip. */
const FALLBACKS: Record<ClipKey, ClipKey[]> = {
  idle: [],
  combat_enter: ['idle'],
  combat_hold: ['combat_enter', 'idle'],
  combat_exit: ['idle'],
  charge_enter: ['combat_enter', 'idle'],
  charge_hold: ['charge_enter', 'combat_hold', 'idle'],
  charge_release: ['charge_enter', 'idle'],
  transmission_enter: ['idle'],
  transmission_hold: ['transmission_enter', 'idle'],
  transmission_exit: ['idle'],
  hover_enter: ['idle'],
  hover_hold: ['hover_enter', 'idle'],
  hover_exit: ['idle'],
  dodge: ['idle'],
  recover: ['idle'],
};

const FADE = 0.3;
/** Longer fade when interrupting, so an impatient click still looks intended. */
const INTERRUPT_FADE = 0.45;

const POSE_HOLD: Record<PoseId, ClipKey> = {
  base: 'idle',
  combat: 'combat_hold',
  charge: 'charge_hold',
  transmission: 'transmission_hold',
  hover: 'hover_hold',
};
const POSE_ENTER: Partial<Record<PoseId, ClipKey>> = {
  combat: 'combat_enter',
  charge: 'charge_enter',
  transmission: 'transmission_enter',
  hover: 'hover_enter',
};
const POSE_EXIT: Partial<Record<PoseId, ClipKey>> = {
  combat: 'combat_exit',
  charge: 'charge_release',
  transmission: 'transmission_exit',
  hover: 'hover_exit',
};

/** The visible beat of each ability demonstration, before returning. */
const ABILITY_STEPS: Record<AbilityId, Step[]> = {
  ki_control: [
    { key: 'charge_enter', loop: false },
    { key: 'charge_hold', loop: true, duration: 3.2 },
  ],
  flight: [
    { key: 'hover_enter', loop: false },
    { key: 'hover_hold', loop: true, duration: 3.6 },
    { key: 'hover_exit', loop: false },
  ],
  kamehameha: [
    { key: 'charge_enter', loop: false },
    { key: 'charge_hold', loop: true, duration: 2.0 },
    { key: 'charge_release', loop: false },
  ],
  instant_transmission: [
    { key: 'transmission_enter', loop: false },
    { key: 'transmission_hold', loop: true, duration: 1.8 },
    { key: 'transmission_exit', loop: false },
  ],
  ultra_instinct: [
    { key: 'combat_enter', loop: false },
    { key: 'combat_hold', loop: true, duration: 1.0 },
    { key: 'dodge', loop: false },
    { key: 'recover', loop: false },
  ],
};

export type MachinePhase = 'idle' | 'entering' | 'holding' | 'ability' | 'recovering';

export interface MachineStatus {
  phase: MachinePhase;
  pose: PoseId;
  ability: AbilityId | null;
  clip: string | null;
}

interface ActiveScript {
  id: string;
  steps: Step[];
  index: number;
  /** Pose this script settles onto. */
  pose: PoseId;
  ability: AbilityId | null;
  /** Index at which the return-to-pose portion begins. */
  returnFrom: number;
}

export class AnimationMachine {
  readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<ClipKey, THREE.AnimationAction>();
  private readonly missing = new Set<ClipKey>();
  private current: THREE.AnimationAction | null = null;
  private currentKey: ClipKey | null = null;
  private script: ActiveScript | null = null;
  private stepElapsed = 0;
  private stepDuration = Infinity;
  private speed = 1;
  private paused = false;

  /** Keys that resolved to a different clip than asked for, for reporting. */
  readonly substituted = new Map<ClipKey, string>();

  constructor(
    root: THREE.Object3D,
    private readonly resolve: (key: ClipKey) => THREE.AnimationClip | null,
  ) {
    this.mixer = new THREE.AnimationMixer(root);
  }

  /** Resolves a logical key to an action, walking the fallback chain. */
  private action(key: ClipKey): THREE.AnimationAction | null {
    const cached = this.actions.get(key);
    if (cached) return cached;
    if (this.missing.has(key)) return null;

    const chain: ClipKey[] = [key, ...(FALLBACKS[key] ?? [])];
    for (const candidate of chain) {
      const clip = this.resolve(candidate);
      if (clip) {
        const act = this.mixer.clipAction(clip);
        this.actions.set(key, act);
        if (candidate !== key) this.substituted.set(key, clip.name);
        return act;
      }
    }
    this.missing.add(key);
    return null;
  }

  private startStep(step: Step, fade: number) {
    const next = this.action(step.key);
    if (!next) {
      // Nothing playable for this step or any of its fallbacks: skip it
      // rather than stalling the script.
      this.stepElapsed = 0;
      this.stepDuration = 0;
      return;
    }

    next.reset();
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    if (step.loop) {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
    } else {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    }

    if (this.current && this.current !== next) {
      next.crossFadeFrom(this.current, fade, true).play();
    } else {
      next.fadeIn(this.current ? fade : 0).play();
    }

    this.current = next;
    this.currentKey = step.key;
    this.stepElapsed = 0;
    // A one-shot runs for its clip length; a loop runs for the step's
    // requested dwell, defaulting to forever.
    this.stepDuration = step.loop
      ? step.duration ?? Infinity
      : next.getClip().duration;
  }

  private playScript(script: ActiveScript, fade: number) {
    this.script = script;
    this.startStep(script.steps[script.index], fade);
  }

  /** Steps that leave `from` and settle into `to`. */
  private poseSteps(from: PoseId, to: PoseId): Step[] {
    const steps: Step[] = [];
    const exit = from !== to ? POSE_EXIT[from] : undefined;
    if (exit) steps.push({ key: exit, loop: false });
    const enter = POSE_ENTER[to];
    if (enter) steps.push({ key: enter, loop: false });
    steps.push({ key: POSE_HOLD[to], loop: true, duration: Infinity });
    return steps;
  }

  get status(): MachineStatus {
    const s = this.script;
    if (!s) return { phase: 'idle', pose: 'base', ability: null, clip: this.currentKey };
    const atEnd = s.index >= s.steps.length - 1;
    let phase: MachinePhase;
    if (s.ability && s.index < s.returnFrom) phase = 'ability';
    else if (s.ability) phase = 'recovering';
    else if (atEnd) phase = s.pose === 'base' ? 'idle' : 'holding';
    else phase = 'entering';
    return { phase, pose: s.pose, ability: s.ability, clip: this.currentKey };
  }

  /** Pose the machine is currently heading to or holding. */
  get targetPose(): PoseId {
    return this.script?.pose ?? 'base';
  }

  requestPose(pose: PoseId) {
    // Already there, or already on the way: leave the pose active.
    if (this.script && this.script.ability === null && this.script.pose === pose) return;
    const from = this.script?.pose ?? 'base';
    const steps = this.poseSteps(from, pose);
    this.playScript(
      { id: `pose:${pose}`, steps, index: 0, pose, ability: null, returnFrom: steps.length },
      this.script ? INTERRUPT_FADE : FADE,
    );
  }

  /**
   * Plays an ability demonstration, then returns to `returnTo`.
   * Re-requesting the same ability restarts it instead of stacking.
   */
  requestAbility(ability: AbilityId, returnTo: PoseId) {
    const own = ABILITY_STEPS[ability];
    // Returning to a pose after an ability: the ability's last step has left
    // the body somewhere specific, so re-enter the target pose properly.
    const back = this.poseSteps('base', returnTo);
    const steps = [...own, ...back];
    this.playScript(
      {
        id: `ability:${ability}`,
        steps,
        index: 0,
        pose: returnTo,
        ability,
        returnFrom: own.length,
      },
      INTERRUPT_FADE,
    );
  }

  setSpeed(v: number) {
    this.speed = v;
  }

  setPaused(v: boolean) {
    this.paused = v;
  }

  update(dt: number) {
    if (this.paused) {
      // Still tick the mixer with zero delta so weights settle and the
      // current frame keeps rendering.
      this.mixer.update(0);
      return;
    }
    const scaled = dt * this.speed;
    this.mixer.update(scaled);

    if (!this.script) return;
    this.stepElapsed += scaled;

    if (this.stepDuration === Infinity) return;

    // Start the next step early so the crossfade overlaps the tail of this
    // one. Without the overlap the next clip's first frame is a visible snap.
    const advanceAt = Math.max(this.stepDuration - FADE, this.stepDuration * 0.5);
    if (this.stepElapsed < advanceAt) return;

    const s = this.script;
    if (s.index < s.steps.length - 1) {
      s.index += 1;
      this.startStep(s.steps[s.index], FADE);
    } else {
      // Final step was finite; settle onto the pose's hold.
      this.stepDuration = Infinity;
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    for (const action of this.actions.values()) {
      this.mixer.uncacheAction(action.getClip());
    }
    this.actions.clear();
  }

  /** Clip keys with nothing playable behind them, for the capability report. */
  get missingKeys(): ClipKey[] {
    return [...this.missing];
  }
}
