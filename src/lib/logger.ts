const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  error: (context: string, error: unknown) => {
    if (isDev) {
      console.error(`[${context}]`, error);
    }
    // In production, errors are silently handled — API routes return proper error responses
  },
  warn: (message: string) => {
    if (isDev) {
      console.warn(message);
    }
  },
};
