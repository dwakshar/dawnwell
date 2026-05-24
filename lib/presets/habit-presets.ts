import {
  Droplet,
  Sun,
  Moon,
  BookOpen,
  Dumbbell,
  Footprints,
  Leaf,
  Heart,
  PenLine,
  Music,
  Brain,
  Sparkles,
  Coffee,
  Apple,
  Bike,
  Mountain,
  Salad,
  Smile,
  Wind,
  Flame,
  Zap,
  Target,
  Feather,
  Headphones,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import type { HabitFormValues } from '@/lib/schemas/habit-form';

export const HABIT_ICONS: { name: string; Component: LucideIcon }[] = [
  { name: 'Droplet', Component: Droplet },
  { name: 'Sun', Component: Sun },
  { name: 'Moon', Component: Moon },
  { name: 'BookOpen', Component: BookOpen },
  { name: 'Dumbbell', Component: Dumbbell },
  { name: 'Footprints', Component: Footprints },
  { name: 'Leaf', Component: Leaf },
  { name: 'Heart', Component: Heart },
  { name: 'PenLine', Component: PenLine },
  { name: 'Music', Component: Music },
  { name: 'Brain', Component: Brain },
  { name: 'Sparkles', Component: Sparkles },
  { name: 'Coffee', Component: Coffee },
  { name: 'Apple', Component: Apple },
  { name: 'Bike', Component: Bike },
  { name: 'Mountain', Component: Mountain },
  { name: 'Salad', Component: Salad },
  { name: 'Smile', Component: Smile },
  { name: 'Wind', Component: Wind },
  { name: 'Flame', Component: Flame },
  { name: 'Zap', Component: Zap },
  { name: 'Target', Component: Target },
  { name: 'Feather', Component: Feather },
  { name: 'Headphones', Component: Headphones },
];

export const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  HABIT_ICONS.map(({ name, Component }) => [name, Component]),
);

// 8 warm-palette colours that harmonise with the Dawnwell token set
// and hold legibility on both light (bg #f8f5f0) and dark (bg #0c0a09) surfaces.
export const HABIT_COLORS: string[] = [
  '#c2410c', // Rust — the product accent; first/default pick
  '#d97706', // Amber — from token; warm and energising
  '#65735a', // Sage — from token; calm, earthy green
  '#5b8fb9', // Soft blue — sky-adjacent; serene contrast to the warm set
  '#c084a0', // Clay pink — dusty rose; gentle and warm
  '#7c5e8c', // Deep plum — rich, quiet; holds on both modes
  '#5a8a80', // Muted teal — earthen green-blue; balanced mid-ground
  '#a89070', // Sand — parchment warm neutral; understated
];

export function getDefaultFormValues(ritualId: string | null): HabitFormValues {
  return {
    name: '',
    ritualId: ritualId ?? '',
    icon: 'Sparkles',
    color: HABIT_COLORS[0] ?? '#c2410c',
    target: 1,
    reminderEnabled: false,
    reminderTime: null,
  };
}
