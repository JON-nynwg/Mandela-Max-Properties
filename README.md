# Mandelamax Properties
Static site: upload the contents of this folder to any static host (Netlify, Cloudflare Pages, GitHub Pages, cPanel public_html). No build step. Open index.html locally to preview.

## Adding listings (listings.json)
Each listing needs: `id` (unique), `title`, `location`, `type` (`rent` or `sale`), `category` (`house`, `godown` or `land`), `price`, `description`, `image` (file in `assets/`).
- Houses also take `beds`.
- Godowns and land take `size` instead, for example `"size": "1/4 acre"`.
- Optional: `priceMax` for a price range.

The dashboard on properties.html filters on category + type: House Rent, House Buy, Godown Rentals, Godown Sales, Land Sales. The Godowns / Lands header buttons link to `properties.html?filter=godown` and `?filter=land`.

## Admin page (Firebase)
`admin.html` lets the owner sign in and add, edit and delete properties with photos. Listings are stored in Firebase (Firestore + Storage). Setup steps are in `FIREBASE-SETUP.md`. Until Firebase is configured in `firebase-config.js`, the site reads `listings.json` as before.
