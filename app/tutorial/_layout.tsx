import { Stack } from 'expo-router';

export default function TutorialLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="paso1" />
      <Stack.Screen name="paso2" />
      <Stack.Screen name="paso3" />
    </Stack>
  );
}
