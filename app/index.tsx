import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { supabase } from '@/src/services/supabase';

export default function RootRedirect() {
  const db = useSQLiteContext();

  useEffect(() => {
    (async () => {
      const tutorialRow = await db.getFirstAsync<{ valor: string }>(
        "SELECT valor FROM app_config WHERE clave = 'tutorial_visto'"
      );
      const tutorialVisto = tutorialRow?.valor === 'si';

      if (!tutorialVisto) {
        router.replace('/tutorial/paso1');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await db.runAsync('INSERT OR REPLACE INTO app_config (clave, valor) VALUES (?, ?)', [
          'user_id',
          session.user.id,
        ]);
        router.replace('/(tabs)');
      } else {
        router.replace('/auth/login');
      }
    })();
  }, [db]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#059669" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
