export const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));
