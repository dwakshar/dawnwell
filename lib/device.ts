import * as Device from 'expo-device';

const AGGRESSIVE_BRANDS = ['xiaomi', 'oppo', 'vivo', 'huawei', 'meizu', 'oneplus'] as const;

/**
 * Returns true for OEM brands known to aggressively kill background processes.
 * Used by P10 Settings to show a one-time tip for affected users.
 */
export function isPotentiallyAggressiveOEM(): boolean {
  const brand = Device.brand?.toLowerCase() ?? '';
  return AGGRESSIVE_BRANDS.some((b) => brand.includes(b));
}
