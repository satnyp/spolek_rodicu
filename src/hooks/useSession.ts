import { GoogleAuthProvider, onAuthStateChanged, signInWithCustomToken, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../lib/firebase';
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
  logout: () => Promise<void>;
} {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [allowlistEntry, setAllowlistEntry] = useState<AllowlistEntry | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAccessDenied(false);
      if (!nextUser?.email) {
        setAllowlistEntry(null);
        setLoading(false);
        return;
      }
      const emailLower = nextUser.email.toLowerCase();
      if (emailLower === ADMIN_EMAIL) {
        setAllowlistEntry({ emailLower, role: 'admin', active: true });
        setLoading(false);
        return;
      }
      const snap = await getDoc(doc(db, 'allowlist', emailLower));
      const data = (snap.data() as AllowlistEntry | undefined) ?? null;
      if (!snap.exists() || !data?.active) {
        setAccessDenied(true);
        setAllowlistEntry(null);
        await signOut(auth);
      } else {
        setAllowlistEntry(data);
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
    logout: () => signOut(auth)
  };
}
