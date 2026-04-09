import { useEffect, useRef, useCallback, useState } from 'react'
import { useEditorStore } from '../store/useEditorStore'
import { useAuth } from '../lib/authContext'
import { createProject, getProject, updateProjectComposition, createAutoSave } from '../lib/projectService'
import { resolveTracksWithAssets } from '../lib/assetService'
import { toast } from '../lib/toastStore'

export function useProjectManager() {
  const { user, loading: authLoading } = useAuth()
  const compositionTree = useEditorStore((state) => state.compositionTree)
  const totalFrames = useEditorStore((state) => state.totalFrames)
  const fps = useEditorStore((state) => state.fps)
  const hydrateProject = useEditorStore((state) => state.hydrateProject)

  const projectIdRef = useRef<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectStatus, setProjectStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [projectError, setProjectError] = useState<string | null>(null)
  const autoSaveRef = useRef(createAutoSave(3000))
  const isInitializingRef = useRef(false)
  const initInFlightRef = useRef(false)
  const skipNextSaveRef = useRef(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const initializeProject = useCallback(async (cancelled: { value: boolean }) => {
    if (initInFlightRef.current) return
    initInFlightRef.current = true
    isInitializingRef.current = true
    setProjectStatus('loading')
    setProjectError(null)

    const userId = user?.id
    if (!userId) {
      initInFlightRef.current = false
      isInitializingRef.current = false
      setProjectError('auth/session missing — please sign in again')
      setProjectStatus('error')
      return
    }

    const createFreshProject = async () => {
      const editorState = useEditorStore.getState()
      const project = await createProject({
        composition_tree: editorState.compositionTree,
        total_frames: editorState.totalFrames,
        fps: editorState.fps,
      })

      if (cancelled.value) return

      projectIdRef.current = project.id
      setProjectId(project.id)
      localStorage.setItem('currentProjectId', project.id)
      setHasUnsavedChanges(false)
      setProjectStatus('ready')
    }

    try {
      const savedProjectId = localStorage.getItem('currentProjectId')

      if (!savedProjectId) {
        await createFreshProject()
        return
      }

      let project = null
      try {
        project = await getProject(savedProjectId)
      } catch {
        // stale or invalid ID — clear and create fresh
        localStorage.removeItem('currentProjectId')
        await createFreshProject()
        return
      }

      if (!project) {
        localStorage.removeItem('currentProjectId')
        await createFreshProject()
        return
      }

      const resolvedTracks = await resolveTracksWithAssets(project.composition_tree || [], project.fps)
      if (cancelled.value) return

      const missingCount = resolvedTracks
        .flatMap((track) => track.clips)
        .filter((clip) => clip.assetId && clip.isMissingAsset)
        .length

      projectIdRef.current = project.id
      setProjectId(project.id)
      skipNextSaveRef.current = true
      hydrateProject({
        tracks: resolvedTracks,
        totalFrames: project.total_frames,
        fps: project.fps,
      })
      localStorage.setItem('currentProjectId', project.id)
      setHasUnsavedChanges(false)
      setProjectStatus('ready')

      if (missingCount > 0) {
        toast.warning(`${missingCount} media file${missingCount === 1 ? '' : 's'} missing from local storage`)
      }
    } catch (error) {
      console.error('Project initialization failed:', error)
      localStorage.removeItem('currentProjectId')

      if (!cancelled.value) {
        const message =
          error instanceof Error ? error.message : 'project create failed — unknown error'
        setProjectError(message)
        setProjectStatus('error')
        toast.error('Failed to set up project. Use Retry in the canvas.')
      }
    } finally {
      initInFlightRef.current = false
      if (!cancelled.value) {
        isInitializingRef.current = false
      }
    }
  }, [user, hydrateProject])

  useEffect(() => {
    if (!user || authLoading) return

    const cancelled = { value: false }
    initializeProject(cancelled)

    return () => {
      cancelled.value = true
    }
  }, [user, authLoading, initializeProject])

  const retryProjectInit = useCallback(async () => {
    if (!user) return
    initInFlightRef.current = false // reset guard so retry can run
    const cancelled = { value: false }
    await initializeProject(cancelled)
  }, [user, initializeProject])

  useEffect(() => {
    if (!user || !projectIdRef.current || isInitializingRef.current) return

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      setHasUnsavedChanges(false)
      return
    }

    autoSaveRef.current.schedule(async () => {
      try {
        await updateProjectComposition(projectIdRef.current!, compositionTree, totalFrames, fps)
        setHasUnsavedChanges(false)
      } catch (error) {
        console.error('Auto-save failed:', error)
        toast.error('Failed to auto-save. Please use the Save button.')
      }
    })

    setHasUnsavedChanges(true)
  }, [compositionTree, totalFrames, fps, user])

  const forceSave = useCallback(async () => {
    if (!projectIdRef.current || !user) return

    await autoSaveRef.current.flush()
  }, [user])

  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  return {
    projectId,
    projectStatus,
    projectError,
    retryProjectInit,
    forceSave,
    hasUnsavedChanges,
  }
}
