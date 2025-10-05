// src/app/layout.tsx
import "./globals.css";
import Nav from "./components/Nav";

export const metadata = {
  title: "GradeYour401k",
  description: "Get your 401k graded and optimized",
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
      </body>
    </html>
  );
}
