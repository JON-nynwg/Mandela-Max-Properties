# Firebase setup (one time, about 10 minutes)

The site works without Firebase (it reads `listings.json`). Follow these steps to turn on the admin page (`admin.html`).

1. Go to https://console.firebase.google.com and click **Add project**. Name it (e.g. mandelamax). You can skip Google Analytics.
2. **Authentication** → Get started → **Email/Password** → Enable → Save.
   Then the **Users** tab → **Add user**: enter YOUR email and a strong password. This is your admin login.
3. **Firestore Database** → Create database → choose a location (e.g. `europe-west1` or the closest) → Start in **production mode**.
   Open the **Rules** tab, paste the contents of `firestore.rules`, replace `REPLACE_WITH_YOUR_ADMIN_EMAIL` with your email, and **Publish**.
4. **Storage** → Get started. Firebase may ask you to upgrade to the pay-as-you-go (Blaze) plan; it has a free monthly allowance, but it needs a payment card. Check the current Firebase pricing page.
   Open the **Rules** tab, paste the contents of `storage.rules`, replace the email, and **Publish**.
5. **Project settings** (gear icon) → **Your apps** → click the web icon `</>` → register an app (no hosting needed) → copy the `firebaseConfig` values into `firebase-config.js`.
6. **Authentication → Settings → Authorized domains**: add your website's domain (for example `jon-nynwg.github.io` if the site is on GitHub Pages).
7. Push the changes to GitHub. Open `yourwebsite.com/admin.html`, sign in, and click **Import the current listings** once. After that, every property you publish is live immediately.

Tip: in Authentication → Settings → User actions, turn off "Enable create (sign-up)" so nobody else can create accounts.
