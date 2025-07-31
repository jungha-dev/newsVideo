"use client";

import React from "react";

const BackgroundCircles: React.FC = () => {
  return (
    <svg
      width="828"
      height="652"
      viewBox="0 0 828 652"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 mx-auto w-[900px] h-[600px] z-[-1]"
    >
      <g opacity="0.15" filter="url(#filter0_f_11818_591)">
        <circle cx="274.96" cy="377.04" r="168.96" fill="#A454FF" />
      </g>
      <g opacity="0.15" filter="url(#filter1_f_11818_591)">
        <circle cx="414" cy="274.96" r="168.96" fill="#546AFF" />
      </g>
      <g opacity="0.15" filter="url(#filter2_f_11818_591)">
        <circle cx="553.04" cy="377.04" r="168.96" fill="#54FFDA" />
      </g>
      <defs>
        <filter
          id="filter0_f_11818_591"
          x="0.400002"
          y="102.48"
          width="549.12"
          height="549.12"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          />
          <feGaussianBlur
            stdDeviation="52.8"
            result="effect1_foregroundBlur_11818_591"
          />
        </filter>
        <filter
          id="filter1_f_11818_591"
          x="139.44"
          y="0.400002"
          width="549.12"
          height="549.12"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          />
          <feGaussianBlur
            stdDeviation="52.8"
            result="effect1_foregroundBlur_11818_591"
          />
        </filter>
        <filter
          id="filter2_f_11818_591"
          x="278.48"
          y="102.48"
          width="549.12"
          height="549.12"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          />
          <feGaussianBlur
            stdDeviation="52.8"
            result="effect1_foregroundBlur_11818_591"
          />
        </filter>
      </defs>
    </svg>
  );
};

export default BackgroundCircles;
