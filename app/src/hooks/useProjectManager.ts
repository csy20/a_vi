import { useEffect, useRef, useCallback, useState } from 'react'
import { useEditorStore } from '../store/useEditorStore'
import { useAuth } from '../lib/authContext'
import { createProject, getProject, updateProjectComposition, createAutoSave } from '../lib/projectService'
import { resolveTracksWithAssets } from '../lib/assetService'
import { normalizeTimeline, repairTracks } from '../lib/clipValidation'
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
  const isInitialized = useRef(false)
  const initInFlightRef = useRef(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const updateProjectId = useCallback((id: string) => {
    projectIdRef.current = id
    setProjectId(id)
  }, [])

  const initializeProject = useCallback(async (cancelled: { value: boolean }) => {
    if (initInFlightRef.current) return
    initInFlightRef.current = true
    isInitializingRef.current = true
    isInitialized.current = false
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

      updateProjectId(project.id)
      localStorage.setItem('currentProjectId', project.id)
      setHasUnsavedChanges(false)
      setProjectStatus('ready')
      isInitialized.current = true
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

      // FIX: 3 - repair and normalize reloaded timelines so playback and viewport restart at frame 0.
      const repairedTimeline = repairTracks(resolvedTracks)
      const normalizedTimeline = normalizeTimeline(repairedTimeline.tracks)

      const missingCount = normalizedTimeline.tracks
        .flatMap((track) => track.clips)
        .filter((clip) => clip.assetId && clip.isMissingAsset)
        .length

      updateProjectId(project.id)
      hydrateProject({
        tracks: normalizedTimeline.tracks,
        totalFrames: Math.max(0, project.total_frames - normalizedTimeline.offsetFrames),
        fps: project.fps,
      })
      localStorage.setItem('currentProjectId', project.id)
      setHasUnsavedChanges(false)
      setProjectStatus('ready')

      if (missingCount > 0) {
        // FIX: 2 - prompt the user to re-upload any asset that is missing locally after reload.
        toast.warning(`${missingCount} media file${missingCount === 1 ? '' : 's'} missing from local storage. Re-upload from Assets to restore playback.`)
      }

      if (repairedTimeline.removedCount > 0 || repairedTimeline.repairedCount > 0 || normalizedTimeline.offsetFrames !== 0) {
        toast.info(
          `Timeline repaired on load${normalizedTimeline.offsetFrames !== 0 ? ` and shifted by ${normalizedTimeline.offsetFrames} frame${normalizedTimeline.offsetFrames === 1 ? '' : 's'}` : ''}.`
        )
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
  }, [user, hydrateProject, updateProjectId])

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

    if (!isInitialized.current) {
      isInitialized.current = true
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
    setHasUnsavedChanges(false)
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
