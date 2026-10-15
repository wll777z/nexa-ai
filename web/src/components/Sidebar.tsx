import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/', label: 'Visão geral' },
  { to: '/create-site', label: 'Criar site com IA' },
  { to: '/ai-builder', label: 'Construtor por chat' },
  { to: '/my-sites', label: 'Meus sites' },
  { to: '/contacts', label: 'Clientes e contatos' },
  { to: '/prospecting', label: 'Prospecção comercial' },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside
      className="w-60 min-h-screen bg-surface-panel border-r border-surface-line flex flex-col"
      aria-label="Navegação principal"
    >
      <div className="px-5 py-5 border-b border-surface-line">
        <div className="flex items-center gap-2.5">
          <span
            className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0"
            aria-hidden="true"
          >
            N
          </span>
          <div>
            <h1 className="text-base font-bold text-ink-strong leading-tight">NEXA AI</h1>
            <p className="text-[11px] text-ink-faint leading-tight mt-0.5">Central de comando</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1" aria-label="Seções">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-surface-line">
        {user && (
          <div className="mb-3 flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-xs font-semibold text-ink-base shrink-0"
              aria-hidden="true"
            >
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-ink-strong font-medium truncate">{user.name}</p>
              <p className="text-xs text-ink-faint truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="btn-ghost text-xs w-full justify-start -mx-1"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
