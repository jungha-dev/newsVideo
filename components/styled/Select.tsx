"use client";

"use client";

import React, { useId } from "react";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  required?: boolean;
  autoFocus?: boolean;
  error?: string;
  helperText?: string;
  name?: string;
  id?: string;
}

const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  size = "md",
  className = "",
  required = false,
  autoFocus = false,
  error,
  helperText,
  name,
  id,
}) => {
  const baseStyles = `
    w-full
    border rounded-2xl
    transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent
    disabled:opacity-50 disabled:cursor-not-allowed
    bg-white
    cursor-pointer
  `;

  const sizeStyles = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-base",
    lg: "px-6 py-4 text-lg",
  };

  const errorStyles = error
    ? `
      border-red-500 focus:border-red-500 focus:ring-red-500
      hover:border-red-600
    `
    : `
      border-1 border-secondary
      hover:border-secondary-dark
    `;

  const combinedStyles = `
    ${baseStyles}
    ${errorStyles}
    ${sizeStyles[size]}
    ${className}
  `;

  const uniqueId = useId();
  const selectId = id || name || `select-${uniqueId}`;

  return (
    <div className="w-full mb-6">
      {label && (
        <label
          htmlFor={selectId}
          className={`
            block mb-2 text-sm font-medium
            ${error ? "text-red-600" : "text-gray-700"}
            ${disabled ? "text-gray-400" : ""}
          `}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <select
        id={selectId}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        className={combinedStyles}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={
          error
            ? `${selectId}-error`
            : helperText
            ? `${selectId}-helper`
            : undefined
        }
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>

      {error && (
        <p
          id={`${selectId}-error`}
          className="mt-1 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}

      {helperText && !error && (
        <p id={`${selectId}-helper`} className="mt-1 text-sm text-gray-500">
          {helperText}
        </p>
      )}
    </div>
  );
};

export default Select;
