import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAuth } from './use-auth';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'restoring') return <LoadingScreen />;
  if (status === 'anonymous') {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }
  return <Outlet />;
}

