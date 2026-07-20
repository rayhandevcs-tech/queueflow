interface AuthErrorLike {
  message?: string;
  code?: string;
}

/** Friendly message for the common Supabase Auth failures. */
export function translateAuthError(err: unknown): string {
  const e = err as AuthErrorLike;
  const code = e?.code ?? "";
  const text = (e?.message ?? "").toLowerCase();

  if (code === "user_already_exists" || text.includes("already registered")) {
    return "An account already exists with this email — log in instead.";
  }
  if (code === "email_not_confirmed" || text.includes("email not confirmed")) {
    return "Email not confirmed yet — check your inbox.";
  }
  if (code === "invalid_credentials" || text.includes("invalid login credentials")) {
    return "Wrong email or password — try again.";
  }
  if (code === "weak_password" || text.includes("password")) {
    return "Password is too weak — use at least 6 characters.";
  }
  return "Something went wrong — please try again.";
}
