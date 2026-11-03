"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

// Label, hint, and error wiring shared by every form control.
export function FieldShell({ label, hint, error, optional, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : "";
  const errorId = error ? `${id}-error` : "";
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="mc-label">
        {label}
        {optional ? <span className="mc-hint font-normal"> (optional)</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="mc-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mc-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type Common = { label: string; hint?: ReactNode; error?: string | null; optional?: boolean };

export function TextField({ label, hint, error, optional, className = "", ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={`mc-input ${className}`} {...props} />
      )}
    </FieldShell>
  );
}

export function TextAreaField({ label, hint, error, optional, className = "", ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={`mc-input ${className}`} rows={3} {...props} />
      )}
    </FieldShell>
  );
}

export function SelectField({ label, hint, error, optional, className = "", children, ...props }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={`mc-input ${className}`} {...props}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}
