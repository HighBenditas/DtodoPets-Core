import { PawPrint } from 'lucide-react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'brand brand--compact' : 'brand'}>
      <span className="brand-mark" aria-hidden="true">
        <PawPrint size={compact ? 21 : 27} strokeWidth={2.25} />
      </span>
      <span className="brand-copy">
        <strong>DTodoPets</strong>
        {!compact && <small>Centro de operaciones</small>}
      </span>
    </div>
  );
}

