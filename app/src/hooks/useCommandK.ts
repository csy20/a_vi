import { useEffect } from 'react'
import { useEditorStore } from '../store/useEditorStore'
import { hasUsableVideoClips } from '../lib/editorUtils'
import { toast } from '../lib/toastStore'

/**
 * Registers a global keyboard shortcut:
 *   Cmd+K  (macOS)  or  Ctrl+K  (Win/Linux)  → open/close the AI prompt modal
 *   Escape → close if open
 */
export const useCommandK = () => {
  const isPromptOpen = useEditorStore((s) => s.isPromptOpen)
  const openPrompt   = useEditorStore((s) => s.openPrompt)
  const closePrompt  = useEditorStore((s) => s.closePrompt)
  const compositionTree = useEditorStore((s) => s.compositionTree)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isTrigger = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'

      if (isTrigger) {
        e.preventDefault()
        if (!hasUsableVideoClips(compositionTree)) {
          toast.info('Upload a video first, then AI can edit your timeline.')
          return
        }

        isPromptOpen ? closePrompt() : openPrompt()
        return
      }

      if (e.key === 'Escape' && isPromptOpen) {
        closePrompt()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [compositionTree, isPromptOpen, openPrompt, closePrompt])
}
