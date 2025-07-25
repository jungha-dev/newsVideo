"use client";

import React, { useId } from "react";

interface RangeProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
  showValue?: boolean;
  valueLabel?: string;
  helperText?: string;
}

const Range: React.FC<RangeProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  disabled = false,
  className = "",
  showValue = false,
  valueLabel,
  helperText,
}) => {
  const baseStyles = `
    w-full
    h-2
    bg-secondary
    rounded-lg
    appearance-none
    cursor-pointer
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2
  `;

  // Webkit (Chrome, Safari, Edge) 스타일
  const webkitStyles = `
    [&::-webkit-slider-thumb]:appearance-none
    [&::-webkit-slider-thumb]:w-5
    [&::-webkit-slider-thumb]:h-5
    [&::-webkit-slider-thumb]:bg-primary
    [&::-webkit-slider-thumb]:rounded-full
    [&::-webkit-slider-thumb]:cursor-pointer
    [&::-webkit-slider-thumb]:border-2
    [&::-webkit-slider-thumb]:border-white
    [&::-webkit-slider-thumb]:
    [&::-webkit-slider-thumb]:hover:bg-primary-dark
    [&::-webkit-slider-thumb]:transition-colors
    [&::-webkit-slider-track]:bg-secondary
    [&::-webkit-slider-track]:rounded-lg
    [&::-webkit-slider-track]:h-2
  `;

  // Firefox 스타일
  const firefoxStyles = `
    [&::-moz-range-thumb]:appearance-none
    [&::-moz-range-thumb]:w-5
    [&::-moz-range-thumb]:h-5
    [&::-moz-range-thumb]:bg-primary
    [&::-moz-range-thumb]:rounded-full
    [&::-moz-range-thumb]:cursor-pointer
    [&::-moz-range-thumb]:border-2
    [&::-moz-range-thumb]:border-white
    [&::-moz-range-thumb]:
    [&::-moz-range-thumb]:hover:bg-primary-dark
    [&::-moz-range-thumb]:transition-colors
    [&::-moz-range-track]:bg-secondary
    [&::-moz-range-track]:rounded-lg
    [&::-moz-range-track]:h-2
  `;

  const combinedStyles = `
    ${baseStyles}
    ${webkitStyles}
    ${firefoxStyles}
    ${className}
  `;

  const uniqueId = useId();
  const rangeId = `range-${uniqueId}`;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={rangeId}
          className={`
            block mb-2 text-sm font-medium
            ${disabled ? "text-gray-400" : "text-gray-700"}
          `}
        >
          {label}
        </label>
      )}

      <div className="flex items-center gap-4">
        <input
          id={rangeId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          disabled={disabled}
          className={combinedStyles}
        />

        {showValue && (
          <div className="flex-shrink-0">
            <span className="text-sm font-medium text-gray-700">
              {valueLabel || value}
            </span>
          </div>
        )}
      </div>

      {helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
    </div>
  );
};

export default Range;
