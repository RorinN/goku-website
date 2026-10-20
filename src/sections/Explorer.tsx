import { hotspots } from '../data/hotspots';
import { useUiStore } from '../state/useUiStore';
import { useCameraStore } from '../state/useCameraStore';
import { HotspotReadout } from '../components/HotspotReadout';
import { StandInNotice } from '../components/StandInNotice';

/**
 * Character explorer.
 *
 * The 3D markers are the primary way in, but every hotspot also has a real
 * button here. That is what makes the section keyboard-navigable and usable
 * on a phone, where hitting a small marker while also orbiting is awkward.
 */
export function Explorer() {
  const active = useUiStore((s) => s.activeHotspot);
  const setHotspot = useUiStore((s) => s.setHotspot);
  const request = useCameraStore((s) => s.request);

  return (
    <section className="section" aria-labelledby="explorer-title">
      <header className="section__head">
        <p className="section__kicker">02 — Explorer</p>
        <h2 className="section__title" id="explorer-title">
          Look around him
        </h2>
        <p className="section__lede">
          Drag to orbit, scroll or pinch to zoom. The markers sit on the regions that
          matter and follow the figure as it moves.
        </p>
      </header>

      <div className="explorer">
        <div className="explorer__controls">
          <div className="control-row" role="group" aria-label="Camera">
            <button type="button" className="btn btn--quiet" onClick={() => request('reset')}>
              Reset view
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => request('front')}>
              Front view
            </button>
          </div>

          <div className="chips" role="group" aria-label="Body regions">
            {hotspots.map((spot) => (
              <button
                key={spot.id}
                type="button"
                className={`chip${active === spot.id ? ' is-active' : ''}`}
                aria-pressed={active === spot.id}
                onClick={() => setHotspot(active === spot.id ? null : spot.id)}
              >
                {spot.label}
              </button>
            ))}
          </div>

          <HotspotReadout />
          <StandInNotice />
        </div>
      </div>
    </section>
  );
}
