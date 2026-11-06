# Setup: about 20 minutes

You need three free accounts: **GitHub** (the code is already there), **Supabase** (the database and logins) and **Vercel** (the website).

## 1. Supabase: the database
1. Go to [supabase.com](https://supabase.com) → **New project**. Name it `nestwell-operations`, pick a region near you (US West) and save the database password somewhere safe.
2. Open **SQL Editor** → **New query**. Paste all of `supabase/migrations/0001_crew.sql` → **Run**. You should see "Success."
3. Go to **Project Settings → API** and copy three values:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**secret**: never share or paste it in chat)
4. Go to **Authentication → Sign In / Providers → Email** and turn **off** "Allow new users to sign up". The app creates accounts itself through the server, so public sign-ups aren't needed.

## 2. Vercel: put it online
1. Go to [vercel.com](https://vercel.com) → **Sign up with GitHub** → **Add New → Project** → import `nestwell-operations`.
2. Before clicking Deploy, open **Environment Variables** and add the three Supabase values, plus `ALLOW_SIGNUP` = `true`.
3. Click **Deploy**. You'll get a URL like `nestwell-operations.vercel.app`.
4. Optional: in **Settings → Domains**, add `crew.staynestwell.com`. Vercel shows a DNS record to add wherever staynestwell.com's DNS is managed.

## 3. First run
1. Open the site → **Set up your family** → create your parent account.
2. On **Team & Pay**, add each kid with a username and password.
3. In Vercel, change `ALLOW_SIGNUP` to `false` → **Redeploy**. Now no one else can sign up.
4. On each kid's phone, open the site → log in → **Share → Add to Home Screen** (iPhone) or **⋮ → Install app** (Android).
5. Post a test extra job and watch the notification arrive on a kid's phone.

## Running it on your computer (optional)
```bash
npm install
cp .env.example .env.local   # paste the same values
npm run dev
```

## Troubleshooting
- **"No profile found":** the login exists but sign-up didn't finish. Delete the user in Supabase → Authentication → Users and sign up again.
- **Photo upload fails:** check that step 1.2 ran, since it creates the `proof` storage bucket.
