import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('./lib/firebase', () => ({ db: {} }));
vi.mock('./hooks/useSession', () => ({
  useSession: () => ({
    user: null,
    loading: false,
    accessDenied: false,
    role: null,
    allowlistEntry: null,
    loginGoogle: vi.fn(),
    loginSeznamWithToken: vi.fn(),
    logout: vi.fn()
  })
}));

import { App } from './App';

describe('App', () => {
  it('renders login screen', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText('Příspěvky rodičů')).toBeInTheDocument();
  });
});
