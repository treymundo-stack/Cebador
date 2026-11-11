import { useState, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Feedback';

export function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !password.trim()) {
      setError('Completá email y contraseña.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: signInError } = await signIn(email.trim(), password);
        if (signInError) {
          setError(
            signInError.includes('Invalid login')
              ? 'Email o contraseña incorrectos.'
              : signInError
          );
        }
      } else {
        const { error: signUpError, needsSeed } = await signUp(email.trim(), password);
        if (signUpError) {
          setError(signUpError);
        } else if (needsSeed) {
          setInfo('Cuenta creada. Revisá tu mail para confirmarla y después ingresá.');
        }
      }
    } catch {
      setError('Ocurrió un error. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-crema-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo / branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-mate-500 text-crema-50 shadow-lg">
            <span className="text-3xl font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif' }}>C</span>
          </div>
          <h1 className="text-3xl font-medium text-mate-700" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
            Cebador
          </h1>
          <p className="mt-1 text-sm text-mate-400">Asistente de compras de Impulse Space</p>
        </div>

        <div className="card p-6 animate-scale-in">
          <div className="mb-5 flex gap-1 rounded-xl bg-crema-200 p-1">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setInfo(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-crema-50 text-mate-700 shadow-sm' : 'text-mate-400'
              }`}
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); setInfo(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                mode === 'signup' ? 'bg-crema-50 text-mate-700 shadow-sm' : 'text-mate-400'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          {error && <Alert variant="error" className="mb-4">{error}</Alert>}
          {info && <Alert variant="success" className="mb-4">{info}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="tu@email.com"
                disabled={loading}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Mínimo 6 caracteres"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? <Spinner size={18} /> : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>

          {mode === 'signup' && (
            <p className="mt-4 text-xs text-mate-400 text-center">
              Después de crear tu cuenta podés cargar datos de prueba (todos ficticios) desde Configuración.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
