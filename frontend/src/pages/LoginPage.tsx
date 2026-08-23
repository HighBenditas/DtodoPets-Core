import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/use-auth';
import { Brand } from '../components/Brand';
import { environment } from '../config/environment';
import { ApiError } from '../lib/api-client';

interface LoginLocationState {
  from?: unknown;
}

export function LoginPage() {
  const { login, status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const emailId = useId();
  const organizationId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState(
    environment.defaultOrganizationSlug,
  );
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  if (status === 'authenticated') return <Navigate replace to="/" />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, organizationSlug, password });
      navigate(safeReturnPath(location.state), { replace: true });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught
          : new Error('No pudimos iniciar la sesión.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-story" aria-label="DTodoPets Core">
        <Brand />
        <div className="story-content">
          <span className="story-kicker">
            <Sparkles size={16} /> Operaciones conectadas
          </span>
          <h1>Todo tu negocio pet, bajo una sola mirada.</h1>
          <p>
            Ventas, inventario, clientes y canales con trazabilidad desde el
            primer movimiento.
          </p>
        </div>
        <div className="story-proof">
          <ShieldCheck size={21} />
          <span>
            <strong>Acceso protegido por organización</strong>
            <small>Sesiones rotativas y permisos verificados por la API.</small>
          </span>
        </div>
        <div className="story-orb story-orb--one" />
        <div className="story-orb story-orb--two" />
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card-heading">
            <span className="mobile-brand">
              <Brand compact />
            </span>
            <p className="eyebrow">Panel administrativo</p>
            <h2>Bienvenido de vuelta</h2>
            <p>Ingresa con tu cuenta y organización para continuar.</p>
          </div>

          <form onSubmit={(event) => void submit(event)}>
            <div className="field-group">
              <label htmlFor={organizationId}>Organización</label>
              <input
                autoCapitalize="none"
                autoComplete="organization"
                id={organizationId}
                maxLength={120}
                onChange={(event) => setOrganizationSlug(event.target.value)}
                placeholder="slug-de-tu-organización"
                required
                value={organizationSlug}
              />
            </div>
            <div className="field-group">
              <label htmlFor={emailId}>Correo electrónico</label>
              <input
                autoCapitalize="none"
                autoComplete="email"
                id={emailId}
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@empresa.cl"
                required
                type="email"
                value={email}
              />
            </div>
            <div className="field-group">
              <label htmlFor={passwordId}>Contraseña</label>
              <div className="password-input">
                <LockKeyhole aria-hidden="true" size={18} />
                <input
                  autoComplete="current-password"
                  id={passwordId}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Tu contraseña"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={
                    showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="form-error" role="alert">
                <strong>No pudimos iniciar sesión</strong>
                <span>{error.message}</span>
                {error instanceof ApiError && error.correlationId && (
                  <small>Referencia: {error.correlationId}</small>
                )}
              </div>
            )}

            <button className="primary-button" disabled={submitting} type="submit">
              <span>{submitting ? 'Verificando…' : 'Ingresar al panel'}</span>
              {!submitting && <ArrowRight size={19} />}
            </button>
          </form>
          <p className="login-help">
            ¿Problemas para ingresar? Contacta al administrador de tu
            organización.
          </p>
        </div>
      </section>
    </main>
  );
}

function safeReturnPath(state: unknown) {
  const from = (state as LoginLocationState | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
    ? from
    : '/';
}

