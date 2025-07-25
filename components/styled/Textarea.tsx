"use client";

import React, { forwardRef } from "react";

interface TextareaProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  variant?: "default" | "outline" | "filled";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  error?: string;
  helperText?: string;
  required?: boolean;
  className?: string;
  name?: string;
  id?: string;
  rows?: number;
  maxLength?: number;
  minLength?: number;
  resize?: "none" | "vertical" | "horizontal" | "both";
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      placeholder,
      value,
      onChange,
      onBlur,
      onFocus,
      variant = "default",
      size = "md",
      disabled = false,
      error,
      helperText,
      required = false,
      className = "",
      name,
      id,
      rows = 3,
      maxLength,
      minLength,
      resize = "vertical",
    },
    ref
  ) => {
    const baseStyles = `
      w-full
      border
      rounded-2xl
      transition-all duration-200 ease-in-out
      focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent
      disabled:opacity-50 disabled:cursor-not-allowed
      placeholder-gray-400
      resize-${resize}
    `;

    const variantStyles = {
      default: `
        border border-secondary bg-white
        focus:ring-secondary
        hover:border-secondary-dark
      `,
      outline: `
        border-2 border-secondary bg-transparent
        focus:ring-secondary
        hover:border-secondary-dark
      `,
      filled: `
        border-transparent bg-secondary/20
        focus:bg-white focus:border-secondary focus:ring-secondary
        hover:bg-secondary/30
      `,
    };

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
      : "";

    const combinedStyles = `
      ${baseStyles}
      ${variantStyles[variant]}
      ${sizeStyles[size]}
      ${errorStyles}
      ${className}
    `;

    const textareaId =
      id || name || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="w-full mb-4">
        {label && (
          <label
            htmlFor={textareaId}
            className={`
              block text-sm font-medium mb-2
              ${error ? "text-red-600" : "text-gray-700"}
              ${disabled ? "text-gray-400" : ""}
            `}
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          rows={rows}
          maxLength={maxLength}
          minLength={minLength}
          className={combinedStyles}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={
            error
              ? `${textareaId}-error`
              : helperText
              ? `${textareaId}-helper`
              : undefined
          }
        />

        {error && (
          <p
            id={`${textareaId}-error`}
            className="mt-1 text-sm text-red-600"
            role="alert"
          >
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={`${textareaId}-helper`} className="mt-1 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export default Textarea;
