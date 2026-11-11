import { Home, ListOrdered, ShoppingCart, Package, Settings, Tag } from 'lucide-react';
import { ReactNode } from 'react';

export type Route = 'inicio' | 'listas' | 'comprar' | 'stock' | 'productos' | 'config';

interface NavItem {
  key: Route;
  label: string;
  icon: typeof Home;
}

const primaryNav: NavItem[] = [
  { key: 'inicio', label: 'Inicio', icon: Home },
  { key: 'listas', label: 'Listas', icon: ListOrdered },
  { key: 'comprar', label: 'Comprar', icon: ShoppingCart },
  { key: 'stock', label: 'Stock', icon: Package },
];

const secondaryNav: NavItem[] = [
  { key: 'productos', label: 'Productos', icon: Tag },
  { key: 'config', label: 'Configuración', icon: Settings },
];

interface LayoutProps {
  current: Route;
  onNavigate: (route: Route) => void;
  children: ReactNode;
  onSignOut: () => void;
  userEmail: string | null;
}

export function Layout({ current, onNavigate, children, onSignOut, userEmail }: LayoutProps) {
  const isActive = (key: Route) => current === key;

  return (
    <div className="min-h-screen bg-crema-100 flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-crema-200 bg-crema-100/90 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mate-500 text-crema-50">
                <span className="text-base font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif' }}>C</span>
              </div>
              <span className="text-lg font-medium text-mate-700" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
                Cebador
              </span>
            </div>

            <div className="flex items-center gap-1">
              {primaryNav.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  className={`hidden sm:inline-flex rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive(item.key) ? 'bg-mate-500 text-crema-50' : 'text-mate-500 hover:bg-crema-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <span className="mx-1 hidden h-5 w-px bg-crema-300 sm:block" />
              {secondaryNav.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                    isActive(item.key)
                      ? 'bg-mate-500 text-crema-50'
                      : 'text-mate-500 hover:bg-crema-200'
                  }`}
                >
                  <span className="hidden sm:inline">{item.label}</span>
                  <item.icon size={18} className="sm:hidden" />
                </button>
              ))}
              <button
                onClick={onSignOut}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-mate-400 hover:text-alerta-500 transition-colors sm:px-3 sm:text-sm"
                title={userEmail ? `Cerrar sesión (${userEmail})` : 'Cerrar sesión'}
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-24 sm:pb-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-5 animate-fade-in" key={current}>
          {children}
        </div>
      </main>

      {/* Bottom navigation (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-crema-200 bg-crema-50/95 backdrop-blur-md safe-bottom sm:hidden">
        <div className="flex">
          {primaryNav.map((item) => {
            const active = isActive(item.key);
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className="flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors"
              >
                <item.icon
                  size={22}
                  className={active ? 'text-mate-500' : 'text-mate-300'}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span
                  className={`text-[10px] font-medium ${active ? 'text-mate-500' : 'text-mate-300'}`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
