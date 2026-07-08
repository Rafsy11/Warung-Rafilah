export function requireProductionEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} is required in production`);
  }

  return '';
}

export function getJwtSecret(): string {
  const value = process.env.JWT_SECRET?.trim();
  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  return 'fallback_dev_secret';
}
