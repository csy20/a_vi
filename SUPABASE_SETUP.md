# Supabase Integration Setup Guide

## 🚀 Quick Start

### 1. Run the Database Schema

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/xdnxghixpxoewnzbnfho
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase_schema.sql`
4. Click **Run** to execute the schema

This will create:
- `profiles` table (extends auth.users)
- `projects` table (stores your video composition trees)
- `assets` table (manages uploaded media files)
- Row Level Security (RLS) policies
- Auto-triggers for user profiles and timestamps

### 2. Create Storage Bucket

1. In Supabase Dashboard, go to **Storage**
2. Click **New Bucket**
3. Name it: `assets`
4. Set to **Private**
5. Click **Create**

#### Add Storage Policies:

Go to the `assets` bucket → **Policies** tab → **New Policy**

**Policy 1 - Upload:**
- Name: `Allow authenticated users to upload`
- Operation: INSERT
- Target roles: authenticated
- Policy definition: `auth.role() = 'authenticated'`

**Policy 2 - Read:**
- Name: `Allow authenticated users to read`
- Operation: SELECT
- Target roles: authenticated  
- Policy definition: `auth.role() = 'authenticated'`

**Policy 3 - Delete:**
- Name: `Allow authenticated users to delete`
- Operation: DELETE
- Target roles: authenticated
- Policy definition: `auth.role() = 'authenticated'`

### 3. Enable GitHub OAuth (Optional)

1. Go to **Authentication** → **Providers**
2. Enable **GitHub**
3. Add your GitHub OAuth App credentials:
   - Create an OAuth App at: https://github.com/settings/developers
   - Authorization callback URL: `https://xdnxghixpxoewnzbnfho.supabase.co/auth/v1/callback`
4. Save the configuration

### 4. Test the Integration

```bash
cd app
npm install
npm run dev
```

Your app will now:
- ✅ Require authentication before accessing the editor
- ✅ Auto-create projects for new users
- ✅ Auto-save composition changes every 3 seconds
- ✅ Support email/password and GitHub login
- ✅ Show toast notifications for success/error states
- ✅ Display loading spinners during AI generation

## 📁 What Was Added

### Core Files
- `app/supabase_schema.sql` - Complete database schema
- `app/src/lib/authContext.tsx` - Authentication context provider
- `app/src/lib/projectService.ts` - Project CRUD operations
- `app/src/lib/assetService.ts` - File upload/download utilities
- `app/src/lib/toastStore.ts` - Toast notification system

### Components
- `app/src/components/AuthModal/AuthModal.tsx` - Login/signup UI
- `app/src/components/ToastContainer/ToastContainer.tsx` - Toast notifications
- `app/src/components/Spinner/Spinner.tsx` - Loading spinners

### Hooks
- `app/src/hooks/useProjectManager.ts` - Auto-save functionality

### Updated Files
- `app/src/App.tsx` - Integrated auth, toasts, and project manager
- `app/src/main.tsx` - Wrapped with AuthProvider
- `app/src/components/PromptModal/PromptModal.tsx` - Added toast notifications

## 🎯 Features Implemented

### 1. **Authentication**
- Email/Password signup and login
- GitHub OAuth (after setup)
- Persistent sessions
- Automatic profile creation

### 2. **Project Persistence**
- Auto-save every 3 seconds (debounced)
- Force save on page unload
- Load project on app start
- Store composition tree as JSONB in PostgreSQL

### 3. **Asset Management**
- Upload video/audio/image files to Supabase Storage
- Track asset metadata in database
- Generate video thumbnails
- Organize files by user ID

### 4. **UI Enhancements**
- Toast notifications for all operations
- Loading spinners during AI generation
- Authentication modal overlay
- User info display with sign-out button

## 🔐 Security Notes

All tables have Row Level Security (RLS) enabled:
- Users can only access their own data
- Projects are tied to user_id
- Assets are tied to user_id
- Storage bucket is private with authenticated-only access

## 📊 Database Schema Overview

```
profiles
├── id (UUID, references auth.users)
├── email
├── full_name
├── avatar_url
└── timestamps

projects
├── id (UUID)
├── user_id (UUID, references auth.users)
├── name
├── composition_tree (JSONB - stores Remotion tracks)
├── fps, total_frames
└── timestamps

assets
├── id (UUID)
├── user_id (UUID)
├── project_id (UUID, nullable)
├── name, file_type, file_size
├── storage_url
└── created_at
```

## 🛠️ Usage Examples

### Show Toast Notifications
```typescript
import { toast } from './lib/toastStore'

toast.success('Project saved!')
toast.error('Upload failed')
toast.info('Processing...')
```

### Upload Asset
```typescript
import { uploadAsset } from './lib/assetService'

const asset = await uploadAsset({
  file: myVideoFile,
  projectId: 'project-uuid',
})
console.log(asset.storage_url) // Use in composition
```

### Manual Project Save
```typescript
import { updateProjectComposition } from './lib/projectService'

await updateProjectComposition(
  projectId,
  compositionTree,
  totalFrames,
  fps
)
```

## 🐛 Troubleshooting

### "Missing VITE_SUPABASE_URL" error
- Ensure `.env` file exists in `app/` directory
- Check that environment variables are correctly set

### Authentication not working
- Verify Supabase URL and anon key in `.env`
- Check browser console for CORS errors
- Ensure auth providers are enabled in Supabase dashboard

### Storage upload fails
- Confirm `assets` bucket exists and is configured
- Verify storage policies are in place
- Check file size limits in Supabase settings

### RLS policy errors
- Run the full schema SQL script
- Verify user is authenticated before accessing data
- Check Supabase logs for policy violations

## 📝 Next Steps

1. Customize the auth modal branding
2. Add project list/dashboard view
3. Implement real-time collaboration with Supabase Realtime
4. Add asset browser/gallery component
5. Implement version history for projects
