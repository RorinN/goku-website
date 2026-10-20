import { posterImage } from '../config/assets';

/**
 * Shown when WebGL is unavailable or the scene fails to build.
 *
 * It is a designed poster rather than an error box: the same typography and
 * palette as the live hero, so a visitor without WebGL gets a composed page
 * instead of an apology. It states plainly that the interactive view is
 * unavailable rather than pretending otherwise.
 */
export function PosterFallback({ reason }: { reason: 'webgl' | 'error' | 'asset' }) {
  const message =
    reason === 'webgl'
      ? 'This browser or device has no WebGL support, so the interactive view cannot run.'
      : reason === 'asset'
        ? 'The character asset could not be loaded.'
        : 'The interactive view hit an error and has been stopped.';

  return (
    <div className="poster" role="img" aria-label="GOKU — static poster">
      {posterImage.enabled ? (
        <img className="poster__art" src={posterImage.url} alt="" />
      ) : (
        <div className="poster__art poster__art--graphic" aria-hidden="true">
          <span className="poster__disc" />
          <span className="poster__rule" />
        </div>
      )}
      <div className="poster__body">
        <p className="poster__kicker">Static view</p>
        <h2 className="poster__title">GOKU</h2>
        <p className="poster__text">{message}</p>
        <p className="poster__note">
          The written reference below — abilities, transformations and their limits — is
          unaffected and fully available.
        </p>
      </div>
    </div>
  );
}
