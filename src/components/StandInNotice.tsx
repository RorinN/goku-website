import { character } from '../config/assets';

/**
 * Honest labelling of the current character source.
 *
 * While no verified GLB is configured, the figure on screen is a procedural
 * stand-in. The brief asked for clearly labelled placeholders, and this is
 * that label — present wherever the character is on screen, not buried in a
 * readme.
 */
export function StandInNotice({ compact = false }: { compact?: boolean }) {
  if (character.enabled) return null;
  return (
    <p className={`standin${compact ? ' standin--compact' : ''}`}>
      <span className="standin__dot" aria-hidden="true" />
      <span>
        <strong>Stand-in rig.</strong>{' '}
        {compact
          ? 'Real 3D and really animated, but placeholder geometry.'
          : 'This is placeholder geometry on a real humanoid skeleton — genuinely 3D and genuinely animated, but not a finished character model. It exists so the orbit, poses, state machine and effects are all working before generated assets arrive.'}
      </span>
    </p>
  );
}
