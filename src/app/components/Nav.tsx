// src/app/components/Nav.tsx
"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b bg-white">
      <nav className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-semibold text-blue-700 hover:text-blue-900"
        >
          GradeYour401k
        </Link>

        {/* Desktop Menu */}
        <div className="hidden sm:flex items-center gap-4 text-sm font-medium">
          <Link href="/pricing" className="hover:underline">
            Pricing
          </Link>
          <Link
            href="/grade/new"
            className="rounded-md border px-3 py-1.5 hover:bg-gray-50 transition"
          >
            Get Grade
          </Link>
          <Link
            href="/account"
            className="rounded-md bg-blue-600 text-white px-3 py-1.5 hover:bg-blue-700 transition"
          >
            Login
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setOpen(!open)}
          className="sm:hidden p-2 rounded-md hover:bg-gray-100"
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile Dropdown */}
      {open && (
        <div className="sm:hidden border-t bg-white shadow-md">
          <div className="flex flex-col items-start px-4 py-2 space-y-2 text-sm font-medium">
            <Link href="/pricing" className="hover:underline w-full">
              Pricing
            </Link>
            <Link
              href="/grade/new"
              className="rounded-md border px-3 py-1.5 hover:bg-gray-50 transition w-full text-center"
            >
              Get Grade
            </Link>
            <Link
              href="/account"
              className="rounded-md bg-blue-600 text-white px-3 py-1.5 hover:bg-blue-700 transition w-full text-center"
            >
              Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
