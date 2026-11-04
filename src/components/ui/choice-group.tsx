"use client";

// Small selector for a block's view or mode. The current choice is shown with
// a filled background and is exposed to assistive tech with aria-pressed.
export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-border-strong p-0.5">
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          disabled={disabled}
          className={`rounded-md px-2.5 py-1 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55 ${value === option ? "bg-primary text-on-primary" : ""}`}
          onClick={() => onChange(option)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
