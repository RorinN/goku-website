import { hotspots } from '../data/hotspots';
import { abilityById } from '../data/abilities';
import { useUiStore } from '../state/useUiStore';

/**
 * The text panel for the selected hotspot. Kept out of the 3D overlay so it
 * is reachable by keyboard and readable at small sizes, where a floating
 * label pinned to a bone would not be.
 */
export function HotspotReadout() {
  const active = useUiStore((s) => s.activeHotspot);
  const setHotspot = useUiStore((s) => s.setHotspot);
  const setSection = useUiStore((s) => s.setSection);
  const setOpenAbility = useUiStore((s) => s.setOpenAbility);

  const spot = hotspots.find((h) => h.id === active);

  if (!spot) {
    return (
      <div className="readout readout--empty">
        <p className="readout__hint">
          Select a marker on the figure, or use the buttons below, to read what that region
          does.
        </p>
      </div>
    );
  }

  const ability = abilityById(spot.relatedAbility);

  return (
    <div className="readout" aria-live="polite">
      <p className="readout__region">{spot.region}</p>
      <h3 className="readout__title">{spot.label}</h3>
      <p className="readout__body">{spot.body}</p>
      <div className="readout__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setOpenAbility(ability.id);
            setSection('abilities');
          }}
        >
          Read about {ability.name}
        </button>
        <button type="button" className="btn btn--quiet" onClick={() => setHotspot(null)}>
          Clear
        </button>
      </div>
    </div>
  );
}
