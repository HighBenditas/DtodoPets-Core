import { ShieldX } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  return (
    <section className="status-page">
      <ShieldX size={42} />
      <p className="eyebrow">Acceso restringido</p>
      <h1>No tienes permiso para ver esta sección</h1>
      <p>Tu sesión sigue activa. Solicita el permiso a un administrador.</p>
      <Link className="secondary-button" to="/">
        Volver al inicio
      </Link>
    </section>
  );
}

