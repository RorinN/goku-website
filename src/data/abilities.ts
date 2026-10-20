/**
 * Factual in-universe reference for Goku's abilities.
 *
 * Editorial rules applied here, deliberately:
 *  - No invented numerical power levels, multipliers, or speeds.
 *  - Anime and manga are distinguished wherever they actually differ.
 *  - Limits are stated as plainly as the capabilities are. Ultra Instinct in
 *    particular is NOT described as unlimited invincibility.
 *  - "How it works" stays inside the fiction; it is not pseudo-physics.
 */

export type AbilityId =
  | 'ki_control'
  | 'flight'
  | 'kamehameha'
  | 'instant_transmission'
  | 'ultra_instinct';

export interface Ability {
  id: AbilityId;
  name: string;
  /** Original Japanese name where one is commonly cited. */
  japanese?: string;
  /** Rough English rendering of the Japanese name. */
  literal?: string;
  /** One-line hook for the card header. */
  tagline: string;
  /** Plain-English explanation, no jargon. */
  plain: string;
  /** How it works within the story's own logic. */
  mechanics: string[];
  /** Requirements and hard limits. */
  limits: string[];
  /** Anime vs manga divergence, only where a real one exists. */
  mediaNote?: string;
  /** Which stand-in pose/animation the Demonstrate control drives. */
  demoPose: 'base' | 'combat' | 'charge' | 'transmission' | 'hover';
  /** Which visual effect layer the demonstration raises. */
  demoEffect: 'ki' | 'none' | 'beam' | 'vanish' | 'instinct';
}

export const abilities: Ability[] = [
  {
    id: 'ki_control',
    name: 'Ki Control',
    japanese: '気',
    literal: 'ki — life energy, breath, spirit',
    tagline: 'The foundation everything else is built on.',
    plain:
      'Ki is the life energy carried by every living thing. Goku has trained to feel it, gather it, hold it steady, and push it out of his body as force. Almost every other technique he has is a specific way of spending ki.',
    mechanics: [
      'Ki can be sensed. Trained fighters locate each other by the feel of their energy rather than by sight, which is why scouters are treated as a crude shortcut.',
      'Ki can be suppressed. Lowering your output hides you from anyone reading energy, and raising it suddenly is itself a signal.',
      'Ki can be expelled. Concentrated and released outward it becomes a blast, a barrier, or the lift that holds a body in the air.',
      'Ki answers to focus. A calm, deliberate state produces cleaner control than raw anger, which tends to produce power without precision.',
    ],
    limits: [
      'It is finite. Ki draws on the user\'s own stamina and vitality, so a long fight or an oversized technique leaves the user drained.',
      'Spending it has a cost. Pushing past what the body can support causes real injury, not just tiredness.',
      'Sensing is a skill, not a sense organ. It must be trained, and it can be fooled by a fighter who suppresses well.',
    ],
    demoPose: 'charge',
    demoEffect: 'ki',
  },
  {
    id: 'flight',
    name: 'Flight',
    japanese: '舞空術',
    literal: 'Bukūjutsu — "air dance technique"',
    tagline: 'Standing on your own energy instead of the ground.',
    plain:
      'Rather than flapping or thrusting, the user pushes ki out beneath and around the body and rides it. It reads as hovering, and it lets a fighter move freely in three dimensions.',
    mechanics: [
      'The user channels ki outward to support their own weight, then steers by shifting where that energy is directed.',
      'It is a taught technique, not a Saiyan trait. Humans in the series — Krillin, Tien, Yamcha — use it as competently as anyone.',
      'Because it is ki-driven, it scales with ki control: better control means steadier hovering and faster movement.',
    ],
    limits: [
      'It burns ki continuously. Staying airborne is an ongoing cost, not a one-time one.',
      'It requires ki control training first. Raw strength does not grant it.',
      'Knocked out or drained of ki, the user falls.',
    ],
    mediaNote:
      'As a child Goku gets around on the Flying Nimbus, which carries him rather than being flight of his own. He only flies under his own power later in the series, once his ki training is far enough along.',
    demoPose: 'hover',
    demoEffect: 'none',
  },
  {
    id: 'kamehameha',
    name: 'Kamehameha',
    japanese: 'かめはめ波',
    literal: 'commonly rendered "Turtle Destruction Wave"',
    tagline: 'Goku\'s signature beam — and not originally his.',
    plain:
      'Ki is gathered between cupped hands held at the hip, compressed while the user braces, then released forward as a single concentrated beam.',
    mechanics: [
      'The hands cup together at the side of the body. That shape is a focusing gesture: it concentrates the energy into a tight mass instead of letting it disperse.',
      'The charge is audible in the incantation — "Ka-me-ha-me-…" — and the release lands on "HA!" as the palms thrust forward.',
      'A longer charge packs in more ki and yields a stronger blast, which is the basis of the Super Kamehameha.',
      'It combines readily with other techniques, giving the Kaio-ken Kamehameha and, with Instant Transmission, a version fired from point-blank range after teleporting in.',
    ],
    limits: [
      'Charging leaves the user planted and open. The wind-up is the technique\'s main weakness.',
      'It is expensive. A full-power release costs a large share of the user\'s available ki and stamina.',
      'It is a beam, so it travels in a line and can be dodged, deflected, or pushed back by a comparable blast.',
    ],
    mediaNote:
      'Master Roshi invented it over decades of work. Goku reproduced it after watching it performed a single time — the feat is treated in-story as an early sign of how unusual his aptitude is.',
    demoPose: 'charge',
    demoEffect: 'beam',
  },
  {
    id: 'instant_transmission',
    name: 'Instant Transmission',
    japanese: '瞬間移動',
    literal: 'Shunkan Idō — "instantaneous movement"',
    tagline: 'Travel by homing in on someone\'s energy.',
    plain:
      'Goku locks onto a ki signature somewhere else and moves himself to it effectively at once. Two fingers to the forehead is the gesture of concentration, not the mechanism.',
    mechanics: [
      'The user finds a specific energy signature at the destination and uses it as a beacon to travel to.',
      'The destination is a person, in effect, rather than a set of coordinates — so arrival places the user next to whoever was sensed.',
      'It is a learned technique Goku picked up from the people of Planet Yardrat, after the fight with Frieza on Namek.',
    ],
    limits: [
      'It needs a ki signature to lock onto. Somewhere with no detectable energy is somewhere he cannot go.',
      'Range is bounded by his sensing, not by the travel itself. Goku has been unable to reach a destination because the signature was too far away to pick up.',
      'It depends on a skill that can fail. A suppressed, masked, or unfamiliar target is hard or impossible to home in on.',
    ],
    mediaNote:
      'It is worth separating from the Kais\' own teleportation (Kai Kai), which does not require a ki signature to lock onto and so is not limited the same way.',
    demoPose: 'transmission',
    demoEffect: 'vanish',
  },
  {
    id: 'ultra_instinct',
    name: 'Ultra Instinct',
    japanese: '身勝手の極意',
    literal: 'Migatte no Gokui — usually rendered "Mastery of Self-Movement"',
    tagline: 'Moving without waiting to decide to move.',
    plain:
      'A state in which the body reacts on its own, without routing each movement through conscious thought. Dodging, blocking and countering happen before the fighter has decided to do them, which removes the delay that thinking introduces.',
    mechanics: [
      'It is a technique of the Angels — Whis and his kind — rather than a Saiyan transformation, which is why it is not in the Super Saiyan line at all.',
      'The point is the removal of hesitation. Deciding to act costs time; here the body acts and the mind catches up.',
      'Conscious thought works against it. Doubt, calculation, or trying to direct the state tends to break it.',
      'There is an incomplete stage, Ultra Instinct -Sign-, in which the defensive, reactive side comes first, and a complete form in which offence is equally automatic.',
    ],
    limits: [
      'It is not invincibility. In the state Goku is still struck, still has to be strong enough to matter, and still runs out of stamina.',
      'It is physically punishing. The complete form in particular strains a mortal body well past what it comfortably takes.',
      'Holding it and summoning it on demand are separate problems from reaching it once under pressure.',
      'Even among gods it is treated as a hard, incompletely-attained discipline rather than a standard tool.',
    ],
    mediaNote:
      'The anime and the manga get Goku there differently. In the anime he reaches -Sign- under extreme duress during the Tournament of Power and the complete form in the final clash with Jiren, after which it lapses and he cannot call it back at will. In the manga he instead trains the state deliberately, notably under Merus during the Moro arc, which gives him a far more reliable hold on it.',
    demoPose: 'combat',
    demoEffect: 'instinct',
  },
];

export const abilityById = (id: AbilityId) =>
  abilities.find((a) => a.id === id) ?? abilities[0];
