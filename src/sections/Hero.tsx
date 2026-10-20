import { useEffect, useState } from 'react';
import { useUiStore } from '../state/useUiStore';
import { StandInNotice } from '../components/StandInNotice';
import { usePrefersReducedMotion } from '../hooks/useEnvironment';

/**
 * Hero.
 *
 * The entrance is a short, restrained reveal that never gates the page: the
 * copy and both actions are in the DOM, focusable and usable from the first
 * frame, and the animation is purely a CSS transition on top. Under reduced
 * motion the reveal is skipped entirely rather than slowed down.
 */
export function Hero() {
  const setSection = useUiStore((s) => s.setSection);
  const reduced = usePrefersReducedMotion();
  const [entered, setEntered] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      setEntered(true);
      return;
    }
    // One frame, then transition. Not a timed gate on interaction.
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className={`hero__inner${entered ? ' is-entered' : ''}`}>
        <p className="hero__kicker">Character study — abilities, forms, and their limits</p>
        <h1 className="hero__title" id="hero-title">
          GOKU
        </h1>
        <p className="hero__lede">
          A Saiyan raised on Earth who turned a lifetime of training into a set of very
          specific tools: energy he can feel and project, a beam he copied by watching it
          once, travel that homes in on someone else&rsquo;s presence, and a state in which
          his body stops waiting for him to decide. Every one of them has a cost.
        </p>
        <div className="hero__actions">
          <button type="button" className="btn btn--primary" onClick={() => setSection('abilities')}>
            Explore abilities
          </button>
          <button type="button" className="btn btn--outline" onClick={() => setSection('training')}>
            Enter training mode
          </button>
        </div>
        <StandInNotice compact />
      </div>
    </section>
  );
}
