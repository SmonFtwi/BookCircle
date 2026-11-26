"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAction, useQuery, useAuth } from "@/lib/supabase/hooks";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, LockKeyhole, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/supabase/api";
import { Button } from "@/components/ui/button";
import { Logo, Field, errorText } from "@/components/bookcircle/primitives";
const formSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  name: z.string(),
  code: z.string(),
  confirm: z.string(),
});
type Values = z.infer<typeof formSchema>;
export default function Welcome({
  invite = "",
  authError,
}: {
  invite?: string;
  authError?: string;
}) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"login" | "join" | "reset">(
    invite ? "join" : "login",
  );
  const [busy, setBusy] = useState(false);
  const [invitation, setInvitation] = useState(invite);
  const [verified, setVerified] = useState(false);
  const validate = useAction(api.registration.validateInvitation);
  const configuration = useQuery(api.profiles.configuration);
  const [error, setError] = useState(
    authError
      ? "This email link has expired or is invalid. Request a new confirmation email below, or use Forgot your password for a new reset link."
      : "",
  );
  const [notice, setNotice] = useState("");
  const [showResend, setShowResend] = useState(!!authError);
  const registerAccount = useAction(api.registration.register);

  useEffect(() => {
    if (isAuthenticated && !invite) {
      router.replace("/home");
    }
  }, [isAuthenticated, invite, router]);
  const {
    register,
    getValues,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "", name: "", code: "", confirm: "" },
  });
  async function submit(data: Values) {
    setBusy(true);
    setError("");
    try {
      if (mode === "join") {
        if (!invitation.trim() || !data.name.trim())
          throw new Error("Enter your invitation code and full name.");
        if (data.password.length < 12)
          throw new Error("Use a password with at least 12 characters.");
        if (data.password !== data.confirm)
          throw new Error("Your passwords do not match.");
        await registerAccount({
          code: invitation,
          email: data.email,
          password: data.password,
          name: data.name,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        setNotice(
          "Account created. Check your email to confirm your address, then sign in.",
        );
        setShowResend(true);
        setMode("login");
        return;
      }
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });
      if (result.error)
        throw new Error(result.error.message || "Unable to sign in.");
      router.push("/home");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="welcome">
      <div className="welcome-shell">
        <section className="welcome-story">
          <Logo />
          <div>
            <h1>
              Your book club,
              <br />
              in one place.
            </h1>
            <p>Choose a book. Track your reading. Talk about it together.</p>
          </div>
          <div className="welcome-footer">
            <LockKeyhole size={14} />
            Your private space to read, reflect, and grow.
          </div>
        </section>
        <section className="auth-card">
          <h2>
            {mode === "join"
              ? "Join your book club"
              : mode === "reset"
                ? "Reset your password"
                : "Sign in"}
          </h2>
          <p>
            {mode === "join"
              ? "Use your invitation to create an account."
              : mode === "reset"
                ? "Enter your email to request a password reset link."
                : "Sign in to pick up where you left off."}
          </p>
          {mode !== "reset" && (
            <div className="tabs-row">
              <button
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Sign in
              </button>
              <button
                className={mode === "join" ? "active" : ""}
                onClick={() => {
                  setMode("join");
                  setError("");
                }}
              >
                Join with invitation
              </button>
            </div>
          )}
          {mode === "join" && !verified ? (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await validate({ code: invitation });
                  setVerified(true);
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field
                label="Invitation code"
                hint="Ask your club administrator for your private invitation."
              >
                <input
                  value={invitation}
                  onChange={(e) => setInvitation(e.target.value)}
                  autoComplete="off"
                  required
                />
              </Field>
              <Button disabled={busy}>
                Continue <ArrowRight />
              </Button>
            </form>
          ) : mode === "reset" ? (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const d = new FormData(e.currentTarget);
                  if (!configuration?.passwordResetEnabled)
                    throw new Error(
                      "Password reset email is not configured. Contact your club administrator.",
                    );
                  const r = await authClient.requestPasswordReset({
                    email: String(d.get("email")),
                    redirectTo: "/reset-password",
                  });
                  if (r.error)
                    throw new Error(
                      r.error.message ||
                        "Password reset is unavailable. Contact your club administrator.",
                    );
                  setNotice(
                    "If your email is registered, a reset link will arrive shortly.",
                  );
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Email address">
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </Field>
              <Button disabled={busy}>Send reset link</Button>
              <button
                type="button"
                className="text-button"
                onClick={() => setMode("login")}
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <form className="form-stack" onSubmit={handleSubmit(submit)}>
              {mode === "join" && (
                <>
                  <p className="success-message">
                    Invitation validated. Let’s create your account.
                  </p>
                  <Field label="Full name">
                    <input
                      {...register("name")}
                      autoComplete="name"
                      required
                      placeholder="How should we call you?"
                    />
                  </Field>
                </>
              )}
              <Field label="Email address">
                <input
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </Field>
              {errors.email && (
                <p className="error-message">{errors.email.message}</p>
              )}
              <Field
                label="Password"
                hint={mode === "join" ? "At least 12 characters." : undefined}
              >
                <input
                  {...register("password")}
                  type="password"
                  autoComplete={
                    mode === "join" ? "new-password" : "current-password"
                  }
                  required
                  placeholder="Enter your password"
                />
              </Field>
              {mode === "join" && (
                <Field label="Confirm password">
                  <input
                    {...register("confirm")}
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                </Field>
              )}
              {mode === "login" && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setMode("reset");
                    setError("");
                  }}
                >
                  Forgot your password?
                </button>
              )}
              <Button disabled={busy} type="submit">
                {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                {busy
                  ? "Please wait…"
                  : mode === "join"
                    ? "Create account"
                    : "Sign in"}
              </Button>
            </form>
          )}
          {showResend && mode === "login" && (
            <Button
              variant="outline"
              className="mt-4"
              disabled={busy}
              onClick={async () => {
                const email = getValues("email").trim();
                if (!email) {
                  setError(
                    "Enter your email address above, then request a new confirmation email.",
                  );
                  return;
                }
                setBusy(true);
                setError("");
                try {
                  const result = await authClient.resendConfirmation({ email });
                  if (result.error) throw new Error(result.error.message);
                  setNotice("Check your email for a new confirmation link.");
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Resend confirmation email
            </Button>
          )}
          {error && (
            <p className="error-message spaced" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="success-message spaced" role="status">
              {notice}
            </p>
          )}
          <div className="auth-footer">
            <LockKeyhole size={13} className="inline mr-1" />A private,
            invitation-only community.
          </div>
        </section>
      </div>
    </main>
  );
}
