import { z } from 'zod';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

export const HabitFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Give your habit a name')
      .max(40, 'Keep it under 40 characters'),
    ritualId: z.string().min(1, 'Pick a ritual'),
    icon: z.string().min(1),
    color: z.string().regex(HEX_REGEX),
    target: z
      .number()
      .int()
      .min(1, 'Daily target is between 1 and 12')
      .max(12, 'Daily target is between 1 and 12'),
    reminderEnabled: z.boolean(),
    reminderTime: z.string().nullable(),
  })
  .refine(
    (data) => {
      if (!data.reminderEnabled) return true;
      return data.reminderTime !== null && TIME_REGEX.test(data.reminderTime);
    },
    { message: 'Set a valid reminder time', path: ['reminderTime'] },
  );

export type HabitFormValues = z.infer<typeof HabitFormSchema>;
