"use client";
import { authClient } from "@/lib/auth-client";
import { ActionForm, Field, value } from "@/components/bookcircle/primitives";
import Link from "next/link";
export default function ResetPassword() {
  return (
    <main className="welcome">
      <div className="auth-card">
        <h1>A fresh start.</h1>
        <p>Choose a new password for your BookCircle account.</p>
        <ActionForm
          label="Reset password"
          onSubmit={async (d) => {
            const password = value(d, "password");
            if (password !== value(d, "confirm"))
              throw new Error("Your passwords do not match.");
            const result = await authClient.resetPassword({
              newPassword: password,
            });
            if (result.error) throw new Error(result.error.message);
          }}
        >
          <Field label="New password">
            <input
              name="password"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm password">
            <input
              name="confirm"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </Field>
        </ActionForm>
        <Link className="primary-link" href="/">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
