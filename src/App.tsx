import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useSession } from './hooks/useSession';
import { AuthButtons } from './components/AuthButtons';
import { Dashboard } from './components/Dashboard';
import { AllowlistPage } from './pages/AllowlistPage';

export function App() {
  const session = useSession();
  if (session.loading) return <p>Načítání...</p>;
  if (!session.user || !session.allowed || !session.role) {
    return (
      <div>
        <h1>Spolek rodičů</h1>
        <p>Nemáš přístup — kontaktuj správce.</p>
        <AuthButtons />
      </div>
    );
  }

  return (
    <div>
      <header>
        <span>{session.user.email} ({session.role})</span>
        <nav>
          <Link to="/">Dashboard</Link>
          {session.role === 'admin' && <Link to="/allowlist">Allowlist</Link>}
        </nav>
        <button onClick={() => signOut(auth)}>Odhlásit</button>
      </header>
      <Routes>
        <Route path="/" element={<Dashboard role={session.role} email={session.user.email ?? ''} uid={session.user.uid} />} />
        <Route path="/allowlist" element={session.role === 'admin' ? <AllowlistPage actorEmail={session.user.email ?? ''} /> : <Navigate to="/" />} />
      </Routes>
    </div>
  );
}
