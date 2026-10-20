/**
 * Hotspot definitions for the character explorer.
 *
 * Positions are in the character's LOCAL space (metres, origin at the feet,
 * +Y up, facing +Z). They are attached to the character group so they track
 * the model as the camera orbits. When a real rig is loaded and the named
 * bone exists, the hotspot follows that bone instead of the static offset —
 * see src/three/Hotspots.tsx.
 */

export interface Hotspot {
  id: string;
  label: string;
  /** Body region, used in the readout. */
  region: string;
  /** Static local-space anchor, used for the stand-in and as a fallback. */
  position: [number, number, number];
  /** Bone to follow when the loaded rig provides it. */
  bone: string | null;
  /** What this region does, factually. */
  body: string;
  /** Related ability, so the hotspot can hand off to the ability section. */
  relatedAbility: 'ki_control' | 'flight' | 'kamehameha' | 'instant_transmission' | 'ultra_instinct';
}

export const hotspots: Hotspot[] = [
  {
    id: 'hands',
    label: 'Hands',
    region: 'Cupped hands, held at the hip',
    position: [0.26, 0.98, 0.16],
    bone: 'RightHand',
    body:
      'The focusing point for projected ki. Cupping the hands compresses gathered energy into a tight mass instead of letting it disperse — the shape is what makes a beam a beam. This is where the Kamehameha is charged and released.',
    relatedAbility: 'kamehameha',
  },
  {
    id: 'head',
    label: 'Head',
    region: 'Perception and ki sensing',
    position: [0, 1.66, 0.04],
    bone: 'Head',
    body:
      'Ki sensing is a trained skill, not an organ, but this is where the series stages it: eyes closed, attention outward, locating people by the feel of their energy. It is also the gesture point for Instant Transmission — two fingers to the forehead as an act of concentration.',
    relatedAbility: 'instant_transmission',
  },
  {
    id: 'core',
    label: 'Core',
    region: 'Breath and ki reserve',
    position: [0, 1.18, 0.14],
    bone: 'Spine1',
    body:
      'Ki draws on the body\'s own stamina and vitality, so the torso is the reservoir everything else spends from. Breath control is how the series depicts regulating that output — which is why a held fighting stance still visibly breathes.',
    relatedAbility: 'ki_control',
  },
  {
    id: 'feet',
    label: 'Feet',
    region: 'Stance and flight',
    position: [0, 0.1, 0.06],
    bone: 'LeftFoot',
    body:
      'A grounded stance anchors a charge: the wind-up for a heavy technique needs a planted base. Lift that requirement and you have Bukūjutsu — ki pushed outward beneath the body to support its own weight, steered by redirecting the flow.',
    relatedAbility: 'flight',
  },
  {
    id: 'shoulders',
    label: 'Shoulders',
    region: 'Reaction and automatic movement',
    position: [-0.22, 1.45, 0.0],
    bone: 'LeftShoulder',
    body:
      'Where a reaction becomes visible first. Ultra Instinct is specifically about removing the gap between a threat arriving and the body answering it — movement that starts before the decision to move does.',
    relatedAbility: 'ultra_instinct',
  },
];
