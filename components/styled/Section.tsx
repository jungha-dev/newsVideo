"use client";

import React from "react";

interface SectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "outlined" | "plain" | "underline";
  titleSize?: "sm" | "md" | "lg";
}

const Section: React.FC<SectionProps> = ({
  title,
  children,
  className = "",
  variant = "plain",
  titleSize = "md",
}) => {
  const baseStyles = `
    mb-12
  `;

  const variantStyles = {
    outlined: `
      border border-secondary rounded-xl p-4 py-8
    `,
    plain: `
      py-8
    `,
    underline: `
      border-b border-secondary pb-12
    `,
  };

  const titleStyles = {
    sm: "text-lg font-semibold mb-4",
    md: "text-xl font-semibold mb-6",
    lg: "text-2xl font-bold mb-8",
  };

  const underlineStyles = "border-b border-gray-300 pb-2";

  const combinedStyles = `
    ${baseStyles}
    ${variantStyles[variant]}
    ${className}
  `;

  return (
    <section className={combinedStyles}>
      {title && (
        <h2
          className={`${titleStyles[titleSize]} ${
            variant === "underline" ? underlineStyles : ""
          }`}
        >
          {title}
        </h2>
      )}
      {children}
    </section>
  );
};

export default Section;
