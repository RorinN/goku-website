/**
 * Transformation reference. Same editorial rules as abilities.ts:
 * no invented multipliers, and the anime/manga split is stated where real.
 *
 * `visualSupport` is deliberately separate from the written content. A form
 * is only offered as a visual switch when a matching asset exists (see
 * `transformAssets` in src/config/assets.ts). Otherwise the entry stays
 * informative and the UI says plainly that there is no model for it.
 */

export type TransformId =
  | 'base'
  | 'super_saiyan'
  | 'super_saiyan_god'
  | 'super_saiyan_blue'
  | 'ultra_instinct';

export interface Transformation {
  id: TransformId;
  name: string;
  japanese?: string;
  /** Short descriptor for the list row. */
  tagline: string;
  /** How it is reached in-story. */
  howReached: string;
  /** What changes about him. */
  effects: string[];
  /** Costs and drawbacks. */
  costs: string[];
  mediaNote?: string;
  /** Hair/eye description — visual facts from the fiction, for the caption. */
  appearance: string;
}

export const transformations: Transformation[] = [
  {
    id: 'base',
    name: 'Base Form',
    tagline: 'A Saiyan at rest — and still one of the strongest fighters alive.',
    howReached:
      'His natural state. Everything else is layered on top of this, and his base strength rising is what makes the later forms worth more.',
    effects: [
      'Full access to ki, flight, and every learned technique. None of them require a transformation.',
      'No ongoing drain, so this is the form he can hold indefinitely.',
    ],
    costs: [
      'The ceiling is lower than any transformed state, so against a stronger opponent it is a starting position rather than an answer.',
    ],
    appearance: 'Black hair, dark eyes.',
  },
  {
    id: 'super_saiyan',
    name: 'Super Saiyan',
    japanese: '超サイヤ人',
    tagline: 'The legendary transformation, reached through need rather than training.',
    howReached:
      'Goku first transforms on Namek against Frieza, triggered by grief and rage after Krillin is killed. In-story it requires both a threshold of latent power and a powerful emotional trigger.',
    effects: [
      'A steep jump in strength, speed, and durability over base.',
      'A visible golden aura, and a temperament that runs harder and more aggressive.',
      'Later refinements — including the mastered, "full power" state — let him hold the form with far less strain.',
    ],
    costs: [
      'Raw stamina drain, heaviest in the unrefined early version.',
      'The aggression is a real drawback: the form trades some of his judgement for power.',
      'Later grades that push bulk and power further cost speed badly enough to be a net loss.',
    ],
    appearance: 'Golden upswept hair, teal-green eyes, golden aura.',
  },
  {
    id: 'super_saiyan_god',
    name: 'Super Saiyan God',
    japanese: '超サイヤ人ゴッド',
    tagline: 'Divine ki — a different kind of energy, not just more of it.',
    howReached:
      'Originally through a ritual: six righteous Saiyans channel their energy into a seventh. Goku first attains it this way, and after training is able to reach it without the ritual.',
    effects: [
      'Grants divine ki, which mortals cannot sense at all — a qualitative change, not only a quantitative one.',
      'A slender build rather than a bulked one, with power concentrated into control and efficiency.',
      'Far less wasteful than Super Saiyan: the form is about refinement over output.',
    ],
    costs: [
      'The ritual route requires other Saiyans willing to take part, which is a real constraint the first time.',
      'It still has a time limit and a drain on him when first obtained.',
    ],
    mediaNote:
      'The anime and the manga present the ritual and Goku\'s acquisition of the form with some differences of staging and explanation, though the ritual requirement itself is common to both.',
    appearance: 'Crimson-red hair and red eyes, with a fine red aura.',
  },
  {
    id: 'super_saiyan_blue',
    name: 'Super Saiyan Blue',
    japanese: '超サイヤ人ブルー',
    tagline: 'Super Saiyan applied on top of divine ki.',
    howReached:
      'A Super Saiyan God then transforms into a Super Saiyan — hence the full name, Super Saiyan God Super Saiyan. It requires having obtained divine ki first.',
    effects: [
      'Combines the divine ki of God with the multiplier of Super Saiyan.',
      'Demands serene, precise ki control rather than emotional intensity — the calm is part of the technique, not a side effect.',
      'A perfected version reduces the drain and makes the form usable for far longer.',
    ],
    costs: [
      'Heavy stamina consumption, which is the form\'s defining weakness before it is perfected.',
      'Its reliance on control means losing composure degrades it.',
      'Stacking Kaio-ken on top of it raises output but adds serious physical risk.',
    ],
    mediaNote:
      'The manga and the anime differ somewhat in how the form is explained and in how Goku and Vegeta each arrive at it.',
    appearance: 'Blue hair and blue eyes, with a blue-white aura.',
  },
  {
    id: 'ultra_instinct',
    name: 'Ultra Instinct',
    japanese: '身勝手の極意',
    tagline: 'Not a Saiyan form at all — a technique that happens to change how he looks.',
    howReached:
      'By reaching a state where the body moves without conscious direction. It belongs to the Angels\' discipline, so it sits outside the Super Saiyan line entirely and can be held alongside other states.',
    effects: [
      'Reaction and movement stop waiting on thought, so defence and then offence become automatic.',
      'Silver hair and silver eyes, with a calm rather than furious bearing.',
      'An incomplete stage (-Sign-) in which the reactive side arrives first, and a complete form in which attack is equally automatic.',
    ],
    costs: [
      'It is not invincibility: he is still hit, still has limits, still tires.',
      'The complete form is physically punishing on a mortal body.',
      'Reaching it once under pressure is a different problem from being able to summon and hold it.',
    ],
    mediaNote:
      'Anime: reached under duress in the Tournament of Power, then lost. Manga: trained deliberately, notably under Merus in the Moro arc, giving him a much more dependable hold on it.',
    appearance: 'Silver-white hair and silver eyes, with a pale, still aura.',
  },
];

export const transformById = (id: TransformId) =>
  transformations.find((t) => t.id === id) ?? transformations[0];
