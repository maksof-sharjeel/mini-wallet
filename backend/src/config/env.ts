export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} must be set. Copy .env.example to .env and configure it before starting the backend.`,
    );
  }
  return value;
}
