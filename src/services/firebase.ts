import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User
} from "firebase/auth";
import {
  collection as firestoreCollection,
  deleteDoc,
  doc as firestoreDoc,
  getDoc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type WhereFilterOp
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missingConfig.length) {
  throw new Error(`Missing Firebase configuration: ${missingConfig.join(", ")}. Copy .env.example to .env and fill in the Firebase Web App values.`);
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

void isSupported()
  .then((supported) => {
    if (supported) getAnalytics(app);
  })
  .catch((error: unknown) => {
    console.warn("Firebase Analytics is unavailable in this browser.", error);
  });

export function persistAuthSession(): Promise<void> {
  return setPersistence(auth, browserLocalPersistence);
}

export { onAuthStateChanged, signInWithEmailAndPassword, signOut };
export type { User };

interface DocumentSnapshotCompat {
  exists: boolean;
  data: () => DocumentData | undefined;
}

interface QuerySnapshotCompat {
  docs: Array<{ id: string; data: () => DocumentData }>;
}

function documentSnapshot(snapshot: Awaited<ReturnType<typeof getDoc>>): DocumentSnapshotCompat {
  return {
    exists: snapshot.exists(),
    data: () => snapshot.data()
  };
}

function querySnapshot(snapshot: QuerySnapshotCompat): QuerySnapshotCompat {
  return snapshot;
}

export const db = {
  collection(name: string) {
    const ref = firestoreCollection(firestore, name);

    return {
      doc(id: string) {
        const document = firestoreDoc(firestore, name, id);

        return {
          set: (data: DocumentData) => setDoc(document, data),
          update: (data: DocumentData) => updateDoc(document, data),
          delete: () => deleteDoc(document),
          get: async () => documentSnapshot(await getDoc(document)),
          onSnapshot: (
            callback: (snapshot: DocumentSnapshotCompat) => void,
            onError?: (error: Error) => void
          ) =>
            onSnapshot(
              document,
              (snapshot) => callback(documentSnapshot(snapshot)),
              onError
            )
        };
      },
      where(field: string, operator: WhereFilterOp, value: string | number | boolean) {
        const constraints: QueryConstraint[] = [where(field, operator, value)];
        const filtered = query(ref, ...constraints);
        return {
          onSnapshot: (
            callback: (snapshot: QuerySnapshotCompat) => void,
            onError?: (error: Error) => void
          ) => onSnapshot(filtered, (snapshot) => callback(querySnapshot(snapshot)), onError)
        };
      },
      onSnapshot(
        callback: (snapshot: QuerySnapshotCompat) => void,
        onError?: (error: Error) => void
      ) {
        return onSnapshot(ref, (snapshot) => callback(querySnapshot(snapshot)), onError);
      }
    };
  }
};
