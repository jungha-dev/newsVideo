import "./globals.css";
import Header from "@/components/common/Header";
import Footer from "@/components/common/Footer";
import { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import FacebookSDK from "../components/FacebookSDK";

export const metadata = {
  title: "팔레트(Palette)",
  description: "콘텐츠 제작 플랫폼",
  keywords: ["AI 영상", "콘텐츠 자동화", "블로그", "Blog", "Palette"],
  authors: [{ name: "Palette" }],
  openGraph: {
    title: "팔레트(Palette)",
    description: "콘텐츠 실험실 - lab.palette.com",
    url: "https://lab.palette.com",
    siteName: "팔레트(Palette)",
    images: [
      {
        url: "https://lab.palette.com/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "팔레트(Palette)",
    description: "AI로 만드는 콘텐츠 실험실 - palette.com",
    images: ["https://lab.palette.com/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-white text-gray-900">
        <AuthProvider>
          <FacebookSDK />
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
