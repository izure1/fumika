import { useEffect, useRef } from 'react'

interface Props {
  /**
   * 로드할 에셋 맵.
   * key: fumika 에셋 키, value: local-resource 프로토콜 URL 또는 절대 경로.
   *
   * @example
   * { dust: 'local-resource:///C:/project/assets/dust.png' }
   */
  assets: Record<string, string>
  /**
   * 실행할 씬 커맨드 배열.
   * `defineScene` 내부에서 반환하는 것과 동일한 형태입니다.
   *
   * @example
   * [{ type: 'effect', action: 'add', effect: 'dust', src: 'dust', rate: 10 }]
   */
  scene: Record<string, any>[]
  /**
   * `defineNovelConfig`에 전달할 추가 설정.
   * `assets`, `scenes`, `modules`는 컴포넌트 내부에서 자동 주입되므로 생략 가능.
   */
  configOverride?: Record<string, any>
  /** 캔버스 해상도 너비 (기본: 컨테이너 너비) */
  width?: number
  /** 캔버스 해상도 높이 (기본: 컨테이너 높이) */
  height?: number
}

/**
 * fumika `Novel` API를 사용해 씬 커맨드를 실행하는 범용 미리보기 컴포넌트.
 *
 * - `scene` 또는 `assets`가 변경될 때마다 Novel 인스턴스를 재생성합니다.
 * - 컴포넌트가 언마운트되면 DOM을 정리합니다.
 * - 이펙트, 배경, 캐릭터 등 어떤 씬 커맨드도 실행할 수 있습니다.
 */
export function FumikaPreview({ assets, scene, configOverride, width, height }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || scene.length === 0) return
    const container = containerRef.current

    let cancelled = false

    const run = async () => {
      const { Novel, defineNovelConfig, effectModule, defineScene } = await import('fumika')

      if (cancelled) return

      while (container.firstChild) container.removeChild(container.firstChild)

      const w = width ?? (container.clientWidth || 600)
      const h = height ?? (container.clientHeight || 400)

      const config = defineNovelConfig({
        width: w,
        height: h,
        variables: {},
        characters: {},
        backgrounds: {},
        ...configOverride,
        assets,
        scenes: ['__preview__'],
        modules: { effect: effectModule },
      })

      const capturedScene = scene
      const previewScene = defineScene({ config })(() => capturedScene as any)

      const novel = new Novel(config, {
        element: container,
        scenes: { '__preview__': previewScene },
      })

      await novel.load()
      await novel.boot()
      novel.start('__preview__')
    }

    run().catch(console.error)

    return () => {
      cancelled = true
      while (container.firstChild) container.removeChild(container.firstChild)
    }
  }, [assets, scene, configOverride, width, height])

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />
}
