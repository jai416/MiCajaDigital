import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

function RightAction({
  color,
  icon,
  label,
  dragX,
  onPress,
}: {
  color: string;
  icon: string;
  label: string;
  dragX: SharedValue<number>;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value + 160 }],
  }));

  return (
    <Animated.View style={[styles.actionContainer, style]}>
      <Pressable
        style={[styles.action, { backgroundColor: color }]}
        onPress={onPress}
      >
        <Text style={styles.actionIcon}>{icon}</Text>
        <Text style={styles.actionLabel}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function SwipeableRow({
  children,
  onSwipe,
  onEdit,
}: {
  children: ReactNode;
  onSwipe?: () => void;
  onEdit?: () => void;
}) {
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      renderRightActions={(progress, dragX) => (
        <View style={{ flexDirection: 'row' }}>
          {onEdit && (
            <RightAction
              color="#3B82F6"
              icon="✏️"
              label="Editar"
              dragX={dragX}
              onPress={onEdit}
            />
          )}
          {onSwipe && (
            <RightAction
              color="#EF4444"
              icon="🗑️"
              label="Eliminar"
              dragX={dragX}
              onPress={onSwipe}
            />
          )}
        </View>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  actionContainer: {
    justifyContent: 'center',
  },
  action: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionIcon: { fontSize: 22 },
  actionLabel: { color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 2 },
});
