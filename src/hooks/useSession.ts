import { GoogleAuthProvider, onAuthStateChanged, signInWithCustomToken, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useMemo, useState } from 'react';
import { auth, db, functions } from '../lib/firebase';
import type { AllowlistEntry, Role } from '../types/domain';

const ADMIN_EMAIL = 'satny@gvid.cz';

export interface SessionState {
  user: User | null;
  loading: boolean;
  accessDenied: boolean;
  role: Role | null;
  allowlistEntry: AllowlistEntry | null;
}

export function useSession(): SessionState & {
  loginGoogle: () => Promise<void>;
  loginSeznamWithToken: (token: string) => Promise<void>;
  loginE2E: (email: string) => Promise<void>;
  logout: () => Promise<void>;
} {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [allowlistEntry, setAllowlistEntry] = useState<AllowlistEntry | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser?.email) {
        setAllowlistEntry(null);
        setLoading(false);
        return;
      }
      const emailLower = nextUser.email.toLowerCase();
      if (emailLower === ADMIN_EMAIL) {
        setAllowlistEntry({ emailLower, role: 'admin', active: true });
        setAccessDenied(false);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'allowlist', emailLower));
        const data = (snap.data() as AllowlistEntry | undefined) ?? null;
        if (!snap.exists() || !data?.active) {
          setAccessDenied(true);
          setAllowlistEntry(null);
          await signOut(auth);
        } else {
          setAllowlistEntry(data);
          setAccessDenied(false);
        }
      } catch {
        setAccessDenied(true);
        setAllowlistEntry(null);
        await signOut(auth);
      }
      setLoading(false);
    });
  }, []);

  const role = useMemo(() => allowlistEntry?.role ?? null, [allowlistEntry]);

  return {
    user,
    loading,
    accessDenied,
    role,
    allowlistEntry,
    loginGoogle: async () => {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (!result.user.email?.endsWith('@gvid.cz') && result.user.email?.toLowerCase() !== ADMIN_EMAIL) {
        await signOut(auth);
        throw new Error('Google login je povolen pouze pro @gvid.cz.');
      }
    },
    loginSeznamWithToken: async (token) => {
      await signInWithCustomToken(auth, token);
    },
    loginE2E: async (email: string) => {
      const mintToken = httpsCallable<{ email: string }, { token: string }>(functions, 'mintTestToken');
      const response = await mintToken({ email });
      await signInWithCustomToken(auth, response.data.token);
    },
    logout: () => signOut(auth)
  };
}
