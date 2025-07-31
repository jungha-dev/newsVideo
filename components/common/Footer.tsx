"use client";

import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-black text-white py-8 mt-16 pb-20">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Service Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Palette</h3>
            <p className="text-gray-300 text-sm">
              AI-powered image generation and blogging service
            </p>
            <p className="text-gray-400 text-xs mt-2">
              © 2024 Palette. All rights reserved.
            </p>
          </div>

          {/* Business Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Business Information</h3>
            <div className="text-gray-300 text-sm space-y-1">
              <p>
                <span className="text-gray-400">Business Registration No:</span>{" "}
                354-88-00939
              </p>
              <p>
                <span className="text-gray-400">E-commerce Registration:</span>{" "}
                서울특별시 서초구 양재대로 2길 18, 4층
              </p>
              <p>
                <span className="text-gray-400">Representative:</span>xxx
              </p>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <div className="text-gray-300 text-sm space-y-1">
              <p>02-568-9181</p>
              <p>hello@pltt.xyz</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-xs">
              This service leverages AI technology to enhance user experience.
            </p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <Link
                href="/privacy-policy"
                className="text-gray-400 hover:text-white text-xs transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms-of-service"
                className="text-gray-400 hover:text-white text-xs transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/data-deletion"
                className="text-gray-400 hover:text-white text-xs transition-colors"
              >
                Data Deletion
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
