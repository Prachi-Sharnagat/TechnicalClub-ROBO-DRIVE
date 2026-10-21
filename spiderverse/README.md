# SPIDER-VERSE: ROBOT DRIVE — Leaderboard

Files: `index.html` (public) · `admin.html` (admin) · `style.css` · `script.js` · `admin.js` · `firebase-config.js` · `firestore.rules`

## 1. Create the Firebase project
1. Go to https://console.firebase.google.com → **Add project** (Analytics not needed).
2. **Project settings (gear) → General → Your apps → Web (`</>`)** → register an app → copy the `firebaseConfig` values into `firebase-config.js`.

## 2. Authentication (one admin only)
1. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
2. **Users → Add user** → email `technical@club.example`, password `robodrive`. (Firebase needs a full email address; on the login screen the admin simply types the username `technical@club`.)
3. **Authentication → Settings → User actions**: turn off "Enable create (sign-up)" so no other account can exist.
4. The password is checked by Firebase, never stored in the code. Change it after the event (Users → ⋮ → Reset password/Edit).
5. Admin page: `admin.html` (e.g. `https://<project-id>.web.app/admin.html`). A small "Admin" link is also in the footer of the leaderboard.

Optional: save your QR code image as `qr.png` next to `index.html` and it appears on the ticket stub.

## 3. Firestore database
1. **Build → Firestore Database → Create database** (production mode, pick a nearby region).
2. **Rules** tab: paste the contents of `firestore.rules`. The admin email is already set to `technical@club.example`, then **Publish**.
   - Anyone may read results (public leaderboard). Only that signed-in email may create, edit or delete, and data is validated (name 1–40 chars, time a positive number).
3. The `results` collection is created automatically when you save the first result. Each document: `{ name, time, updatedAt }`.
4. If the console asks for an index: ordering on the single field `time` needs none.

## 4. Run locally
ES modules need http, not `file://`. From the project folder:
```
python3 -m http.server 8000      # or: npx serve
```
Open http://localhost:8000/ (leaderboard) and http://localhost:8000/admin.html (admin).
If login fails on localhost, check Authentication → Settings → Authorized domains includes `localhost`.

## 5. Deploy (Firebase Hosting, free)
```
npm i -g firebase-tools
firebase login
firebase init hosting      # public dir: . (current folder); single-page app: No; don't overwrite index.html
firebase deploy
```
Also add `firebase.json` ignore entries if you like (`README.md`, `firestore.rules`). Your site will be at `https://<project-id>.web.app`. Netlify, Vercel or GitHub Pages also work (drag the folder in); then add that domain under Authentication → Settings → **Authorized domains**.

## Using it on event day
Open `index.html` on the projector and press **FULL SCREEN**. Log in at `/admin.html`, add or edit times, and the board updates instantly. Ranking uses completion time only (lowest first); only the Top 10 appear publicly (ranks 1–3 on the podium, 4–10 in the table).

## Security notes
The Firebase `apiKey` is not secret; protection comes from Authentication plus the Firestore rules above. Never loosen the rules to `allow write: if true`.

## Time format
The admin enters **Minutes** and **Seconds** (e.g. 2 min 35.45 s). It is stored as total seconds (155.45) and the leaderboard shows `2:35.45 min`. Ranking is lowest total time first.

## Spreadsheet entry (admin)
In `admin.html` the **Spreadsheet entry** card is a grid for entering many results at once:
- Type directly, or **copy cells from Excel / Google Sheets and paste** into any cell (columns: Team, Minutes, Seconds — or Team, `m:ss.xx`).
- **Import CSV / Excel** reads a `.csv`, `.xlsx` or `.xls` file (first sheet). In Excel, format a `m:ss` column as Text, or use separate Minutes and Seconds columns.
- **Export CSV** downloads the current results in the same layout, so you can edit and re-import them.
- **Save all to leaderboard** validates every row (invalid ones are highlighted and nothing is saved until they are fixed). A team name that already exists is updated instead of duplicated. Up to 400 rows per save.

## Using the Google Sheet (default)
`config.js` sets `DATA_SOURCE = "sheet"`. The leaderboard reads the published sheet (`SHEET_CSV_URL`) every 15 seconds, so **entries are typed in the spreadsheet** and no Firebase setup is needed for the public page.

**Sheet layout** (first row = headers). Easiest and safest: `Team | Minutes | Seconds` (e.g. `Web Slingers | 2 | 35.45`).
A single time column also works: `2:35.45` (m:ss), or a plain number = minutes (`2.5` = 2 min 30 s); a header containing "sec" means seconds. In Google Sheets format that column as **Plain text** (Format → Number → Plain text), otherwise Sheets turns `2:35` into 2 hours 35 minutes. Rows with no time yet are ignored; if a team appears twice its best time is used.

**Publishing:** File → Share → Publish to web → Sheet1 → CSV → Publish (already done for your sheet). Share the editing link only with admins (Editor access) — never "anyone with the link can edit".
**Delay:** Google caches published sheets, so a change can take from a few seconds to a few minutes to show up.
**Admin page:** in sheet mode `admin.html` shows what the sheet contains, highlights rows that cannot be read, and (if you fill `SHEET_EDIT_URL` in `config.js`) has an "Open spreadsheet" button. Who may edit is controlled by Google Sheets sharing; the Firebase login is only used when `DATA_SOURCE = "firebase"`.
