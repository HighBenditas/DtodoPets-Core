import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { storedRefreshToken, storeRefreshToken } from './auth/session-storage';

const user = {
  email: 'admin@dtodopets.local',
  firstName: 'Admin',
  id: 'user-a',
  lastName: 'DTodoPets',
  organizationId: 'org-a',
  organizationSlug: 'dtodopets',
  permissions: ['reports.read', 'organizations.read'],
  roles: ['owner'],
};

function session(refreshToken = 'refresh-next') {
  return {
    accessToken: 'access-next',
    expiresIn: 900,
    refreshToken,
    tokenType: 'Bearer',
    user,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

describe('Admin Web authentication shell', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('logs in against the real contract, stores only refresh state and logs out', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) return Promise.resolve(jsonResponse(session()));
      if (url.endsWith('/auth/logout')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(jsonResponse({ message: 'Unexpected request' }, 500));
    });
    vi.stubGlobal('fetch', fetchMock);
    const browser = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Bienvenido de vuelta' }),
    ).toBeVisible();
    await browser.type(screen.getByLabelText('Organización'), 'dtodopets');
    await browser.type(
      screen.getByLabelText('Correo electrónico'),
      'admin@dtodopets.local',
    );
    await browser.type(screen.getByLabelText('Contraseña'), 'development-password');
    await browser.click(screen.getByRole('button', { name: 'Ingresar al panel' }));

    expect(
      await screen.findByRole('heading', { name: 'Hola, Admin' }),
    ).toBeVisible();
    expect(storedRefreshToken()).toBe('refresh-next');
    expect(
      Array.from({ length: window.sessionStorage.length }, (_, index) => {
        const key = window.sessionStorage.key(index);
        return key ? window.sessionStorage.getItem(key) : null;
      }),
    ).toEqual(['refresh-next']);
    expect(screen.getByText('Reportes')).toBeVisible();
    expect(screen.queryByText('Pedidos')).not.toBeInTheDocument();

    await browser.click(screen.getByRole('button', { name: /Admin DTodoPets/i }));
    await browser.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(
      await screen.findByRole('heading', { name: 'Bienvenido de vuelta' }),
    ).toBeVisible();
    expect(storedRefreshToken()).toBeNull();

    const loginCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/auth/login'),
    );
    const logoutCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/auth/logout'),
    );
    expect(JSON.parse(String(loginCall?.[1]?.body))).toEqual({
      email: 'admin@dtodopets.local',
      organizationSlug: 'dtodopets',
      password: 'development-password',
    });
    expect(new Headers(logoutCall?.[1]?.headers).get('authorization')).toBe(
      'Bearer access-next',
    );
  });

  it('rotates a stored refresh token before rendering a protected route', async () => {
    storeRefreshToken('refresh-old');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(session('refresh-rotated')),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(screen.getByText('Restaurando tu sesión…')).toBeVisible();
    expect(
      await screen.findByRole('heading', { name: 'Hola, Admin' }),
    ).toBeVisible();
    expect(storedRefreshToken()).toBe('refresh-rotated');
    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(options?.body))).toEqual({
      refreshToken: 'refresh-old',
    });
  });

  it('clears an invalid restored session and returns to login', async () => {
    storeRefreshToken('refresh-invalid');
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          { correlationId: 'corr-401', message: 'Invalid refresh token' },
          401,
        ),
      ),
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Bienvenido de vuelta' }),
      ).toBeVisible();
    });
    expect(storedRefreshToken()).toBeNull();
  });
});
