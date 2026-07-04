import { useLocalSearchParams } from 'expo-router';
import HabitFormScreen from '@/components/habits/habit-form-screen';

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HabitFormScreen mode="edit" habitId={id} />;
}
