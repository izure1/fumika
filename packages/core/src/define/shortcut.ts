import type { BuiltinCmdMap } from '../types/dialogue'

/**
 * 씬에서 간결하게 명령어를 작성할 수 있도록 도와주는 커리드(curried) 숏컷 생성 함수입니다.
 * 첫 번째 인자로 전달받은 `type`이 결과 객체에 자동으로 주입되며 리터럴 타입으로 보존됩니다.
 * 팩토리 함수가 반환하는 타입이 실제 해당 명령어의 핵심 스키마 규격과 맞는지 컴파일 타임에 검증합니다.
 *
 * @example
 * const c = shortcut('character')((name: string, action: 'show' | 'hide') => ({
 *   action,
 *   name
 * }))
 *
 * // c('fumika', 'show') -> { type: 'character', action: 'show', name: 'fumika' }
 */
export function shortcut<TType extends string>(type: TType) {
  type TargetCmd = TType extends keyof BuiltinCmdMap
    ? BuiltinCmdMap[TType]
    : object

  type AllowedReturn = TargetCmd extends object
    ? Partial<Omit<TargetCmd, 'type' | 'skip'>>
    : object

  return <TArgs extends unknown[], TReturn extends object>(
    factory: (...args: TArgs) => TReturn & AllowedReturn
  ) => {
    return (...args: TArgs): { type: TType } & TReturn => {
      return {
        type,
        ...factory(...args)
      } as { type: TType } & TReturn
    }
  }
}

