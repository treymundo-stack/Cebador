import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Layout, type Route } from '@/components/Layout';
import { LoginScreen } from '@/screens/LoginScreen';
import { InicioScreen } from '@/screens/InicioScreen';
import { ListasScreen } from '@/screens/ListasScreen';
import { CompraScreen } from '@/screens/CompraScreen';
import { StockScreen } from '@/screens/StockScreen';
import { ProductosScreen } from '@/screens/ProductosScreen';
import { ConfigScreen } from '@/screens/ConfigScreen';
import { Spinner } from '@/components/ui/Feedback';

function AppContent() {
  const { session, loading, signOut, user } = useAuth();
  const [route, setRoute] = useState<Route>('inicio');

  if (loading) {
    return (
      <div className="min-h-screen bg-crema-100 flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const renderRoute = () => {
    switch (route) {
      case 'inicio':
        return <InicioScreen onNavigate={setRoute} />;
      case 'listas':
        return <ListasScreen />;
      case 'comprar':
        return <CompraScreen />;
      case 'stock':
        return <StockScreen />;
      case 'productos':
        return <ProductosScreen />;
      case 'config':
        return <ConfigScreen />;
      default:
        return <InicioScreen onNavigate={setRoute} />;
    }
  };

  return (
    <Layout
      current={route}
      onNavigate={setRoute}
      onSignOut={handleSignOut}
      userEmail={user?.email ?? null}
    >
      {renderRoute()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
