"use client";

import React from "react";
import { Button, Textarea } from "@/components/styled";

interface PromptInputProps {
  title: string;
  panels: {
    label: string;
    value: string;
    placeholder: string;
    onChange: (value: string) => void;
  }[];
  onReset: () => void;
  maxPanels: number;
}

export default function PromptInput({
  title,
  panels,
  onReset,
  maxPanels,
}: PromptInputProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">{title}</h3>
        <Button variant="secondary" size="sm" onClick={onReset}>
          초기화
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        {panels.slice(0, maxPanels).map((panel, index) => (
          <div key={index}>
            <Textarea
              label={panel.label}
              placeholder={panel.placeholder}
              value={panel.value}
              onChange={(e) => panel.onChange(e.target.value)}
              rows={3}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
