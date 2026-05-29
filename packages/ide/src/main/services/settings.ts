import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface IdeSettings {
  themeColor: 'indigo' | 'rose' | 'emerald' | 'amber' | 'sky' | 'violet'
  themeBg: 'slate' | 'zinc' | 'neutral' | 'stone' | 'gray'
  formatOnSave?: boolean
  autoUpdate?: boolean
}

const DEFAULT_SETTINGS: IdeSettings = {
  themeColor: 'amber',
  themeBg: 'neutral',
  formatOnSave: true,
  autoUpdate: true
}

export class SettingsService {
  private settingsPath: string
  private settings: IdeSettings

  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'ide-settings.json')
    this.settings = this.loadSettings()
  }

  private loadSettings(): IdeSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8')
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) }
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
    return { ...DEFAULT_SETTINGS }
  }

  public getSettings(): IdeSettings {
    return this.settings
  }

  public updateSettings(partialSettings: Partial<IdeSettings>): IdeSettings {
    this.settings = { ...this.settings, ...partialSettings }
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf8')
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
    return this.settings
  }
}

export const settingsService = new SettingsService()

