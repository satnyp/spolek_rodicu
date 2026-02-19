import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import type { AllowlistEntry, Role } from '../types/firestore';

const ADMIN_EMAIL = 'satny@gvid.cz';

export interface SessionState {
  user: User | null;
  role: Role | null;
  allowed: boolean;
  loading: boolean;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ user: null, role: null, allowed: false, loading: true });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user?.email) {
        setState({ user: null, role: null, allowed: false, loading: false });
        return;
      }
      const emailLower = user.email.toLowerCase();
      const isHardAdmin = emailLower === ADMIN_EMAIL;
      const snap = await getDoc(doc(db, 'allowlist', emailLower));
      const allow = snap.exists() ? (snap.data() as AllowlistEntry) : null;
      const allowed = Boolean(isHardAdmin || (allow?.active && allow.emailLower === emailLower));
      if (!allowed) {
        await signOut(auth);
        setState({ user: null, role: null, allowed: false, loading: false });
        return;
      }
      const role: Role = isHardAdmin ? 'admin' : (allow?.role ?? 'viewer');
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          email: user.email,
          provider: user.providerData[0]?.providerId?.includes('google') ? 'google' : 'seznam',
          role,
          active: true,
          displayName: user.displayName ?? '',
          photoURL: user.photoURL ?? '',
          lastLoginAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      setState({ user, role, allowed: true, loading: false });
    });
  }, []);

  return state;
}
