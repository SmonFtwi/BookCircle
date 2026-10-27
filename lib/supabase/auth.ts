import { supabase } from "./client";
import type { Contracts } from "./contracts";
export async function validateInvitation({
  code,
}: Contracts["registration.validateInvitation"]["args"]) {
  const { data, error } = await supabase.rpc("validate_invitation", {
    code: code.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  if (!data)
    throw new Error("This invitation is invalid, expired, or fully used.");
  return data as { clubName: string };
}
export async function register(
  args: Contracts["registration.register"]["args"],
) {
  if (args.password.length < 12)
    throw new Error("Use a password with at least 12 characters.");
  const { error } = await supabase.auth.signUp({
    email: args.email.trim().toLowerCase(),
    password: args.password,
    options: {
      data: {
        name: args.name.trim(),
        timezone: args.timezone,
        invite_code: args.code.trim().toUpperCase(),
      },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw new Error(error.message);
  return null;
}
export async function changePassword({
  currentPassword,
  newPassword,
}: Contracts["profiles.changePassword"]["args"]) {
  if (newPassword.length < 12)
    throw new Error("Use a password with at least 12 characters.");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.email)
    throw new Error("Sign in again to change your password.");
  const reauth = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauth.error) throw new Error("Your current password is incorrect.");
  const updated = await supabase.auth.updateUser({ password: newPassword });
  if (updated.error) throw new Error(updated.error.message);
  return null;
}
