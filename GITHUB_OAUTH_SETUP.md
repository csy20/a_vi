# GitHub OAuth Setup Guide for A-Vi

## Why GitHub Login Isn't Working

GitHub OAuth requires proper configuration in your Supabase dashboard. Follow these steps:

## Step 1: Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in the details:
   - **Application name**: `A-Vi Video Editor` (or your preferred name)
   - **Homepage URL**: `http://localhost:5173` (for development)
   - **Authorization callback URL**: `https://xdnxghixpxoewnzbnfho.supabase.co/auth/v1/callback`
4. Click **"Register application"**
5. **Copy the Client ID** - you'll need this

## Step 2: Generate Client Secret

1. After registering, you'll see your app details
2. Click **"Generate a new client secret"**
3. **Copy the Client Secret** - you'll need this (it's only shown once!)

## Step 3: Configure Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/xdnxghixpxoewnzbnfho
2. Navigate to **Authentication** → **Providers**
3. Find **GitHub** in the list and click on it
4. Toggle **"Enable Sign in with GitHub"** to ON
5. Enter your credentials:
   - **Client ID**: Paste from Step 1
   - **Client Secret**: Paste from Step 2
6. Click **"Save"**

## Step 4: Test the Integration

1. Go back to your app: http://localhost:5173
2. Click **"GitHub"** button on the login screen
3. You should be redirected to GitHub for authorization
4. After approving, you'll be redirected back to your app

## Troubleshooting

### "Invalid redirect_uri" Error
- Ensure the callback URL in GitHub exactly matches: `https://xdnxghixpxoewnzbnfho.supabase.co/auth/v1/callback`
- No trailing slashes!

### "OAuth flow was interrupted" Error
- Check that both Client ID and Client Secret are correctly entered in Supabase
- Make sure you saved the configuration in Supabase dashboard

### Still Not Working?
1. Clear your browser cache and cookies
2. Check browser console for detailed error messages
3. Verify your Supabase URL is correct in `.env` file
4. Try using email/password login as an alternative

## Security Note

- Never commit Client Secrets to your repository
- The callback URL must be exact (including the Supabase project ID)
- For production, add your production URL to GitHub OAuth App settings
