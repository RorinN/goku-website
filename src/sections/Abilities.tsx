import { abilities } from '../data/abilities';
import { useCharacterStore } from '../state/useCharacterStore';
import { useUiStore } from '../state/useUiStore';

/**
 * Ability explorer.
 *
 * Each entry gives the plain explanation, the in-story mechanics, and the
 * limits — the last of these deliberately given the same weight as the other
 * two. Demonstrate drives the state machine: it selects the ability's pose,
 * plays its action, and the machine returns to whatever stance was held.
 */
export function Abilities() {
  const open = useUiStore((s) => s.openAbility);
  const setOpen = useUiStore((s) => s.setOpenAbility);
  const playAbility = useCharacterStore((s) => s.playAbility);
  const playing = useCharacterStore((s) => s.playingAbility);

  return (
    <section className="section" aria-labelledby="abilities-title">
      <header className="section__head">
        <p className="section__kicker">03 — Abilities</p>
        <h2 className="section__title" id="abilities-title">
          What he can actually do
        </h2>
        <p className="section__lede">
          Five techniques, each with the cost attached. No power levels, because the series
          abandoned them for a reason and inventing numbers would be worse than leaving
          them out.
        </p>
      </header>

      <ul className="cards" role="list">
        {abilities.map((ability) => {
          const isOpen = open === ability.id;
          const isPlaying = playing === ability.id;
          return (
            <li key={ability.id} className={`card${isOpen ? ' is-open' : ''}`}>
              <h3 className="card__title">
                <button
                  type="button"
                  className="card__toggle"
                  aria-expanded={isOpen}
                  aria-controls={`panel-${ability.id}`}
                  onClick={() => setOpen(isOpen ? null : ability.id)}
                >
                  <span className="card__name">{ability.name}</span>
                  {ability.japanese && <span className="card__jp">{ability.japanese}</span>}
                  <span className="card__tagline">{ability.tagline}</span>
                  <span className="card__chevron" aria-hidden="true" />
                </button>
              </h3>

              <div
                className="card__panel"
                id={`panel-${ability.id}`}
                role="region"
                aria-label={ability.name}
                hidden={!isOpen}
              >
                {ability.literal && <p className="card__literal">{ability.literal}</p>}
                <p className="card__plain">{ability.plain}</p>

                <div className="card__cols">
                  <div>
                    <h4 className="card__h4">How it works</h4>
                    <ul className="list">
                      {ability.mechanics.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="card__h4">Requirements and limits</h4>
                    <ul className="list list--limits">
                      {ability.limits.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {ability.mediaNote && (
                  <p className="card__note">
                    <span className="card__note-tag">Anime / manga</span>
                    {ability.mediaNote}
                  </p>
                )}

                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => playAbility(ability.id)}
                  aria-describedby={`demo-hint-${ability.id}`}
                >
                  {isPlaying ? 'Demonstrating…' : 'Demonstrate'}
                </button>
                <span className="card__hint" id={`demo-hint-${ability.id}`}>
                  Plays the matching stance and effect, then returns to the pose you had
                  selected.
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
