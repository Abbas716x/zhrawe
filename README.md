# Dental Clinic Case Management

Arabic, RTL clinic case-sheet app built with TypeScript, Vite, Firebase
Authentication, and Cloud Firestore.

## Requirements

- Node.js 20.19+ or 22.12+
- A Firebase project with Email/Password Authentication and Cloud Firestore

## Local development

```sh
npm install
copy .env.example .env
npm run dev
```

Fill `.env` with the Firebase Web App values before starting the app. These
`VITE_FIREBASE_*` settings are public browser configuration; `.env` is excluded
from Git. Never put service-account credentials or other server secrets in a
Vite environment variable.

## Production build

```sh
npm run build
npm run preview
```

## Firebase authorization

1. Enable Email/Password under Firebase Authentication.
2. Provision each account in Firebase Authentication and create a trusted
   `users/{uid}` Firestore document with its role. Set doctor clinic assignments
   and student `studentId`, name, and group there.
3. Configure the clinic schedule and availability in `config/main`.
4. Publish [firestore.rules](./firestore.rules) before handling real data.

See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for role profile examples and
deployment notes. The application stores student drafts locally and enables
Firestore IndexedDB persistence for offline use.
