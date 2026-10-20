import { transformations } from '../data/transformations';
import { transformAssets } from '../config/assets';
import { useCharacterStore } from '../state/useCharacterStore';
import { useUiStore } from '../state/useUiStore';
import type { TransformId } from '../data/transformations';

/**
 * Transformation explorer.
 *
 * Visual switching is enabled per form ONLY where a matching asset exists.
 * Where one does not, the entry stays fully informative and says so outright.
 * The aura tint still follows the selection, and that is described as what it
 * is — an ambient treatment — rather than sold as a form change, because
 * recolouring hair is not a transformation.
 */
export function Transformations() {
  const open = useUiStore((s) => s.openTransform);
  const setOpen = useUiStore((s) => s.setOpenTransform);
  const current = useCharacterStore((s) => s.transform);
  const setTransform = useCharacterStore((s) => s.setTransform);

  const anyModels = Object.values(transformAssets).some((t) => t.hasModel);

  return (
    <section className="section" aria-labelledby="transforms-title">
      <header className="section__head">
        <p className="section__kicker">04 — Transformations</p>
        <h2 className="section__title" id="transforms-title">
          The forms, and what each one costs
        </h2>
        <p className="section__lede">
          Four points on the Saiyan line plus one that is not on it at all. Ultra Instinct
          is a technique, not a transformation, which is why it behaves differently from
          everything above it.
        </p>
      </header>

      {!anyModels && (
        <p className="banner">
          <strong>No transformation models are loaded.</strong> These entries are
          informative only. Selecting one tints the ambient aura so you can see the
          palette, but the figure itself does not change — a recoloured aura is not a
          transformation and is not presented as one.
        </p>
      )}

      <ul className="forms" role="list">
        {transformations.map((form) => {
          const asset = transformAssets[form.id];
          const isOpen = open === form.id;
          const isSelected = current === form.id;
          return (
            <li key={form.id} className={`form${isSelected ? ' is-selected' : ''}`}>
              <div className="form__head">
                <span
                  className="form__swatch"
                  style={{ background: asset?.auraColor ?? '#e8e2d6' }}
                  aria-hidden="true"
                />
                <div className="form__titles">
                  <h3 className="form__name">
                    {form.name}
                    {form.japanese && <span className="form__jp">{form.japanese}</span>}
                  </h3>
                  <p className="form__tagline">{form.tagline}</p>
                </div>
                <div className="form__actions">
                  <button
                    type="button"
                    className={`btn btn--quiet${isSelected ? ' is-on' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => setTransform(form.id as TransformId)}
                  >
                    {asset?.hasModel ? 'Switch model' : 'Tint aura'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    aria-expanded={isOpen}
                    aria-controls={`form-panel-${form.id}`}
                    onClick={() => setOpen(isOpen ? null : form.id)}
                  >
                    {isOpen ? 'Less' : 'Details'}
                  </button>
                </div>
              </div>

              <div
                className="form__panel"
                id={`form-panel-${form.id}`}
                role="region"
                aria-label={form.name}
                hidden={!isOpen}
              >
                <p className="form__appearance">{form.appearance}</p>
                <h4 className="card__h4">How it is reached</h4>
                <p>{form.howReached}</p>
                <div className="card__cols">
                  <div>
                    <h4 className="card__h4">What changes</h4>
                    <ul className="list">
                      {form.effects.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="card__h4">What it costs</h4>
                    <ul className="list list--limits">
                      {form.costs.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {form.mediaNote && (
                  <p className="card__note">
                    <span className="card__note-tag">Anime / manga</span>
                    {form.mediaNote}
                  </p>
                )}
                {!asset?.hasModel && (
                  <p className="form__noasset">
                    No model for this form. Add one in <code>src/config/assets.ts</code> and
                    set <code>hasModel: true</code> to enable visual switching.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
