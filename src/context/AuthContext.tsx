import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/src/services/supabase';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert } from 'react-native';
import { type Session, type User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  negocioNombre: string;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string, nombre: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  negocioNombre: '',
  login: async () => null,
  register: async () => null,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    negocioNombre: '',
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        loading: false,
      }));
      if (session?.user) {
        db.runAsync('INSERT OR REPLACE INTO app_config (clave, valor) VALUES (?, ?)', [
          'user_id',
          session.user.id,
        ]);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        loading: false,
      }));
      if (session?.user) {
        db.runAsync('INSERT OR REPLACE INTO app_config (clave, valor) VALUES (?, ?)', [
          'user_id',
          session.user.id,
        ]);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [db]);

  const login = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const mensaje =
        error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos. Verifica tus datos.'
          : 'No se pudo conectar. Revisa tu internet e intenta de nuevo.';
      return mensaje;
    }
    return null;
  };

  const register = async (email: string, password: string, nombre: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      const mensaje =
        error.message.includes('already registered')
          ? 'Este correo ya está registrado. ¿Quieres iniciar sesión?'
          : 'No se pudo registrar. Revisa tu conexión e intenta de nuevo.';
      return mensaje;
    }

    if (data.user) {
      const { error: dbError } = await supabase.from('negocios').insert({
        id: data.user.id,
        email,
        nombre_negocio: nombre,
        activo: true,
        plan: 'gratis',
        fecha_registro: new Date().toISOString(),
        fecha_expiracion: new Date(Date.now() + 15 * 86400000).toISOString(),
      });
      if (dbError) console.warn('Error creando negocio:', dbError.message);
    }

    return null;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    await db.runAsync("DELETE FROM app_config WHERE clave = 'user_id'");
    setState({ user: null, session: null, loading: false, negocioNombre: '' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
