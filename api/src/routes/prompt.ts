import { Router, Request, Response } from 'express'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────
interface Clip {
  id: string
  trackId: string
  startFrame: number
  endFrame: number
  label: string
  color: string
  assetUrl?: string
  assetId?: string
  mediaType?: 'video' | 'audio' | 'image' | 'text'
  mediaStart?: number
  mediaEnd?: number
  mediaDurationFrames?: number
  opacity?: number
  text?: string
  fontSize?: number
  fontColor?: string
}

interface Track {
  id: string
  name: string
  type: 'video' | 'audio' | 'overlay'
  clips: Clip[]
}

interface PromptBody {
  prompt: string
  frameRange: { startFrame: number; endFrame: number } | null
  compositionContext: {
    tracks: Track[]
    totalFrames: number
    fps: number
  }
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

// ── Gemini API Integration ────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

if (!GEMINI_API_KEY) {
  console.error('⚠️  GEMINI_API_KEY environment variable is not set!')
  console.error('Please add it to your .env file in the api/ directory.')
}

async function callGeminiAPI(systemPrompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: systemPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      })
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`)
  }

  const data = await response.json() as GeminiResponse
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Colour palette for mock mutations ─────────────────────────────────────────
const COLOUR_MAP: Record<string, string> = {
  red:    '#e94560',
  blue:   '#1a6cf0',
  green:  '#059669',
  purple: '#7c3aed',
  orange: '#f97316',
  yellow: '#eab308',
  pink:   '#ec4899',
  cyan:   '#06b6d4',
  white:  '#f0f0f0',
  black:  '#111111',
}

// ── Mock LLM: applies heuristic mutations based on prompt keywords ─────────────
function mockLLM(body: PromptBody): { tracks: Track[]; explanation: string } {
  const { prompt, frameRange, compositionContext } = body
  const p = prompt.toLowerCase()
  const changes: string[] = []

  // Determine which clips are "in scope"
  const inScope = (clip: Clip): boolean => {
    if (!frameRange) return true
    return clip.startFrame <= frameRange.endFrame && clip.endFrame >= frameRange.startFrame
  }

  let modifiedTracks: Track[] = compositionContext.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip): Clip => {
      if (!inScope(clip)) return clip

      let c = { ...clip }

      // ── Colour change ──────────────────────────────────────────────────────
      for (const [word, hex] of Object.entries(COLOUR_MAP)) {
        if (p.includes(word)) {
          c.color = hex
          changes.push(`Changed "${c.label}" colour to ${word}`)
          break
        }
      }

      // ── Extend / shorten ──────────────────────────────────────────────────
      if (p.includes('longer') || p.includes('extend') || p.includes('stretch')) {
        const delta = extractFrameCount(p) ?? 15
        c.endFrame = Math.min(c.endFrame + delta, compositionContext.totalFrames - 1)
        changes.push(`Extended "${c.label}" by ${delta} frames`)
      }
      if (p.includes('shorter') || p.includes('trim') || p.includes('shorten')) {
        const delta = extractFrameCount(p) ?? 15
        c.endFrame = Math.max(c.endFrame - delta, c.startFrame + 5)
        // Also adjust media end if applicable
        if (c.mediaEnd != null && c.mediaStart != null) {
          const newDuration = c.endFrame - c.startFrame
          c.mediaEnd = Math.min(c.mediaStart + newDuration, c.mediaEnd)
        }
        changes.push(`Trimmed "${c.label}" by ${delta} frames`)
      }

      // ── Rename ────────────────────────────────────────────────────────────
      if (p.includes('rename') || p.includes('label') || p.includes('call it')) {
        const match = prompt.match(/(?:rename|label|call it)\s+(?:to\s+)?["']?([^"'\n]+?)["']?$/i)
        if (match?.[1]) {
          changes.push(`Renamed "${c.label}" → "${match[1].trim()}"`)
          c.label = match[1].trim()
        }
      }

      // ── Opacity ─────────────────────────────────────────────────────────
      if (p.includes('transparent') || p.includes('opacity') || p.includes('fade')) {
        c.opacity = 0.5
        changes.push(`Set "${c.label}" opacity to 50%`)
      }

      return c
    }),
  }))

  // ── Split operation ────────────────────────────────────────────────────────
  if (p.includes('split')) {
    modifiedTracks = modifiedTracks.map((track) => {
      const newClips: Clip[] = []
      for (const clip of track.clips) {
        if (!inScope(clip)) {
          newClips.push(clip)
          continue
        }
        const mid = Math.floor((clip.startFrame + clip.endFrame) / 2)
        const mediaMid = clip.mediaStart != null
          ? clip.mediaStart + (mid - clip.startFrame)
          : undefined

        const left: Clip = {
          ...clip,
          endFrame: mid - 1,
          mediaEnd: mediaMid != null ? mediaMid - 1 : clip.mediaEnd,
          label: clip.label + ' (L)',
        }
        const right: Clip = {
          ...clip,
          id: `clip-split-${Date.now()}`,
          startFrame: mid,
          mediaStart: mediaMid ?? clip.mediaStart,
          label: clip.label + ' (R)',
        }
        newClips.push(left, right)
        changes.push(`Split "${clip.label}" at frame ${mid}`)
      }
      return { ...track, clips: newClips }
    })
  }

  // ── Add text overlay ───────────────────────────────────────────────────────
  if (p.includes('add text') || p.includes('text overlay') || p.includes('add title')) {
    const textMatch = prompt.match(/(?:text|title)\s+["']([^"']+)["']/i)
    const text = textMatch?.[1] || 'Sample Text'

    // Find or create overlay track
    let overlayTrack = modifiedTracks.find((t) => t.type === 'overlay')
    if (!overlayTrack) {
      overlayTrack = { id: `track-overlay-${Date.now()}`, name: 'Overlay 1', type: 'overlay', clips: [] }
      modifiedTracks.push(overlayTrack)
    }

    const newClip: Clip = {
      id: `clip-text-${Date.now()}`,
      trackId: overlayTrack.id,
      startFrame: frameRange?.startFrame ?? 0,
      endFrame: frameRange?.endFrame ?? 59,
      label: text,
      color: '#7c3aed',
      mediaType: 'text',
      text,
      fontSize: 48,
      fontColor: '#ffffff',
      opacity: 1,
    }
    overlayTrack.clips.push(newClip)
    changes.push(`Added text overlay: "${text}"`)
  }

  const explanation =
    changes.length > 0
      ? changes.join('. ') + '.'
      : 'No matching mutations detected for this prompt — composition returned unchanged.'

  return { tracks: modifiedTracks, explanation }
}

/** Pull the first integer from a prompt string (e.g. "extend by 20 frames" → 20). */
function extractFrameCount(text: string): number | null {
  const m = text.match(/(\d+)\s*(?:frames?|f\b)/)
  return m ? parseInt(m[1], 10) : null
}

// ── POST /api/prompt ──────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as PromptBody

  if (!body.prompt || !body.compositionContext) {
    res.status(400).json({ success: false, error: 'prompt and compositionContext are required' })
    return
  }

  try {
    const rangeDesc = body.frameRange
      ? `frames ${body.frameRange.startFrame}–${body.frameRange.endFrame}`
      : 'full composition'

    const systemPrompt = [
      'You are a Remotion composition code generator / video editor AI.',
      '',
      `User instruction: "${body.prompt}"`,
      `Scope: ${rangeDesc}`,
      '',
      'Given the following composition JSON, return a modified version that satisfies',
      'the instruction. Preserve all clip IDs unless splitting or removing clips.',
      'Only modify clips within the specified frame range unless the instruction explicitly targets others.',
      '',
      '## Clip Fields',
      '- id, trackId, startFrame, endFrame: position on timeline',
      '- label: display name, color: hex color',
      '- assetUrl: URL to the media file (do NOT change this)',
      '- assetId: database reference (do NOT change this)',
      '- mediaType: "video" | "audio" | "image" | "text"',
      '- mediaStart, mediaEnd: trim points within the source media (in frames)',
      '- mediaDurationFrames: total frames in source media',
      '- opacity: 0 to 1 (transparency)',
      '- text, fontSize, fontColor: for text overlay clips (mediaType="text")',
      '',
      '## Supported Operations',
      '- TRIM: adjust mediaStart/mediaEnd and startFrame/endFrame to trim video',
      '- SPLIT: create two clips from one (generate new id for the second, e.g. "clip-split-{timestamp}")',
      '- REORDER: change startFrame/endFrame to move clips on the timeline',
      '- REMOVE: remove clips from tracks',
      '- ADD TEXT OVERLAY: add new clip with mediaType="text", text, fontSize, fontColor',
      '- ADJUST OPACITY: change opacity value (0-1)',
      '- CHANGE COLOR/LABEL: modify visual properties',
      '',
      'Return ONLY valid JSON — no markdown, no explanation outside the JSON object.',
      'The JSON must have this exact structure:',
      '{ "tracks": [...], "totalFrames": number, "fps": number }',
      '',
      '--- COMPOSITION INPUT ---',
      JSON.stringify(body.compositionContext, null, 2),
    ].join('\n')

    // Call Gemini API
    const geminiResponse = await callGeminiAPI(systemPrompt)
    
    // Parse the response
    let modifiedComposition
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = geminiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      modifiedComposition = JSON.parse(cleanedResponse)
    } catch (parseError) {
      // Fallback to mock LLM if parsing fails
      console.warn('Failed to parse Gemini response, falling back to mock LLM')
      const { tracks, explanation } = mockLLM(body)
      modifiedComposition = {
        tracks,
        totalFrames: body.compositionContext.totalFrames,
        fps: body.compositionContext.fps,
      }
    }

    const explanation = `AI applied your prompt: "${body.prompt}"`

    res.json({
      success: true,
      explanation,
      systemPrompt,
      modifiedComposition,
    })
  } catch (error) {
    console.error('Error calling Gemini API:', error)
    
    // Fallback to mock LLM on error
    const { tracks, explanation } = mockLLM(body)
    
    res.json({
      success: true,
      explanation: explanation + ' (using fallback mode)',
      systemPrompt: 'Error occurred, using fallback',
      modifiedComposition: {
        tracks,
        totalFrames: body.compositionContext.totalFrames,
        fps: body.compositionContext.fps,
      },
    })
  }
})

export default router
