# Blank Screen / Auth Loop FIX

This version fixes the authentication flow so the public Login/Register landing page renders immediately without waiting for Supabase.

Important fixes:
- No Supabase API call is awaited inside `onAuthStateChange`.
- The app no longer bounces a valid session back to Login just because the profile query is temporarily unavailable.
- Login/Register remains the first public page when there is no session.
- Admin protection at `/admin` remains active.
- Existing journal, dashboard, calendar, R:R, Running/Pending, and multi-user features are preserved.

Run:
1. `npm install`
2. `npm run dev`

If the browser still shows a white screen, open DevTools -> Console and check the first red error.
