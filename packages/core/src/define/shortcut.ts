import type { NovelConfig, ModulesOf } from '../types/config'
import type { BuiltinCmdMap } from '../types/dialogue'
import type { NovelModule } from './defineCmdUI'

// 유니언 타입 전체의 속성명 합집합을 분산하여 구하는 유틸리티
type KeysOfUnion<T> = T extends any ? keyof T : never

// 유니언 타입 TCmd로부터 특정 속성 K의 타입을 안전하게 분산 추출하는 유틸리티
type GetProp<TCmd, K> = TCmd extends any
  ? K extends keyof TCmd
    ? TCmd[K]
    : never
  : never

// 튜플로 정의된 키들을 모듈의 실제 프로퍼티 타입 튜플로 변환하는 유틸리티
type MapKeysToTypes<TCmd, TKeys extends readonly any[]> = {
  [I in keyof TKeys]: GetProp<TCmd, TKeys[I]>
}

// 튜플 내의 요소 중 undefined를 포함하는 요소들을 재귀적으로 선택적 요소(?)로 변환하는 유틸리티
type MakeOptional<T extends readonly any[]> = 
  T extends readonly [infer F, ...infer R]
    ? undefined extends F
      ? [F?, ...MakeOptional<R>]
      : [F, ...MakeOptional<R>]
    : []

// 특정 모듈의 핵심 커맨드 타입을 안전하게 추출하는 유틸리티
type TargetCmdOf<TConfig, TType extends string> =
  TType extends keyof BuiltinCmdMap<TConfig>
    ? BuiltinCmdMap<TConfig>[TType]
    : TType extends keyof ModulesOf<TConfig>
      ? ModulesOf<TConfig>[TType] extends NovelModule<infer TCmd, any, any>
        ? TCmd
        : object
      : object

// shortcut(config)가 반환하는 오버로딩 함수 인터페이스
export interface ShortcutConfigReturn<TConfig> {
  // 1. config + key 튜플을 사용하여 콜백 매개변수를 자동 추론하는 형태 (3개 인자)
  <
    TType extends (keyof BuiltinCmdMap<TConfig> | keyof ModulesOf<TConfig>) & string,
    const TKeys extends readonly (KeysOfUnion<TargetCmdOf<TConfig, TType>>)[],
    TReturn extends object
  >(
    type: TType,
    keys: TKeys,
    factory: (
      ...args: MakeOptional<MapKeysToTypes<TargetCmdOf<TConfig, TType>, TKeys>>
    ) => TReturn
  ): (...args: MakeOptional<MapKeysToTypes<TargetCmdOf<TConfig, TType>, TKeys>>) => { type: TType } & TargetCmdOf<TConfig, TType>

  // 2. config를 인자로 받아 수동 제네릭이나 명시적 타입을 사용하는 형태 (2개 인자)
  <
    TType extends (keyof BuiltinCmdMap<TConfig> | keyof ModulesOf<TConfig>) & string,
    TFactory extends (...args: any[]) => any
  >(
    type: TType,
    factory: TFactory
  ): TFactory extends (...args: infer TArgs) => infer TReturn
    ? (...args: TArgs) => { type: TType } & TReturn
    : TFactory
}

// 1. config를 인자로 받아 shortcut(config) 형태로 사용하는 오버로드
export function shortcut<TConfig extends NovelConfig<any, any, any, any, any, any, any, any>>(
  config: TConfig
): ShortcutConfigReturn<TConfig>

// 2. config 없이 기존처럼 shortcut('type')(factory) 형태로 사용하는 오버로드
export function shortcut<TType extends string>(
  type: TType
): <
  TFactory extends (...args: any[]) => any
>(
  factory: TFactory
) => TFactory extends (...args: infer TArgs) => infer TReturn
  ? (...args: TArgs) => { type: TType } & TReturn
  : TFactory

// 런타임 구현체
export function shortcut(configOrType: any): any {
  if (typeof configOrType === 'object' && configOrType !== null) {
    // shortcut(config) 형태
    return (type: string, keysOrFactory: any, factory?: (...args: any[]) => any) => {
      // 3개 인자 형태: (type, keys, factory)
      const realFactory = Array.isArray(keysOrFactory) ? factory! : keysOrFactory
      return (...args: any[]) => {
        return {
          type,
          ...realFactory(...args)
        }
      }
    }
  } else {
    // shortcut(type) 형태
    const type = configOrType as string
    return (factory: (...args: any[]) => any) => {
      return (...args: any[]) => {
        return {
          type,
          ...factory(...args)
        }
      }
    }
  }
}






