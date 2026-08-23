import {
  BarChart3,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  ContactRound,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  PlugZap,
  Settings,
  ShoppingBag,
  Truck,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/use-auth';
import { Brand } from './Brand';

interface NavigationItem {
  enabled: boolean;
  icon: LucideIcon;
  label: string;
  permission?: string;
  to: string;
}

const navigation: Array<{ items: NavigationItem[]; label: string }> = [
  {
    label: 'Resumen',
    items: [
      {
        enabled: true,
        icon: LayoutDashboard,
        label: 'Inicio',
        to: '/',
      },
      {
        enabled: false,
        icon: BarChart3,
        label: 'Reportes',
        permission: 'reports.read',
        to: '/reports',
      },
    ],
  },
  {
    label: 'Operación',
    items: [
      {
        enabled: false,
        icon: ShoppingBag,
        label: 'Pedidos',
        permission: 'orders.read',
        to: '/orders',
      },
      {
        enabled: false,
        icon: PackageSearch,
        label: 'Productos',
        permission: 'products.read',
        to: '/products',
      },
      {
        enabled: false,
        icon: Boxes,
        label: 'Inventario',
        permission: 'inventory.read',
        to: '/inventory',
      },
      {
        enabled: false,
        icon: ContactRound,
        label: 'Clientes',
        permission: 'customers.read',
        to: '/customers',
      },
      {
        enabled: false,
        icon: CreditCard,
        label: 'Pagos',
        permission: 'payments.read',
        to: '/payments',
      },
      {
        enabled: false,
        icon: Truck,
        label: 'Envíos',
        permission: 'shipments.read',
        to: '/shipments',
      },
    ],
  },
  {
    label: 'Administración',
    items: [
      {
        enabled: false,
        icon: PlugZap,
        label: 'Canales',
        permission: 'integrations.manage',
        to: '/channels',
      },
      {
        enabled: false,
        icon: UsersRound,
        label: 'Usuarios',
        permission: 'users.manage',
        to: '/users',
      },
      {
        enabled: false,
        icon: Settings,
        label: 'Configuración',
        permission: 'organizations.update',
        to: '/settings',
      },
    ],
  },
];

export function AppShell() {
  const { hasPermission, logout, user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        setProfileOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!user) return null;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const initials = `${user.firstName[0] ?? ''}${user.lastName?.[0] ?? ''}`;

  async function signOut() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Ir al contenido principal
      </a>
      {mobileOpen && (
        <button
          aria-label="Cerrar menú"
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      )}
      <aside
        className={`sidebar${mobileOpen ? ' sidebar--open' : ''}`}
        id="primary-navigation"
      >
        <div className="sidebar-brand-row">
          <Brand />
          <button
            aria-label="Cerrar navegación"
            className="icon-button sidebar-close"
            onClick={() => setMobileOpen(false)}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Navegación principal">
          {navigation.map((group) => (
            <section className="nav-group" key={group.label}>
              <p className="nav-group-label">{group.label}</p>
              <ul>
                {group.items.map((item) => {
                  const visible =
                    !item.permission || hasPermission(item.permission);
                  if (!visible) return null;
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      {item.enabled ? (
                        <NavLink
                          className={({ isActive }) =>
                            `nav-item${isActive ? ' nav-item--active' : ''}`
                          }
                          end={item.to === '/'}
                          onClick={() => setMobileOpen(false)}
                          to={item.to}
                        >
                          <Icon size={19} />
                          <span>{item.label}</span>
                        </NavLink>
                      ) : (
                        <span
                          aria-disabled="true"
                          className="nav-item nav-item--disabled"
                          title="Disponible en el próximo corte de Admin Web"
                        >
                          <Icon size={19} />
                          <span>{item.label}</span>
                          <small>Pronto</small>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
        <div className="sidebar-footnote">
          <CircleDollarSign size={18} />
          <span>
            <strong>Moneda operativa</strong>
            <small>Pesos chilenos · CLP</small>
          </span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-leading">
            <button
              aria-controls="primary-navigation"
              aria-expanded={mobileOpen}
              aria-label="Abrir navegación"
              className="icon-button mobile-menu"
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              <Menu size={22} />
            </button>
            <div>
              <p className="eyebrow">Organización</p>
              <strong className="organization-name">
                {user.organizationSlug}
              </strong>
            </div>
          </div>
          <div className="profile-menu">
            <button
              aria-expanded={profileOpen}
              className="profile-trigger"
              onClick={() => setProfileOpen((open) => !open)}
              type="button"
            >
              <span className="avatar" aria-hidden="true">
                {initials.toUpperCase()}
              </span>
              <span className="profile-trigger-copy">
                <strong>{fullName}</strong>
                <small>{user.roles.join(' · ')}</small>
              </span>
              <ChevronDown size={17} />
            </button>
            {profileOpen && (
              <div className="profile-popover">
                <p>{user.email}</p>
                <button
                  disabled={loggingOut}
                  onClick={() => void signOut()}
                  type="button"
                >
                  <LogOut size={17} />
                  {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
                </button>
              </div>
            )}
          </div>
        </header>
        <main id="main-content" className="main-content" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

