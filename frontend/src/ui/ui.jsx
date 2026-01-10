import React, { createContext, useContext, useMemo } from "react";

const cx = (...c) => c.filter(Boolean).join(" ");

export function Badge({ children, className = "" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 " +
          "dark:bg-slate-800 dark:text-slate-200",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  className = "",
  variant = "primary",
  type = "button",
  disabled = false,
  onClick,
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 h-10 text-sm font-medium transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";

  const styles = {
    // Svetlá: čierne tlačidlo
    // Tmavá: sky modré tlačidlo (ako na tvojom obrázku)
    primary:
      "bg-zinc-900 text-white hover:bg-zinc-800 " +
      "dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400",

    outline:
      "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 " +
      "dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:hover:bg-slate-900",

    ghost:
      "bg-transparent text-zinc-900 hover:bg-zinc-100 " +
      "dark:text-slate-100 dark:hover:bg-slate-800/60",
  };

  return (
    <button
      type={type}
      className={cx(base, styles[variant] || styles.primary, className)}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-zinc-200 bg-white shadow-sm " +
          "dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none",
        className
      )}
    >
      {children}
    </div>
  );
}
export function CardHeader({ children, className = "" }) {
  return <div className={cx("px-5 pt-5 pb-2", className)}>{children}</div>;
}
export function CardTitle({ children, className = "" }) {
  return (
    <div className={cx("text-lg font-semibold text-zinc-900 dark:text-slate-100", className)}>
      {children}
    </div>
  );
}
export function CardContent({ children, className = "" }) {
  return <div className={cx("px-5 pb-5", className)}>{children}</div>;
}

export function Input({ className = "", ...props }) {
  return (
    <input
      className={cx(
        "h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none " +
          "focus:ring-2 focus:ring-zinc-300 " +
          "dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:ring-slate-600",
        className
      )}
      {...props}
    />
  );
}

export function Label({ children, className = "", ...props }) {
  return (
    <label
      className={cx("text-sm font-medium text-zinc-800 dark:text-slate-200", className)}
      {...props}
    >
      {children}
    </label>
  );
}

export function Switch({ checked, onCheckedChange }) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange?.(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 items-center rounded-full border transition",
        checked
          ? "bg-zinc-900 border-zinc-900 dark:bg-sky-500 dark:border-sky-500"
          : "bg-zinc-200 border-zinc-200 dark:bg-slate-700 dark:border-slate-700"
      )}
      aria-pressed={!!checked}
    >
      <span
        className={cx(
          "inline-block h-5 w-5 transform rounded-full bg-white transition",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

const TabsCtx = createContext(null);

export function Tabs({ value, onValueChange, children, className = "" }) {
  const ctx = useMemo(() => ({ value, onValueChange }), [value, onValueChange]);
  return (
    <TabsCtx.Provider value={ctx}>
      <div className={cx("space-y-3", className)}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({ children, className = "" }) {
  return (
    <div
      className={cx(
        "inline-flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2 " +
          "dark:border-slate-800 dark:bg-slate-900/60",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className = "" }) {
  const ctx = useContext(TabsCtx);
  const active = ctx?.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx?.onValueChange?.(value)}
      className={cx(
        "h-9 rounded-xl px-3 text-sm font-medium transition",
        active
          ? "bg-zinc-900 text-white dark:bg-sky-500 dark:text-slate-950"
          : "bg-transparent text-zinc-800 hover:bg-zinc-100 dark:text-slate-200 dark:hover:bg-slate-800/60",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className = "" }) {
  const ctx = useContext(TabsCtx);
  if (ctx?.value !== value) return null;
  return <div className={className}>{children}</div>;
}

export function Table({ children, className = "" }) {
  return <table className={cx("w-full text-sm", className)}>{children}</table>;
}
export function THead({ children, className = "" }) {
  return (
    <thead
      className={cx(
        "bg-zinc-50 text-zinc-600 dark:bg-slate-900/60 dark:text-slate-300",
        className
      )}
    >
      {children}
    </thead>
  );
}
export function TBody({ children, className = "" }) {
  return <tbody className={className}>{children}</tbody>;
}
export function Tr({ children, className = "" }) {
  return <tr className={cx("border-b border-zinc-200 dark:border-slate-800", className)}>{children}</tr>;
}
export function Th({ children, className = "" }) {
  return (
    <th className={cx("px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide", className)}>
      {children}
    </th>
  );
}
export function Td({ children, className = "", colSpan }) {
  return (
    <td colSpan={colSpan} className={cx("px-3 py-2 align-top text-zinc-900 dark:text-slate-100", className)}>
      {children}
    </td>
  );
}

export function Dialog({ open, onOpenChange, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/60" onClick={() => onOpenChange?.(false)} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-slate-800">
            <div className="text-sm font-semibold text-zinc-900 dark:text-slate-100">{title || ""}</div>
            <button
              type="button"
              className="rounded-xl px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-slate-800/60 dark:text-slate-100"
              onClick={() => onOpenChange?.(false)}
            >
              ✕
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
