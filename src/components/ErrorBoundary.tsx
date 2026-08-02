import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { logError } from '@/src/services/logger';
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logError('ErrorBoundary', error, errorInfo.componentStack ?? '');
  }

  private reintentar = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.contenedor}>
          <Text style={styles.icono}>😅</Text>
          <Text style={styles.titulo}>Ups, algo falló</Text>
          <Text style={styles.mensaje}>
            Ocurrió un error inesperado en la app. No te preocupes, tus datos están a salvo.
          </Text>
          <Pressable style={styles.boton} onPress={this.reintentar}>
            <Text style={styles.botonTexto}>Reintentar</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  icono: { fontSize: 56, marginBottom: 16 },
  titulo: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  mensaje: { fontSize: 15, color: '#475569', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  boton: { backgroundColor: '#059669', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  botonTexto: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
