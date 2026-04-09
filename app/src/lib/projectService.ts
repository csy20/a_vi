import { supabase } from '../lib/supabaseClient'
import { Track } from '../store/useEditorStore'
import { deleteProjectAssets } from './assetService'

function normalizeSupabaseError(error: unknown, fallback: string): string {
  if (!error) return fallback
  if (typeof error === 'object') {
    const e = error as Record<string, unknown>
    // Supabase errors have a `message` field and sometimes a `code` field
    const msg = typeof e.message === 'string' ? e.message : null
    const code = typeof e.code === 'string' ? e.code : null
    if (code === 'PGRST116') return 'project not found — it may have been deleted'
    if (msg?.includes('row-level security')) return 'permission denied — auth session may be expired'
    if (msg?.includes('JWT')) return 'auth/session expired — please sign in again'
    if (msg) return msg
  }
  if (typeof error === 'string') return error
  return fallback
}

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  thumbnail_url: string | null
  fps: number
  total_frames: number
  schema_version: number
  composition_tree: Track[]
  created_at: string
  updated_at: string
}

export interface CreateProjectData {
  user_id: string
  name?: string
  description?: string
  fps?: number
  total_frames?: number
  composition_tree?: Track[]
}

// Create a new project
export async function createProject(data: CreateProjectData): Promise<Project> {
  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      user_id: data.user_id,
      name: data.name || 'Untitled Project',
      description: data.description || null,
      fps: data.fps || 30,
      total_frames: data.total_frames || 150,
      composition_tree: data.composition_tree || [],
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create project:', error)
    throw new Error(normalizeSupabaseError(error, 'project create failed'))
  }

  if (!project) {
    throw new Error('project create failed — server returned no data')
  }

  return project
}

// Get all projects for the current user
export async function getProjects(): Promise<Project[]> {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch projects:', error)
    throw error
  }

  return projects || []
}

// Get a single project by ID
export async function getProject(id: string): Promise<Project | null> {
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    // PGRST116 = row not found — treat as stale ID, not a hard error
    if ((error as any).code === 'PGRST116') return null
    console.error('Failed to fetch project:', error)
    throw new Error(normalizeSupabaseError(error, 'project fetch failed'))
  }

  return project
}

// Update project composition tree
export async function updateProjectComposition(
  projectId: string,
  compositionTree: Track[],
  totalFrames?: number,
  fps?: number
): Promise<void> {
  const updates: any = {
    composition_tree: compositionTree,
  }

  if (totalFrames !== undefined) updates.total_frames = totalFrames
  if (fps !== undefined) updates.fps = fps

  const { error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)

  if (error) {
    console.error('Failed to update project:', error)
    throw error
  }
}

// Update project metadata
export async function updateProjectMetadata(
  projectId: string,
  data: Partial<Pick<Project, 'name' | 'description' | 'thumbnail_url'>>
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update(data)
    .eq('id', projectId)

  if (error) {
    console.error('Failed to update project metadata:', error)
    throw error
  }
}

// Delete a project
export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) {
    console.error('Failed to delete project:', error)
    throw error
  }

  await deleteProjectAssets(projectId)
}

// Auto-save helper (debounced save)
export function createAutoSave(debounceMs: number = 3000) {
  let timeoutId: NodeJS.Timeout | null = null
  let pendingSave: (() => Promise<void>) | null = null

  return {
    schedule: (saveFn: () => Promise<void>) => {
      pendingSave = saveFn

      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(() => {
        if (pendingSave) {
          pendingSave().catch(console.error)
          pendingSave = null
        }
      }, debounceMs)
    },

    flush: async () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (pendingSave) {
        await pendingSave()
        pendingSave = null
      }
    },
  }
}
