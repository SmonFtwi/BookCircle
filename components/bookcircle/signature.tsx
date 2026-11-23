import type { ReactNode } from "react";
export function ProgressRing({
  value,
  label,
  size = 72,
}: {
  value: number;
  label: string;
  size?: number;
}) {
  const progress = Math.min(
    100,
    Math.max(0, Number.isFinite(value) ? value : 0),
  );
  const circumference = 2 * Math.PI * 29;
  return (
    <span
      className={`progress-ring ${progress >= 100 ? "goal-complete" : ""}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} viewBox="0 0 68 68" aria-hidden="true">
        <circle className="ring-track" cx="34" cy="34" r="29" />
        <circle
          className="ring-fill"
          cx="34"
          cy="34"
          r="29"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress / 100)}
        />
      </svg>
      <span aria-hidden="true">{Math.round(progress)}%</span>
    </span>
  );
}
export function AvatarStack({ names }: { names: string[] }) {
  return (
    <div className="avatar-stack" aria-label={names.join(", ")}>
      {names.slice(0, 4).map((name, i) => (
        <span className="avatar" key={`${name}-${i}`} aria-hidden="true">
          {name.slice(0, 1)}
        </span>
      ))}
    </div>
  );
}
export function StreakRibbon({ children }: { children: ReactNode }) {
  return <span className="streak-ribbon">{children}</span>;
}
