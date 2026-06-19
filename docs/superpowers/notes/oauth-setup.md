# OAuth provider setup (Google + GitHub)

Email/password works out of the box once `.env` has the Supabase URL + anon key.
Google and GitHub require provider apps you create, then paste secrets into Supabase.

## Redirect URL (both providers + Supabase)
- Supabase callback: `https://ofiybdapqcyxbnjbavqi.supabase.co/auth/v1/callback`
- App redirect (set in Supabase → Authentication → URL Configuration → Redirect URLs):
  `http://localhost:5173/login` (dev) and your production origin `/login`.

## Google
1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web).
2. Authorized redirect URI = the Supabase callback URL above.
3. Copy Client ID + Client Secret.
4. Supabase → Authentication → Providers → Google → enable, paste ID + secret.

## GitHub
1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
2. Authorization callback URL = the Supabase callback URL above.
3. Copy Client ID, generate a Client Secret.
4. Supabase → Authentication → Providers → GitHub → enable, paste ID + secret.

Until configured, the Google/GitHub buttons return a provider error; email/password is unaffected.
