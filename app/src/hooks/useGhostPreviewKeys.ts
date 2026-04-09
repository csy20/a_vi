import { useEffect } from 'react'
import { useEditorStore } from '../store/useEditorStore'

/**
 * Global keyboard shortcuts for the ghost preview and history.
 *
 * Enter        → accept proposal  (only when proposal exists AND prompt is closed)
 * Esc          → reject proposal  (only when proposal exists AND prompt is closed)
 * Cmd/Ctrl+Z   → undo
 * Cmd/Ctrl+⇧Z  → redo
 */
export const useGhostPreviewKeys = () => {
  const proposedComposition = useEditorStore((s) => s.proposedComposition)
  const isPromptOpen        = useEditorStore((s) => s.isPromptOpen)
  const acceptProposal      = useEditorStore((s) => s.acceptProposal)
  const rejectProposal      = useEditorStore((s) => s.rejectProposal)
  const undo                = useEditorStore((s) => s.undo)
  const redo                = useEditorStore((s) => s.redo)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      // ── Accept / Reject (proposal must exist, prompt must be closed) ────────
      if (proposedComposition && !isPromptOpen) {
        if (e.key === 'Enter') {
          e.preventDefault()
          acceptProposal()
          return
        }
        if (e.key === 'Escape') {
          rejectProposal()
          return
        }
      }

      // ── Undo (⌘Z / Ctrl+Z) ──────────────────────────────────────────────────
      if (mod && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        undo()
        return
      }

      // ── Redo (⌘⇧Z / Ctrl+⇧Z / Ctrl+Y) ─────────────────────────────────────
      if ((mod && e.shiftKey && e.key === 'z') || (mod && e.key === 'y')) {
        e.preventDefault()
        redo()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [proposedComposition, isPromptOpen, acceptProposal, rejectProposal, undo, redo])
}
