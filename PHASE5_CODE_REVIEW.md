# Phase 5 Code Review — A-Vi
**Context-Aware AI Video Editor**
_Reviewed: 2026-04-06 | Scope: Security, Data Flow, UX Resilience_

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 7 |
| 🟡 Minor Refactor | 8 |
| 🟢 Solid / Production-Ready | 12 |

---

## 1. Database & Authentication (Supabase)

### 🟢 Solid

- **RLS policies are correctly implemented** across all three tables. `projects` has all four operations (SELECT, INSERT `WITH CHECK`, UPDATE, DELETE) scoped to `auth.uid() = user_id`. `assets` mirrors this pattern. The `INSERT` policies use `WITH CHECK` (not just `USING`), which is correct.
- **`handle_new_user()` trigger** is `SECURITY DEFINER` — it correctly runs with elevated privileges to insert into `profiles` without needing a client-side INSERT RLS policy.
- **Auth listener cleanup** is properly returned from the `useEffect` in `authContext.tsx:37` (`subscription.unsubscribe()`).
- **Auth guard** works correctly for a single-page app: `App.tsx:53–60` renders `<AuthModal>` when `!authLoading && !user`, blocking the editor without requiring a router.

### 🟡 Minor

- **`getUser()` extra round-trips** — `projectService.ts:31` and `assetService.ts:28` both call `await supabase.auth.getUser()` to pass `user_id` to inserts. Supabase RLS handles identity server-side; the `user_id` in the payload is redundant since `WITH CHECK (auth.uid() = user_id)` validates it anyway. You could remove the explicit `user_id` insert field and let RLS enforce it, or use the session from `AuthContext` instead of making a fresh network call.
- **No `INSERT` RLS policy on `profiles`** — the trigger handles it (correctly), but the schema comment doesn't document that omission. Future engineers might think it's a bug.

### 🔴 Critical

- **Storage bucket visibility vs. `getPublicUrl`** (`assetService.ts:64`) — The schema comments say the bucket is **private**, but the code calls `supabase.storage.from('assets').getPublicUrl(filePath)`. Public URLs bypass storage-level access control entirely — any unauthenticated user with the URL can access private video files. For a private bucket you must use `createSignedUrl(filePath, expiresIn)`. Either make the bucket truly public (and accept that URLs are guessable), or switch to signed URLs for all asset reads.

---

## 2. State Persistence (Zustand ↔ PostgreSQL)

### 🟢 Solid

- **Debounced auto-save** is cleanly implemented. `createAutoSave(3000)` in `projectService.ts:135` correctly replaces the pending save on each schedule call (no queuing), and `flush()` forces an immediate save.
- **`autoSaveRef` uses `useRef`** (`useProjectManager.ts:14`) so the debouncer instance is stable across re-renders — no accidental timer resets.
- **`beforeunload` guard** on `useProjectManager.ts:75` correctly calls `e.preventDefault()` and sets `e.returnValue = ''` to trigger the browser confirmation.
- **`schema_version` column** is a good forward-thinking design for future migrations.

### 🟡 Minor

- **`projectIdRef` is not reactive** — `useProjectManager` returns `projectId: projectIdRef.current`. Since refs don't trigger re-renders, the first render always returns `null`. Child components like `AssetUpload` receive a stale `null` and upload assets with no `project_id`. A `useState` + `useRef` pairing (state for rendering, ref for the closure used in the auto-save callback) would fix this.
- **No Zod/JSON schema validation on deserialization** — `getProject()` returns raw JSONB from Postgres directly typed as `Track[]` with no runtime shape validation. If the `composition_tree` data was written by an older schema version, it would silently break the editor. A light validation step on load would be safer.

### 🔴 Critical

- **`forceSave` double-writes** (`useProjectManager.ts:59–68`) — `flush()` already calls the pending `saveFn`. Calling `updateProjectComposition` directly after sends a duplicate write immediately:

  ```ts
  // CURRENT (broken)
  await autoSaveRef.current.flush()      // saves once
  await updateProjectComposition(...)    // saves AGAIN — redundant

  // FIXED
  await autoSaveRef.current.flush()      // flush handles everything
  ```

- **`hasUnsavedChanges` is `true` on first load** — `useProjectManager.ts:39` unconditionally calls `setHasUnsavedChanges(true)` inside the auto-save effect. This effect runs on mount, so the unsaved-changes dot appears in the header and the sign-out confirmation dialog fires before the user has made a single edit.

---

## 3. Asset Management (Supabase Storage)

### 🟢 Solid

- **File type validation** is done via MIME type (`file.type.startsWith('video/')`) before upload — safer against extension spoofing.
- **50MB client-side check** provides immediate feedback before any network call.
- **Unique file paths** use `${Date.now()}-${Math.random()}` within a user-namespaced folder (`${userId}/...`), preventing collisions and naturally scoping files per user.

### 🟡 Minor

- **`onProgress` callback is dead code** — `UploadAssetOptions` declares `onProgress?: (progress: number) => void` (`assetService.ts:19`) and `AssetUpload.tsx` renders a progress bar, but `onProgress` is never called inside `uploadAsset`. The progress bar is hardcoded at `0%` for the entire upload. Either implement real progress via `XMLHttpRequest` or remove the parameter and bar to avoid false signals.
- **No upload timeout** — For large files near the 50MB limit the upload can silently stall. The UI stays in "Uploading..." forever. Add an `AbortController` with a sensible timeout (e.g., 60s) and surface a user-facing error on abort.

### 🔴 Critical

- **Storage orphan on DB failure** (`assetService.ts:51–88`) — The file is uploaded to storage first, then metadata is written to the DB. If the DB insert fails (line 84), the file is permanently orphaned in storage with no cleanup path.

  ```ts
  // CURRENT (broken order)
  await supabase.storage.upload(filePath, file)   // succeeds
  await supabase.from('assets').insert(...)        // fails → orphan

  // FIXED: add cleanup in catch
  } catch (dbError) {
    await supabase.storage.from('assets').remove([filePath]) // rollback
    throw dbError
  }
  ```

- **Storage orphan on `deleteAsset` failure** (`assetService.ts:109–129`) — DB row is deleted first; if the storage delete then fails, the file lives in storage forever with no reference. Reverse the order: delete from storage first, then remove the DB row.

- **`handleSave` in `App.tsx` is a fake save** (`App.tsx:34–39`) — `forceSave()` from `useProjectManager` is **never called**. The button shows a success toast unconditionally after 500ms regardless of any DB write:

  ```ts
  // CURRENT (fake)
  const handleSave = async () => {
    toast.info('Saving project...')
    setTimeout(() => {
      toast.success('Project saved successfully!')  // always fires
    }, 500)
  }

  // FIXED
  const { forceSave, hasUnsavedChanges } = useProjectManager()
  const handleSave = async () => {
    toast.info('Saving project...')
    try {
      await forceSave()
      toast.success('Project saved!')
    } catch {
      toast.error('Save failed. Please try again.')
    }
  }
  ```

---

## 4. UX Polish & Error Handling

### 🟢 Solid

- **AI prompt loading state** is correctly gated — `PromptModal.tsx:81` guards `if (status === 'loading') return` and disables the button, preventing duplicate submissions.
- **Inline error panel in PromptModal** (`PromptModal.tsx:285–299`) renders the actual error message, not just a generic toast.
- **Ghost preview / split-screen** review flow is an excellent UX pattern — `handlePreview` stages the AI result without committing it, letting users compare before accepting.
- **Offline indicator** in `App.tsx:204–218` is non-blocking and uses appropriate amber warning styling.
- **Auth loading screen** with centered spinner and branding is smooth.

### 🟡 Minor

- **System prompt exposed in UI** — `PromptModal.tsx:356–382` renders the full raw system prompt (including the entire serialized composition JSON) in a `<details>` element. In production, this leaks internal data structure to any user who expands it. Hide behind an admin/dev flag or remove it.
- **Upload error toast is too generic** — `AssetUpload.tsx:46` shows `'Failed to upload asset'`. Passing `error.message` into the toast would surface actionable info (quota exceeded, network error, auth expired, etc.).
- **Project ID in header is a raw UUID** — `App.tsx:199` shows `ID: {projectId.slice(0,8)}...` which is meaningless to users. Replace with the project `name` field fetched once on load.

### 🔴 Critical

- **Gemini API key hardcoded in source** (`prompt.ts:33`):

  ```ts
  // CURRENT (dangerous)
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyD8N_...'

  // FIXED
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY env var is not set')
  ```

  A live API key committed as a fallback literal will be scraped by bots within minutes of being pushed to any public repository. Remove the fallback entirely.

- **CORS hardcoded for localhost only** — The API's CORS config scopes to `localhost:3000`. Any staging or production deployment will block all browser requests. Move the allowed origin to an environment variable.

- **Gemini response injected into state without validation** — If Gemini returns JSON that doesn't match `{ tracks: Track[] }` (e.g., missing `clips`, wrong field types), `setProposedComposition` stores malformed data and the Remotion player will crash. Add a shape check before calling `setProposedComposition`.

---

## 5. UI Change Suggestions

| # | Location | Change |
|---|----------|--------|
| 1 | `App.tsx:199` | Replace the UUID fragment with the project `name`. Use a truncated `<span title={fullName}>` if too long. |
| 2 | `App.tsx:34–39` | Wire the Save button to `forceSave()` with a real try/catch. Show `"Saved ✓"` (muted green) when `!hasUnsavedChanges` and `"Save •"` (amber) when dirty. |
| 3 | `AssetUpload.tsx:90–99` | Replace the static 0%-width progress bar with a CSS indeterminate shimmer animation — communicates "in progress" without lying about percentage. |
| 4 | `App.tsx:144–180` | The Undo/Redo/shortcuts buttons have `transition: 'all 0.2s'` but no hover style change. Add `onMouseEnter`/`onMouseLeave` handlers or move to a CSS class so they visually respond. |
| 5 | `App.tsx:241–254` | Add `title={user?.email}` to the avatar container div — hovering reveals the full email with zero added complexity. |
| 6 | `App.tsx:204–218` | Add a CSS pulse animation to the `⚠` glyph in the offline badge to draw attention without being obtrusive. |

---

## Quick-Fix Priority Order

1. 🔴 Remove hardcoded Gemini API key (`prompt.ts:33`)
2. 🔴 Fix `handleSave` to actually call `forceSave()` (`App.tsx:34`)
3. 🔴 Switch private bucket reads from `getPublicUrl` to `createSignedUrl` (`assetService.ts:64`)
4. 🔴 Add storage rollback on DB failure in `uploadAsset` (`assetService.ts:84`)
5. 🔴 Fix `deleteAsset` to delete storage before DB (`assetService.ts:109`)
6. 🔴 Validate Gemini response shape before `setProposedComposition`
7. 🟡 Fix `projectIdRef` reactivity with a `useState` pair (`useProjectManager.ts`)
8. 🟡 Fix `hasUnsavedChanges` false positive on mount (`useProjectManager.ts:39`)
9. 🟡 Fix `forceSave` double-write (`useProjectManager.ts:59`)
10. 🟡 Move CORS origin to env var (`api/src/index.ts`)
