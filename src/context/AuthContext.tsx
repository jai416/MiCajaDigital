import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '@/src/services/supabase';
import { useSQLiteContext } from 'expo-sqlite';
import { type Session, type User } from '@supabase/supabase-js';
import { setSecureValue, SECURE_KEYS } from '@/src/utils/storage';
import {
  calcularEstadoSuscripcion,
  DIAS_PRUEBA,
  type EstadoSuscripcion,
} from '@/src/utils/suscripcion';

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
  estadoSuscripcion: EstadoSuscripcion;
  diasRestantes: number;
  recheckSuscripcion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  negocioNombre: '',
  login: async () => null,
  register: async () => null,
  logout: async () => undefined,
  estadoSuscripcion: 'activo',
  diasRestantes: DIAS_PRUEBA,
  recheckSuscripcion: async () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    negocioNombre: '',
  });
  const [estadoSuscripcion, setEstadoSuscripcion] = useState<EstadoSuscripcion>('activo');
  const [diasRestantes, setDiasRestantes] = useState(DIAS_PRUEBA);

  const verificarSuscripcion = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('negocios')
        .select('activo, fecha_registro, fecha_expiracion')
        .eq('id', userId)
        .single();

      if (error) {
        throw error;
      }

      const calculado = calcularEstadoSuscripcion(data);
      setEstadoSuscripcion(calculado.estado);
      setDiasRestantes(calculado.diasRestantes);
    } catch (e) {
      console.error('Error al verificar suscripción:', e);
      setEstadoSuscripcion('error');
    }
  }, []);

  const recheckSuscripcion = useCallback(async () => {
    if (state.user) {
      await verificarSuscripcion(state.user.id);
    }
  }, [state.user, verificarSuscripcion]);

  const guardarUserId = useCallback(async (userId: string) => {
    try {
      await db.runAsync('INSERT OR REPLACE INTO app_config (clave, valor) VALUES (?, ?)', [
        'user_id',
        userId,
      ]);
      await setSecureValue(SECURE_KEYS.USER_ID, userId);
    } catch (e) {
      console.error('Error al guardar user_id:', e);
    }
  }, [db]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        loading: false,
      }));
      if (session?.user) {
        guardarUserId(session.user.id);
      }
    }).catch(() => {
      setState((s) => ({ ...s, loading: false }));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        loading: false,
      }));
      if (session?.user) {
        guardarUserId(session.user.id);
        verificarSuscripcion(session.user.id);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [db, guardarUserId, verificarSuscripcion]);

  useEffect(() => {
    if (state.user) {
      verificarSuscripcion(state.user.id);
    }
  }, [state.user, verificarSuscripcion]);

  useEffect(() => {
    const alVolver = (estado: AppStateStatus) => {
      if (estado === 'active' && state.user) {
        verificarSuscripcion(state.user.id);
      }
    };
    const sub = AppState.addEventListener('change', alVolver);
    return () => sub.remove();
  }, [state.user, verificarSuscripcion]);

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const mensaje =
          error.message === 'Invalid login credentials'
            ? 'Correo o contraseña incorrectos. Verifica tus datos.'
            : 'No se pudo conectar. Revisa tu internet e intenta de nuevo.';
        return mensaje;
      }
      return null;
    } catch (e) {
      console.error('Error en login:', e);
      return 'No se pudo conectar. Revisa tu internet e intenta de nuevo.';
    }
  };

  const register = async (email: string, password: string, nombre: string): Promise<string | null> => {
    try {
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
          activo: false,
          plan: 'gratis',
          fecha_registro: new Date().toISOString(),
          fecha_expiracion: new Date(Date.now() + DIAS_PRUEBA * 86400000).toISOString(),
        });
        if (dbError) { /* error silencioso */ }
      }

      return null;
    } catch (e) {
      console.error('Error en register:', e);
      return 'No se pudo registrar. Revisa tu conexión e intenta de nuevo.';
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error en logout:', e);
    }
    try {
      await db.runAsync("DELETE FROM app_config WHERE clave = 'user_id'");
    } catch (e) {
      console.error('Error al limpiar user_id:', e);
    }
    setState({ user: null, session: null, loading: false, negocioNombre: '' });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        estadoSuscripcion,
        diasRestantes,
        recheckSuscripcion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
