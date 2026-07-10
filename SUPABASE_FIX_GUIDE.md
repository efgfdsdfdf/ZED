# Supabase Authentication Fix Guide

## Problem Identified

The Supabase authentication is not working due to network connectivity issues. The diagnostic tests show "read ECONNRESET" errors, which indicate:

1. **Invalid or expired API keys**
2. **Network connectivity issues**
3. **Supabase project being paused or deleted**
4. **CORS restrictions**

## Current Solution: Local Authentication Fallback

I've implemented a local authentication fallback system that allows the application to work even when Supabase is unavailable. This includes:

### Files Created:
- `local-auth.js` - Local authentication system with user management
- `test-supabase.html` - Diagnostic tool for testing Supabase connection
- `test-local-auth.html` - Test tool for local authentication
- `check-supabase-config.js` - Node.js diagnostic script

### Files Modified:
- `public/zed-core.js` - Added fallback mechanism
- `public/login.html` - Added local-auth.js script reference

## How the Fallback Works

1. **Automatic Detection**: The system automatically detects if Supabase is available
2. **Seamless Fallback**: If Supabase fails, it switches to local authentication
3. **Same API**: All authentication functions work the same way regardless of backend
4. **Local Storage**: User data is stored in browser localStorage for development

## To Fix Supabase Authentication

### Step 1: Check Supabase Project Status
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Verify your project is active and not paused
3. Check the project URL and API keys

### Step 2: Verify API Keys
1. In Supabase Dashboard, go to **Settings → API**
2. Copy the **anon public** key
3. Update the key in `public/zed-core.js`:
   ```javascript
   const SUPABASE_ANON = 'your-new-anon-key-here';
   ```

### Step 3: Enable Email Authentication
1. In Supabase Dashboard, go to **Authentication → Settings**
2. Under **External OAuth Providers**, enable **Email** sign-in
3. Configure email templates if needed

### Step 4: Check CORS Settings
1. In Supabase Dashboard, go to **Settings → API**
2. Under **CORS**, add your development domains:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
   - `https://your-domain.com` (for production)

### Step 5: Verify Database Tables
1. In Supabase Dashboard, go to **Table Editor**
2. Ensure the following tables exist:
   - `profiles`
   - `chat_sessions`
   - `chat_messages`
   - `vitals_log`
   - `appointments`
   - `symptom_checks`
   - `medical_reports`
   - `health_tips`
   - `notifications`

3. Check that Row Level Security (RLS) policies are properly configured

### Step 6: Test the Fix
1. Run the diagnostic script: `node check-supabase-config.js`
2. Open `test-supabase.html` in your browser
3. Try logging in through the normal flow

## Using the Local Fallback

If Supabase is still not working, the local authentication system provides full functionality:

### Features Available:
- ✅ User registration and login
- ✅ Profile management
- ✅ Chat sessions and messages
- ✅ Vitals tracking
- ✅ Symptom checks
- ✅ Medical reports
- ✅ Health tips
- ✅ Notifications

### Data Storage:
- All data is stored in browser localStorage
- Data persists between browser sessions
- Each user gets isolated data storage

### Testing Local Auth:
1. Open `test-local-auth.html` in your browser
2. Test signup, login, and logout functionality
3. Verify data persistence

## Production Deployment

When deploying to production:

1. **Replace local keys** with your production Supabase credentials
2. **Update CORS settings** to include your production domain
3. **Test thoroughly** before going live
4. **Monitor logs** for any authentication issues

## Troubleshooting

### Common Issues:

**"Invalid login credentials"**
- Check email/password combination
- Verify user exists in the system

**"Network error"**
- Check internet connection
- Verify Supabase project is active
- Check CORS settings

**"Table not found"**
- Verify database schema is applied
- Check RLS policies are configured

**"OAuth not available"**
- Local fallback doesn't support OAuth
- Enable OAuth in Supabase for full functionality

### Getting Help:

1. Check browser console for detailed error messages
2. Run diagnostic scripts to identify specific issues
3. Verify Supabase project configuration
4. Check network connectivity and CORS settings

## Next Steps

1. **Fix Supabase credentials** using the steps above
2. **Test authentication flow** with real Supabase backend
3. **Verify chat AI integration** works with fixed auth
4. **Deploy to production** with proper configuration

The local fallback ensures your application remains functional while you work on fixing the Supabase issues.