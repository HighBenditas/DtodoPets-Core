import { SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="status-page">
      <SearchX size={42} />
      <p className="eyebrow">Error 404</p>
      <h1>Esta página no existe</h1>
      <p>Revisa la dirección o regresa al inicio del panel.</p>
      <Link className="secondary-button" to="/">
        Volver al inicio
      </Link>
    </section>
  );
}

