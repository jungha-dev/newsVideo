"use client";

import React from "react";

interface ButtonProps {
  children: React.ReactNode;
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "primary-full"
    | "secondary-light"
    | "normal";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
  full?: boolean;
  title?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = "secondary",
  size = "md",
  disabled = false,
  loading = false,
  onClick,
  className = "",
  type = "button",
  full = false,
  title,
}) => {
  const baseStyles = `
    inline-flex items-center justify-center
    font-medium rounded-2xl
    text-bold font-bold
    transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    hover:transform  active:scale-95
    cursor-pointer
    ${full ? "w-full" : ""}
  `;

  const variantStyles = {
    primary: `
      bg-[var(--color-primary)] text-white
      hover:bg-[var(--color-primary-dark)]
      focus:ring-[var(--color-primary)]
    `,
    secondary: `
      bg-[var(--color-secondary)] text-gray-800
      hover:bg-[var(--color-secondary-dark)]
      focus:ring-[var(--color-secondary)]
    `,
    outline: `
      border-2 border-[var(--color-primary)] text-[var(--color-primary)]
      hover:bg-[var(--color-primary)] hover:text-white
      focus:ring-[var(--color-primary)]
      bg-transparent
    `,
    "primary-full": `
      w-full bg-[var(--color-primary)] text-white
      hover:bg-[var(--color-primary-dark)]
      focus:ring-[var(--color-primary)]
      p-3 text-lg
    `,
    "secondary-light": `
      bg-[var(--color-secondary-light)] text-gray-800
      hover:bg-[var(--color-secondary)]
      focus:ring-[var(--color-secondary-light)]
    `,
    normal: ` 
      text-[var(--color-black)]
      focus:ring-white/0
      bg-transparent`,
  };

  const sizeStyles = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  // primary-full variant인 경우 size 스타일을 적용하지 않음
  const shouldApplySize = variant !== "primary-full";
  const sizeStyle = shouldApplySize ? sizeStyles[size] : "";

  const combinedStyles = `
    ${baseStyles}
    ${variantStyles[variant]}
    ${sizeStyle}
    ${className}
  `;

  return (
    <button
      type={type}
      className={combinedStyles}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;
