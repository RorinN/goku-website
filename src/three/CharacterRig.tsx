import { Suspense } from 'react';
import { character } from '../config/assets';
import { ProceduralCharacter } from './ProceduralCharacter';
import { GlbCharacter } from './GlbCharacter';
import type { CharacterSourceProps } from './characterSource';

/**
 * Picks the character source.
 *
 * `character.enabled` is a build-time constant, so this branch is stable and
 * neither component's hooks are ever called conditionally. While a GLB is
 * streaming in, the stand-in is shown rather than an empty stage — the page
 * is never blank waiting on an asset.
 */
export function CharacterRig(props: CharacterSourceProps) {
  if (!character.enabled) return <ProceduralCharacter {...props} />;
  return (
    <Suspense fallback={<ProceduralCharacter {...props} />}>
      <GlbCharacter {...props} />
    </Suspense>
  );
}
