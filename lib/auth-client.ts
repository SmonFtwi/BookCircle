import { supabase } from "@/lib/supabase/client";

export const authClient = {
  signIn: {
    email: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) return { error: { message: error.message } };
      return { data, error: null };
    },
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return { error: { message: error.message } };
    return { data: true, error: null };
  },
  requestPasswordReset: async ({
    email,
    redirectTo,
  }: {
    email: string;
    redirectTo?: string;
  }) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo || "/reset-password")}`,
      },
    );
    if (error) return { error: { message: error.message } };
    return { data: true, error: null };
  },
  resetPassword: async ({ newPassword }: { newPassword: string }) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: { message: error.message } };
    return { data: true, error: null };
  },
};
