# Firebase setup

Copy `.env.example` to `.env` and fill in the Firebase Web App configuration.
The `VITE_FIREBASE_*` values are public client configuration, not server secrets;
Vite includes them in the browser bundle. Keep authorization in Firebase
Authentication and deploy `firestore.rules`. Never put service-account keys or
passwords in this project. `.env` is ignored by Git; configure the same
environment values in your hosting provider when deploying.

1. In Firebase Console, enable **Authentication → Email/Password** and create a
   Firestore database.
2. Create the first admin user under **Authentication → Users**. In Firestore,
   create `users/{AUTH_UID}` with `{ "role": "admin", "name": "Admin" }`.
   User profiles must be provisioned by a trusted administrator; the application
   does not let users assign or change their own roles.
3. Add each student account to Authentication and create `users/{AUTH_UID}` with
   `{ "role": "student", "studentId": "A2_<roster-hash>", "name": "...", "group": "A2" }`.
   The `studentId` must match the ID generated from the student's entry in the
   admin-maintained roster.
4. Create doctor profiles with `{ "role": "doctor", "clinic": "surgery", "name": "..." }`.
   Supported clinic IDs are `surgery`, `perio`, `braces`, `fill`, and `ortho`.
   Staff profiles use `{ "role": "staff", "name": "..." }`.
5. In Firestore, create `config/main` with the clinic roster/schedule settings, or
   sign into the app as admin and save them there. Admins control clinic
   availability; doctor accounts are assigned a clinic in their trusted profile.
6. Publish `firestore.rules` from the Firebase Console or Firebase CLI before
   using real student or patient data. Test rules with the Firebase Rules
   Simulator and verify student, doctor, staff, and admin access separately.

The app uses Firebase Auth's local session persistence and Firestore's IndexedDB
offline persistence, in addition to local draft caching for student case sheets.
Offline changes are synchronized when a connection returns. Browser storage and
the app itself are accessible to the signed-in user; do not treat local storage
as a secret vault.

The previous PIN/device-binding and shared role-code login is intentionally
removed: client-side PINs and role codes can be read or changed by anyone using
DevTools and cannot safely enforce permissions.
