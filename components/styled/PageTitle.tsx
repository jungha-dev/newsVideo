"use client";

import React from "react";

interface PageTitleProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  variant?: "default" | "centered" | "minimal";
}

const PageTitle: React.FC<PageTitleProps> = ({
  title,
  subtitle,
  children,
  className = "",
  variant = "default",
}) => {
  const baseStyles = `
    flex justify-between items-center
    w-full
  `;

  const variantStyles = {
    default: `
      mb-6
    `,
    centered: `
      flex-col text-center mb-8
    `,
    minimal: `
      mb-4
    `,
  };

  const titleStyles = {
    default: "text-3xl font-bold mb-2",
    centered: "text-3xl font-bold mb-2",
    minimal: "text-2xl font-bold mb-1",
  };

  const subtitleStyles = {
    default: "text-gray-600",
    centered: "text-gray-600 max-w-2xl mx-auto",
    minimal: "text-gray-500 text-sm",
  };

  const combinedStyles = `
    ${baseStyles}
    ${variantStyles[variant]}
    ${className}
  `;

  return (
    <div className={combinedStyles}>
      <div>
        <h1 className={titleStyles[variant]}>{title}</h1>
        {subtitle && <p className={subtitleStyles[variant]}>{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-4">{children}</div>}
    </div>
  );
};

export default PageTitle;
