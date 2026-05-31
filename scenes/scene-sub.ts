import config from '../novel.config'
import { defineScene, shortcut, CharacterKeysOf, ImageKeysOf } from 'fumika'

// ─── 숏컷 정의 ───────────────────────────────────────────────
const screenFadeOut = shortcut(config)('screen-fade', ['duration', 'preset'], (duration = 300, preset = 'black') => ({
  dir: 'out' as const,
  preset,
  duration,
}))

const screenFadeIn = shortcut(config)('screen-fade', ['duration', 'preset', 'disable'], (duration = 500, preset = 'black', disable = true) => ({
  dir: 'in' as const,
  preset,
  duration,
  disable,
}))

const audioPause = shortcut(config)('audio', ['name', 'duration'], (name, duration) => ({
  action: 'pause' as const,
  name,
  duration
}))

const dialogue = shortcut(config)('dialogue', ['text', 'speaker'], (text, speaker) => ({
  text,
  speaker,
}))

const d = (text: string) => dialogue(text)
const f = (text: string) => dialogue(text, 'fumika')

const cameraShake = shortcut(config)('camera-effect', ['duration'], (duration = 150) => ({
  preset: 'shake' as const,
  duration
}))

const characterShow = shortcut(config)('character', ['name', 'image', 'duration'], (name, image, duration = 300) => ({
  action: 'show' as const,
  name,
  image,
  duration
}))


export default defineScene({
  config
})(({ }) => [
  screenFadeOut(300),
  audioPause('bgm', 500),
  d('후미카는 숨을 죽인 채 학교 포털 사이트에 접속했다.'),
  f('제발... 전공 필수 제발...'),
  cameraShake(150),
  d('로딩 창이 빙글빙글 돌 때마다 그녀의 다리도 초조하게 떨렸다.'),
  f('...어?'),
  characterShow('fumika', 'normal:embarrassed', 300),
  f('내가... C+?'),
  d('후미카의 영혼이 빠져나가는 소리가 들리는 듯했다.'),
  d('스마트폰 화면이 꺼지며, 그녀의 어깨도 함께 축 처졌다.'),
  f('내 장학금이...'),
  screenFadeIn(500, 'black', true)
])


