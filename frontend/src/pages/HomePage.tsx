import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  KeyRound,
  LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '../auth/use-auth';

export function HomePage() {
  const { user } = useAuth();
  if (!user) return null;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');

  return (
    <div className="home-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Inicio</p>
          <h1>Hola, {user.firstName}</h1>
          <p>
            Tu espacio operativo está conectado y listo para incorporar los
            módulos administrativos.
          </p>
        </div>
        <span className="connection-badge">
          <span aria-hidden="true" /> API conectada
        </span>
      </header>

      <section className="welcome-panel">
        <div className="welcome-icon" aria-hidden="true">
          <LayoutDashboard size={28} />
        </div>
        <div>
          <p className="eyebrow">Base de Admin Web</p>
          <h2>Una sesión real, sin datos de demostración</h2>
          <p>
            Este primer corte valida identidad, tenant y permisos contra DTodoPets
            Core. Los indicadores de negocio se conectarán a los reportes reales
            en el siguiente corte.
          </p>
        </div>
        <ArrowUpRight className="welcome-arrow" size={24} />
      </section>

      <section className="identity-grid" aria-label="Contexto de la sesión">
        <article className="identity-card">
          <span className="identity-card-icon">
            <BadgeCheck size={20} />
          </span>
          <div>
            <p>Sesión activa</p>
            <strong>{fullName}</strong>
            <small>{user.email}</small>
          </div>
        </article>
        <article className="identity-card">
          <span className="identity-card-icon identity-card-icon--amber">
            <Building2 size={20} />
          </span>
          <div>
            <p>Organización</p>
            <strong>{user.organizationSlug}</strong>
            <small>Tenant verificado por la API</small>
          </div>
        </article>
        <article className="identity-card">
          <span className="identity-card-icon identity-card-icon--blue">
            <KeyRound size={20} />
          </span>
          <div>
            <p>Acceso vigente</p>
            <strong>{user.roles.join(' · ')}</strong>
            <small>{user.permissions.length} permisos efectivos</small>
          </div>
        </article>
      </section>
    </div>
  );
}

