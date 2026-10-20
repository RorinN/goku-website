import { useEffect, useRef } from 'react';
import { SceneCanvas } from './three/SceneCanvas';
import { Hero } from './sections/Hero';
import { Explorer } from './sections/Explorer';
import { Abilities } from './sections/Abilities';
import { Transformations } from './sections/Transformations';
import { Training } from './sections/Training';
import { useUiStore, type SectionId } from './state/useUiStore';
import { useCameraStore } from './state/useCameraStore';
import { useCharacterStore } from './state/useCharacterStore';
import { useChargeIntegrator } from './hooks/useCharge';
import { usePageHidden } from './hooks/useEnvironment';

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: 'hero', label: 'Intro' },
  { id: 'explorer', label: 'Explorer' },
  { id: 'abilities', label: 'Abilities' },
  { id: 'transformations', label: 'Forms' },
  { id: 'training', label: 'Training' },
];

/** Which camera framing each section asks for. */
const FOCUS: Record<SectionId, 'hero' | 'explorer' | 'ability' | 'transform' | 'training'> = {
  hero: 'hero',
  explorer: 'explorer',
  abilities: 'ability',
  transformations: 'transform',
  training: 'training',
};

export default function App() {
  const section = useUiStore((s) => s.section);
  const setSection = useUiStore((s) => s.setSection);
  const setFocus = useCameraStore((s) => s.setFocus);
  const setPaused = useCharacterStore((s) => s.setPaused);
  const hidden = usePageHidden();

  useChargeIntegrator();

  const refs = useRef<Partial<Record<SectionId, HTMLDivElement | null>>>({});
  // Guards the observer while a nav click is scrolling, so the intermediate
  // sections passing through the viewport do not hijack the selection.
  const navigating = useRef(false);

  // Section in view drives both the nav state and the camera framing.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (navigating.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setSection(visible.target.getAttribute('data-section') as SectionId);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    for (const el of Object.values(refs.current)) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [setSection]);

  useEffect(() => {
    setFocus(FOCUS[section]);
  }, [section, setFocus]);

  // Nav state changed from a button rather than from scrolling: bring the
  // section into view.
  const goTo = (id: SectionId) => {
    navigating.current = true;
    setSection(id);
    refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => { navigating.current = false; }, 700);
  };

  // Hero and Training buttons set the section directly; follow them.
  const lastSection = useRef(section);
  useEffect(() => {
    if (section !== lastSection.current) {
      lastSection.current = section;
      if (!navigating.current) refs.current[section]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [section]);

  // Stop animation entirely while the page is hidden. The canvas frameloop is
  // already suspended; this also halts the state machine's own clock.
  useEffect(() => {
    if (hidden) setPaused(true);
  }, [hidden, setPaused]);

  return (
    <div className="app">
      <a className="skip" href="#content">Skip to content</a>

      <header className="topbar">
        <span className="topbar__mark">GOKU</span>
        <nav className="topbar__nav" aria-label="Sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`topbar__link${section === s.id ? ' is-current' : ''}`}
              aria-current={section === s.id ? 'true' : undefined}
              onClick={() => goTo(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <span className="topbar__private" title="This project is local-only and not published">
          Private / local
        </span>
      </header>

      <div className="stage-wrap">
        <div className="stage-sticky">
          {/* Hotspots only exist where they are the point of the section. */}
          <SceneCanvas showHotspots={section === 'explorer'} />
        </div>
      </div>

      <main className="content" id="content">
        <div data-section="hero" ref={(el) => { refs.current.hero = el; }}><Hero /></div>
        <div data-section="explorer" ref={(el) => { refs.current.explorer = el; }}><Explorer /></div>
        <div data-section="abilities" ref={(el) => { refs.current.abilities = el; }}><Abilities /></div>
        <div data-section="transformations" ref={(el) => { refs.current.transformations = el; }}><Transformations /></div>
        <div data-section="training" ref={(el) => { refs.current.training = el; }}><Training /></div>

        <footer className="footer">
          <p>
            A private study project. Goku and Dragon Ball are the property of their
            respective rights holders; nothing here is official, affiliated, or for
            distribution.
          </p>
        </footer>
      </main>
    </div>
  );
}
