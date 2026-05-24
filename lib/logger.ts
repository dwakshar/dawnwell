const PREFIX = '[dawnwell]';

export const logger = {
  info: (...args: unknown[]): void => {
    if (__DEV__) console.info(PREFIX, ...args);
  },
  warn: (...args: unknown[]): void => {
    if (__DEV__) console.warn(PREFIX, ...args);
  },
  error: (...args: unknown[]): void => {
    if (__DEV__) console.error(PREFIX, ...args);
  },
};
