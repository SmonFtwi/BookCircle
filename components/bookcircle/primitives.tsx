"use client";
import { useState, type ReactNode, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, BookOpen, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark">
        <BookOpen size={23} />
      </span>
      BookCircle<span className="logo-dot">.</span>
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <BookOpen />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div
      aria-label="Loading your circle"
      className="loading-grid"
      role="status"
    >
      <span className="sr-only">Loading…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}
export function Meter({ value, label }: { value: number; label?: string }) {
  return (
    <div
      className="meter"
      role="progressbar"
      aria-label={label || "Progress"}
      aria-valuenow={Math.round(
        Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)),
      )}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        style={{
          width: `${Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))}%`,
        }}
      />
    </div>
  );
}
export function Cover({
  title,
  author,
  coverUrl,
  small = false,
}: {
  title: string;
  author?: string;
  coverUrl?: string;
  small?: boolean;
}) {
  return (
    <div
      className={`book-cover ${small ? "small" : ""}`}
      style={
        coverUrl
          ? { backgroundImage: `url(${JSON.stringify(coverUrl).slice(1, -1)})` }
          : undefined
      }
    >
      {!coverUrl && (
        <>
          <BookOpen size={small ? 18 : 27} />
          <strong>{title}</strong>
          <span>{author}</span>
        </>
      )}
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  trigger,
  open,
  onOpenChange,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title className="dialog-title">{title}</Dialog.Title>
          <Dialog.Description className={description ? "muted" : "sr-only"}>
            {description || title}
          </Dialog.Description>
          <Dialog.Close className="dialog-close" aria-label="Close">
            <X size={20} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ActionForm({
  onSubmit,
  children,
  label = "Save",
  onSuccess,
}: {
  onSubmit: (data: FormData) => Promise<unknown>;
  children: ReactNode;
  label?: string;
  onSuccess?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    setDone(false);
    try {
      await onSubmit(new FormData(form));
      setDone(true);
      onSuccess?.();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack">
      {children}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="success-message">
          Saved to your circle.
        </p>
      )}
      <Button disabled={busy} type="submit">
        {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
        {busy ? "Saving…" : label}
      </Button>
    </form>
  );
}
export function errorText(e: unknown) {
  return e instanceof Error
    ? e.message.split("\n")[0]
    : "Something went wrong. Please try again.";
}
export function useFeedback() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(work: () => Promise<unknown>, successMessage = "Saved.") {
    setBusy(true);
    try {
      await work();
      setMessage(successMessage);
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return {
    run,
    busy,
    feedback: message ? (
      <p role="status" className="feedback">
        {message}
      </p>
    ) : null,
  };
}
export const value = (d: FormData, k: string) => String(d.get(k) || "");
export const number = (d: FormData, k: string) => Number(d.get(k));
export function dayInZone(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
