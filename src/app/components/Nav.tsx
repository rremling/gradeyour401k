// src/app/components/Nav.tsx
import Link from "next/link";

export default function Nav() {
  return (
    <header className="border-b bg-white">
      <nav className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link href="/" className="text-xl font-semibold text-blue-700 hover:text-blue-900">
          GradeYour401k
        </Link>

        {/* Menu links */}
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link href="/pricing" className="hover:underline">
            Pricing
          </Link>
          <Link
            href="/grade/new"
            className="rounded-md border px-3 py-1.5 hover:bg-gray-50 transition"
          >
            Get Grade
          </Link>
        </div>
      </nav>
    </header>
  );
}
