"use client";

import React, { forwardRef, useId } from "react";

interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  type?: "text" | "email" | "password" | "number" | "url" | "tel";
  variant?: "default" | "outline" | "filled";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  error?: string;
  helperText?: string;
  required?: boolean;
  className?: string;
  name?: string;
  id?: string;
  autoComplete?: string;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      placeholder,
      value,
      onChange,
      onBlur,
      onFocus,
      type = "text",
      variant = "default",
      size = "md",
      disabled = false,
      error,
      helperText,
      required = false,
      className = "",
      name,
      id,
      autoComplete,
      maxLength,
      minLength,
      pattern,
    },
    ref
  ) => {
    const baseStyles = `
      w-full
      border
      rounded-2xl
      bg-white
      font-medium
      transition-all duration-200 ease-in-out
      focus:outline-none
      disabled:opacity-50 disabled:cursor-not-allowed
    `;

    const variantStyles = {
      default: "border-secondary focus:ring-2 focus:ring-secondary",
      outline: "border-2 border-secondary focus:ring-2 focus:ring-secondary",
      filled:
        "border-transparent bg-secondary/20 focus:bg-white focus:border-secondary focus:ring-2 focus:ring-secondary",
    };

    const sizeStyles = {
      sm: "px-3 py-2 text-sm",
      md: "px-4 py-3 text-base",
      lg: "px-6 py-4 text-lg",
    };

    const errorStyles = error
      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
      : "";

    const combinedStyles = `
      ${baseStyles}
      ${variantStyles[variant]}
      ${sizeStyles[size]}
      ${errorStyles}
      ${className}
    `;

    const uniqueId = useId();
    const inputId = id || name || `input-${uniqueId}`;

    return (
      <div className="w-full space-y-2 mb-4">
        {label && (
          <label
            htmlFor={inputId}
            className={`
              block text-sm font-medium
              ${error ? "text-red-600" : "text-gray-700"}
              ${disabled ? "text-gray-400" : ""}
            `}
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          maxLength={maxLength}
          minLength={minLength}
          pattern={pattern}
          className={combinedStyles}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
              ? `${inputId}-helper`
              : undefined
          }
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-red-600"
            role="alert"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
