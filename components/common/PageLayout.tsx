import React from "react";
import { PageTitle } from "@/components/styled";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  showPageTitle?: boolean;
}

const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title,
  subtitle,
  className = "",
  showPageTitle = true,
}) => {
  return (
    <div className={`p-4 py-8 max-w-[1536px] mx-auto space-y-6 ${className}`}>
      {showPageTitle && title && (
        <PageTitle title={title} subtitle={subtitle} />
      )}
      {children}
    </div>
  );
};

export default PageLayout;
