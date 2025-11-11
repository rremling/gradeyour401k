// src/app/layout.tsx
import "./globals.css";
import Nav from "./components/Nav";
import { Analytics } from "@vercel/analytics/react"; // ✅ add this

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://gradeyour401k.com"),
  title: "GradeYour401k",
  description: "Get your 401k graded and optimized",
  icons: {
    icon: "/favicon.ico?v=4",
    apple: "/apple-touch-icon.png?v=4",
  },
  manifest: "/manifest.json", 
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
        <Nav />
        <main className="flex-1">{children}</main>

        {/* ───── Global Footer ───── */}
        <footer className="text-center text-xs text-gray-500 border-t border-gray-200 pt-4 pb-6 bg-white">
          <p>© GradeYour401k.com</p>
          <p className="mt-1">
            Disclosure: GradeYour401k.com is a service of Kenai Investments Inc, a Registered Investment Advisor.
            Advisory services offered through Kenai Investments Inc.
          </p>
          <p className="mt-1">
            <a
              href="https://KenaiInvest.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              KenaiInvest.com
            </a>
          </p>
        </footer>

        <Analytics /> {/* ✅ send page views & events to Vercel */}
      </body>
    </html>
  );
}
