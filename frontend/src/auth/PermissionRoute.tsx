import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './use-auth';

export function PermissionRoute({ permission }: { permission: string }) {
  const { hasPermission } = useAuth();
  const location = useLocation();
  return hasPermission(permission) ? (
    <Outlet />
  ) : (
    <Navigate replace state={{ from: location.pathname }} to="/forbidden" />
  );
}
