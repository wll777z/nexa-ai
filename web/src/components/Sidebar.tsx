import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/', label: 'Visão geral' },
  { to: '/create-site', label: 'Criar site com IA' },
  { to: '/ai-builder', label: 'Construtor por chat' },
  { to: '/my-sites', label: 'Meus sites' },
  { to: '/contacts', label: 'Clientes e contatos' },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-60 min-h-screen bg-surface-panel border-r border-surface-line flex flex-col">
      <div className="px-5 py-5 border-b border-surface-line">
        <h1 className="text-lg font-bold text-ink-strong">NEXA AI</h1>
        <p className="text-xs text-ink-faint mt-0.5">Central de comando</p>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
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
          <div className="mb-3">
            <p className="text-sm text-ink-strong font-medium truncate">{user.name}</p>
            <p className="text-xs text-ink-faint truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="text-xs text-ink-base hover:text-ink-strong transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
