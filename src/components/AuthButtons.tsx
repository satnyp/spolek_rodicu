import { GoogleAuthProvider, signInWithPopup, signInWithCustomToken } from 'firebase/auth';
import { auth } from '../lib/firebase';

export function AuthButtons() {
  const handleGoogle = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const handleSeznam = async () => {
    const popup = window.open('/auth/seznam/start', 'seznam-login', 'width=520,height=700');
    if (!popup) return;
    const onMessage = async (event: MessageEvent<{ token?: string }>) => {
      if (event.origin !== window.location.origin || !event.data?.token) return;
      await signInWithCustomToken(auth, event.data.token);
      window.removeEventListener('message', onMessage);
      popup.close();
    };
    window.addEventListener('message', onMessage);
  };

  return (
    <div className="auth-buttons">
      <button onClick={handleGoogle}>Přihlásit Google</button>
      <button onClick={handleSeznam}>Přihlásit Seznam</button>
    </div>
  );
}
