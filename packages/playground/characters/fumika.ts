import { defineCharacter } from 'fumika'
import assets from '../assets'

export default defineCharacter(assets)({
  name: '후미카',
  bases: {
    normal: {
      src: 'fumika_base_normal',
      width: 560,
      points: {
        face: { x: 0.445, y: 0.202 },
        chest: { x: 0.5, y: 0.45 },
      }
    }
  },
  emotions: {
    normal: {
      face: {
        src: 'fumika_emotion_base_normal',
        offset: { x: -0, y: 0 }
      }
    },
    smile: { face: 'fumika_emotion_base_smile' },
    angry: { face: 'fumika_emotion_base_angry' },
    embarrassed: { face: 'fumika_emotion_base_embarrassed' },
  }
})
