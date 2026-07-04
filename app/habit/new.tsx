import { useLocalSearchParams } from 'expo-router';
import HabitFormScreen from '@/components/habits/habit-form-screen';

export default function NewHabitScreen() {
  const { ritualId } = useLocalSearchParams<{ ritualId?: string }>();
  return <HabitFormScreen mode="create" defaultRitualId={ritualId} />;
}
