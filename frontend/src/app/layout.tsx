import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { LanguageProvider } from "@/providers/language-provider";
import { PreferencesProvider } from "@/providers/preferences-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "myDevices - Apple 设备管理系统",
  description: "企业级 Apple 设备管理与 MDM 解决方案",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <LanguageProvider>
            <PreferencesProvider>
              {children}
            </PreferencesProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
