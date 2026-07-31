import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAccentColors } from '@/src/context/AccentContext';

export default function OfflineBanner() {
  const { theme: c } = useAccentColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const isOffline = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !state.isConnected;
      if (offline !== isOffline.current) {
        isOffline.current = offline;
        Animated.timing(opacity, {
          toValue: offline ? 1 : 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    });
    return () => unsubscribe();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: c.warning,
          opacity,
        },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.text}>
        Sin conexión — los datos se sincronizarán automáticamente
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#1A1A2E',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
