import { abilities } from '../data/abilities';
import { useCharacterStore, type PoseId } from '../state/useCharacterStore';
import { useCameraStore } from '../state/useCameraStore';
import { useChargeControl } from '../hooks/useCharge';
import { StandInNotice } from '../components/StandInNotice';
import { usePrefersReducedMotion } from '../hooks/useEnvironment';
import { useUiStore } from '../state/useUiStore';

const POSES: Array<{ id: PoseId; label: string; note: string }> = [
  { id: 'base', label: 'Neutral', note: 'Relaxed standing' },
  { id: 'combat', label: 'Combat', note: 'Grounded fighting stance' },
  { id: 'charge', label: 'Charge', note: 'Two-handed energy charge' },
  { id: 'transmission', label: 'Transmission', note: 'Two fingers to the forehead' },
  { id: 'hover', label: 'Hover', note: 'Controlled hover, feet off the ground' },
];

/**
 * Training mode.
 *
 * Compact on purpose: pose, ability, aura, speed, camera, pause, and the
 * press-and-hold charge, with nothing competing for attention. A selected
 * pose stays held until another is chosen — the controls set state, they do
 * not fire one-shot animations that decay back to neutral.
 */
export function Training() {
  const pose = useCharacterStore((s) => s.pose);
  const setPose = useCharacterStore((s) => s.setPose);
  const playAbility = useCharacterStore((s) => s.playAbility);
  const playing = useCharacterStore((s) => s.playingAbility);
  const aura = useCharacterStore((s) => s.auraIntensity);
  const setAura = useCharacterStore((s) => s.setAura);
  const speed = useCharacterStore((s) => s.speed);
  const setSpeed = useCharacterStore((s) => s.setSpeed);
  const paused = useCharacterStore((s) => s.paused);
  const togglePaused = useCharacterStore((s) => s.togglePaused);
  const chargeLevel = useCharacterStore((s) => s.chargeLevel);
  const charging = useCharacterStore((s) => s.charging);
  const reset = useCharacterStore((s) => s.reset);
  const request = useCameraStore((s) => s.request);
  const reduced = usePrefersReducedMotion();
  const override = useUiStore((s) => s.reducedMotionOverride);
  const setOverride = useUiStore((s) => s.setReducedMotionOverride);

  const charge = useChargeControl();

  return (
    <section className="section" aria-labelledby="training-title">
      <header className="section__head">
        <p className="section__kicker">05 — Training mode</p>
        <h2 className="section__title" id="training-title">
          Drive it yourself
        </h2>
        <p className="section__lede">
          A pose you pick stays picked. Run an ability over the top of it and he returns to
          the stance you left him in.
        </p>
      </header>

      <div className="panel">
        <fieldset className="panel__group">
          <legend className="panel__legend">Pose</legend>
          <div className="chips">
            {POSES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip${pose === p.id ? ' is-active' : ''}`}
                aria-pressed={pose === p.id}
                title={p.note}
                onClick={() => setPose(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="panel__note">{POSES.find((p) => p.id === pose)?.note}</p>
        </fieldset>

        <fieldset className="panel__group">
          <legend className="panel__legend">Ability playback</legend>
          <div className="chips">
            {abilities.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`chip${playing === a.id ? ' is-playing' : ''}`}
                onClick={() => playAbility(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="panel__group">
          <legend className="panel__legend">Charge</legend>
          <button
            type="button"
            className={`charge${charging ? ' is-charging' : ''}`}
            aria-label="Hold to charge energy"
            aria-describedby="charge-hint"
            {...charge}
          >
            <span className="charge__label">
              {charging ? 'Charging…' : 'Hold to charge'}
            </span>
            <span className="charge__track" aria-hidden="true">
              <span className="charge__fill" style={{ transform: `scaleX(${chargeLevel})` }} />
            </span>
          </button>
          <p className="panel__note" id="charge-hint">
            Press and hold with the mouse, a finger, or <kbd>Space</kbd> / <kbd>Enter</kbd>
            while the control has focus. Releasing bleeds the energy back down.
          </p>
        </fieldset>

        <fieldset className="panel__group">
          <legend className="panel__legend">Aura intensity</legend>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={aura}
            onChange={(e) => setAura(Number(e.target.value))}
            aria-valuetext={`${Math.round(aura * 100)} percent`}
          />
          <p className="panel__note">{Math.round(aura * 100)}%</p>
        </fieldset>

        <fieldset className="panel__group">
          <legend className="panel__legend">Animation speed</legend>
          <input
            type="range"
            min={0.25}
            max={2}
            step={0.05}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-valuetext={`${speed.toFixed(2)} times`}
            disabled={reduced}
          />
          <p className="panel__note">
            {reduced ? 'Held still — reduced motion is on.' : `${speed.toFixed(2)}×`}
          </p>
        </fieldset>

        <fieldset className="panel__group panel__group--wide">
          <legend className="panel__legend">View and playback</legend>
          <div className="control-row">
            <button type="button" className="btn btn--quiet" onClick={() => request('reset')}>
              Reset camera
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => request('front')}>
              Front view
            </button>
            <button
              type="button"
              className={`btn btn--quiet${paused ? ' is-on' : ''}`}
              aria-pressed={paused}
              onClick={togglePaused}
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button type="button" className="btn btn--quiet" onClick={reset}>
              Reset all
            </button>
          </div>
          <div className="control-row">
            <label className="switch">
              <input
                type="checkbox"
                checked={reduced}
                onChange={(e) =>
                  // null hands control back to the OS preference.
                  setOverride(e.target.checked === false && override === null ? false : e.target.checked)
                }
              />
              <span>Reduce motion</span>
            </label>
            {override !== null && (
              <button type="button" className="btn btn--quiet" onClick={() => setOverride(null)}>
                Follow system setting
              </button>
            )}
          </div>
        </fieldset>
      </div>

      <StandInNotice />
    </section>
  );
}
