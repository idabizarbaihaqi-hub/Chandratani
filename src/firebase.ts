import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";

const env = (import.meta as any).env || {};

const firebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0499361906",
  appId: env.VITE_FIREBASE_APP_ID || "1:756558314823:web:6d98512e9a749b1525a062",
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyBy99JE9Muia7PlabpuXx8vJxxOf7k1LBA",
  authDomain:
    env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0499361906.firebaseapp.com",
  firestoreDatabaseId:
    env.VITE_FIREBASE_DATABASE_ID ||
    "ai-studio-chandratanidesak-9f793cac-b829-455b-995e-9f6642cb26ba",
  storageBucket:
    env.VITE_FIREBASE_STORAGE_BUCKET ||
    "gen-lang-client-0499361906.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "756558314823",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

testConnection();
