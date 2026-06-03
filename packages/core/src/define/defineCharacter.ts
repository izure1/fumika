import type { CharBaseDef } from '../types/config'

// ─── 내부 유틸 타입 ───────────────────────────────────────────

type AssetKey<TAssets extends Record<string, string>> = keyof TAssets & string

type CharBaseDefOf<TAssets extends Record<string, string>> = Omit<CharBaseDef, 'src'> & {
  src?: AssetKey<TAssets>
}

// ─── defineCharacter ─────────────────────────────────────────

/**
 * 캐릭터를 정의하는 헬퍼 함수입니다.
 *
 * `defineAssets`로 생성한 에셋 맵을 첫 번째 인자로 전달하면
 * `bases.*.src` 및 `emotions`의 이미지 값이 에셋 키로 제한됩니다.
 *
 * 에셋이 없는 캐릭터는 `defineCharacter({})({...})`로 정의합니다.
 *
 * @example
 * export default defineCharacter(assets)({
 *   name: '후미카',
 *   bases: {
 *     normal: { src: 'fumika_base_normal', width: 560, points: { face: { x: 0.5, y: 0.18 } } }
 *   },
 *   emotions: {
 *     normal: { face: 'fumika_emotion_base_normal' },  // ✅ keyof assets
 *     smile:  { face: 'WRONG' },                        // ❌ 타입 오류
 *   }
 * })
 */
export function defineCharacter<TAssets extends Record<string, string>>(assets: TAssets) {
  return <
    const TBases extends Record<string, CharBaseDefOf<TAssets>>,
    const TEmotions extends Record<
      string,
      Record<
        string,
        | AssetKey<TAssets>
        | {
            src: AssetKey<TAssets>
            offset?: {
              x?: number
              y?: number
            }
          }
      >
    >,
    const TName extends string | undefined = undefined
  >(def: {
    name?: TName
    bases: TBases
    emotions: TEmotions
  }): { name?: TName; bases: TBases; emotions: TEmotions } => {
    return def as unknown as { name?: TName; bases: TBases; emotions: TEmotions }
  }
}
