import { PawPrint } from 'lucide-react';

export function LoadingScreen() {
  return (
    <main className="loading-screen" aria-busy="true" aria-live="polite">
      <div className="brand-mark brand-mark--pulse" aria-hidden="true">
        <PawPrint size={27} strokeWidth={2.2} />
      </div>
      <p>Restaurando tu sesión…</p>
    </main>
  );
}

