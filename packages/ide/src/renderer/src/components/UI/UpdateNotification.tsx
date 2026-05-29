import { useEffect, useState } from 'react'
import { ConfirmDialogBox } from './ConfirmDialogBox'
import { useToastStore } from '../../store/useToastStore'

export function UpdateNotification() {
  const [isUpdateDownloaded, setIsUpdateDownloaded] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const { addToast } = useToastStore()

  useEffect(() => {
    if (!window.api?.updater) return

    const unsubAvailable = window.api.updater.onUpdateAvailable((info) => {
      addToast(
        `새로운 IDE 업데이트(v${info.version || ''})가 발견되어 다운로드를 시작합니다.`,
        'info',
        5000
      )
    })

    const unsubDownloaded = window.api.updater.onUpdateDownloaded((info) => {
      setUpdateInfo(info)
      setIsUpdateDownloaded(true)
      addToast(
        '새로운 업데이트 다운로드가 완료되었습니다. 설치를 준비합니다.',
        'success',
        5000
      )
    })

    const unsubError = window.api.updater.onError((err) => {
      console.error('[Updater Error]', err)
      addToast(`업데이트 과정 중 오류가 발생했습니다: ${err}`, 'error', 5000)
    })

    return () => {
      unsubAvailable()
      unsubDownloaded()
      unsubError()
    }
  }, [addToast])

  const handleConfirm = async () => {
    setIsUpdateDownloaded(false)
    try {
      await window.api.updater.quitAndInstall()
    } catch (e: any) {
      addToast(`재시작 설치 실패: ${e.message}`, 'error')
    }
  }

  return (
    <ConfirmDialogBox
      isOpen={isUpdateDownloaded}
      title="IDE 업데이트 설치 준비 완료"
      message={`Fumika IDE 새 버전(v${updateInfo?.version || ''}) 설치 준비가 완료되었습니다. 지금 애플리케이션을 다시 시작하여 업데이트를 적용하시겠습니까?`}
      confirmText="지금 재시작"
      cancelText="나중에"
      type="info"
      onConfirm={handleConfirm}
      onCancel={() => setIsUpdateDownloaded(false)}
    />
  )
}
