import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

import { vi } from 'vitest';

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isAuthenticated: false,
    isLoading: false,
    loginWithRedirect: vi.fn(),
    logout: vi.fn(),
    user: null,
  })
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('Accessibility Requirements', () => {
  beforeEach(() => {
    if (!global.crypto) {
      (global as any).crypto = {
        randomUUID: () => '12345'
      };
    }
  });

  it('Login screen has Auth0 login button', () => {
    render(<App />);
    const loginButton = screen.getByText(/Sign In|Get Started/i);
    expect(loginButton).toBeInTheDocument();
  });
});
