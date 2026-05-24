export type Greeting =
  | 'Good morning'
  | 'Good afternoon'
  | 'Good evening'
  | 'Hello, night owl';

export function getGreeting(date: Date): Greeting {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Hello, night owl';
}
