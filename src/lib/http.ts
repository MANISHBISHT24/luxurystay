export class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(process.env.AUTH_URL || request.url).origin;
  } catch {
    return false;
  }
}
