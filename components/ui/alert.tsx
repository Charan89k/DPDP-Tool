import React from "react";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "warning" | "error" | "success";
  title?: string;
}

export function Alert({
  className = "",
  variant = "info",
  title,
  children,
  ...props
}: AlertProps) {
  const variantStyles = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    error: "bg-rose-50 border-rose-200 text-rose-900",
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  };

  return (
    <div
      role="alert"
      className={`p-4 rounded-md border text-sm ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {title && <h5 className="font-semibold mb-1">{title}</h5>}
      <div>{children}</div>
    </div>
  );
}

