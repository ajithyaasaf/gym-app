import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "outline" | "neutral";
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const base =
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border";

  const variants = {
    default: "bg-indigo-50 text-indigo-700 border-indigo-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    destructive: "bg-rose-50 text-rose-700 border-rose-200",
    outline: "bg-transparent text-slate-700 border-slate-300",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <span
      className={twMerge(clsx(base, variants[variant], className))}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * High-visibility plain language status badge with color + text (accessibility compliant).
 */
export function StatusBadge({ status }: { status: string }) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return <Badge variant="success">Active</Badge>;
    case "UPCOMING":
      return <Badge variant="default">Upcoming</Badge>;
    case "PAUSED":
      return <Badge variant="warning">Paused</Badge>;
    case "EXPIRED":
      return <Badge variant="destructive">Expired</Badge>;
    case "CANCELLED":
      return <Badge variant="neutral">Cancelled</Badge>;
    case "PAID":
      return <Badge variant="success">Paid</Badge>;
    case "PARTIALLY_PAID":
      return <Badge variant="warning">Balance Due</Badge>;
    case "PENDING":
      return <Badge variant="destructive">Unpaid</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}

