import { Tabs } from 'expo-router';
import { Text, useColorScheme } from 'react-native';
import { colors } from '@/src/theme/colors';

export default function TabLayout() {
  const scheme = useColorScheme();
  const c = colors[scheme ?? 'light'];

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
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>💲</Text>,
        }}
      />
      <Tabs.Screen
        name="cuadre"
        options={{
          title: 'Cuadre',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>👥</Text>,
        }}
      />
      <Tabs.Screen
        name="gastos"
        options={{
          title: 'Gastos',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>📉</Text>,
        }}
      />
    </Tabs>
  );
}
