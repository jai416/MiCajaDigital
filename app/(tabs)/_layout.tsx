import { useCallback, useState } from 'react';
import { Tabs } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useAccentColors } from '@/src/context/AccentContext';
import { useAuth } from '@/src/context/AuthContext';
import { getUserId } from '@/src/utils/user';

export default function TabLayout() {
  const { theme: c } = useAccentColors();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [pedidosPendientes, setPedidosPendientes] = useState(0);

  const cargarPedidos = useCallback(async () => {
    try {
      const userId = await getUserId(db, user);
      if (!userId) {
        setPedidosPendientes(0);
        return;
      }
      const row = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM ventas WHERE tipo_pedido = 'pedido' AND estado_pedido = 'pendiente' AND user_id = ? AND deleted_at IS NULL",
        [userId]
      );
      setPedidosPendientes(row?.count ?? 0);
    } catch {
      setPedidosPendientes(0);
    }
  }, [db, user]);

  useFocusEffect(useCallback(() => {
    cargarPedidos();
  }, [cargarPedidos]));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: {
          backgroundColor: c.tabBar,
          borderTopColor: c.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ventas',
          tabBarIcon: ({ color }) => <Ionicons name="cash" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cuadre"
        options={{
          title: 'Cuadre',
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ color }) => <Ionicons name="people" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="gastos"
        options={{
          title: 'Gastos',
          tabBarIcon: ({ color }) => <Ionicons name="trending-down" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="catalogo"
        options={{
          title: 'Productos',
          tabBarIcon: ({ color }) => <Ionicons name="cube" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pedidos"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color }) => <Ionicons name="clipboard" size={22} color={color} />,
          tabBarBadge: pedidosPendientes > 0 ? pedidosPendientes : undefined,
        }}
      />
      <Tabs.Screen
        name="reportes"
        options={{
          title: 'Reportes',
          tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
