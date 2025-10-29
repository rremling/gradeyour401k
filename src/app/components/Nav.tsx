// src/app/components/Nav.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function Nav() {
  const [open, setOpen] = useState(false);

  // Close on ESC and lock body scroll when menu is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    if (open) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("overflow-hidden");
    };
  }, [open]);

  return (
    <header className="border-b bg-white">
      <nav className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        {/* Brand / Logo */}
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
          onClick={() => setOpen((v) => !v)}
          className="sm:hidden p-2 rounded-md hover:bg-gray-100"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile Overlay + Dropdown (premium animation + blur) */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            className="fixed inset-0 z-50 sm:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            {/* Panel */}
            <motion.div
              key="panel"
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -16, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute top-0 inset-x-0"
            >
              <div
                id="mobile-menu"
                className="mx-3 mt-2 rounded-2xl border bg-white shadow-xl overflow-hidden"
              >
                {/* Header row inside panel */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <Link
                    href="/"
                    onClick={() => setOpen(false)}
                    className="text-lg font-semibold text-blue-700 hover:text-blue-900"
                  >
                    GradeYour401k
                  </Link>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 rounded-md hover:bg-gray-100"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-stretch px-4 py-3 space-y-2 text-sm font-medium">
                  <Link
                    href="/pricing"
                    onClick={() => setOpen(false)}
                    className="w-full text-center rounded-md border px-3 py-2 hover:bg-gray-50 transition"
                  >
                    Pricing
                  </Link>

                  <Link
                    href="/grade/new"
                    onClick={() => setOpen(false)}
                    className="w-full text-center rounded-md border px-3 py-2 hover:bg-gray-50 transition"
                  >
                    Get Grade
                  </Link>

                  <Link
                    href="/account"
                    onClick={() => setOpen(false)}
                    className="w-full text-center rounded-md bg-blue-600 text-white px-3 py-2 hover:bg-blue-700 transition"
                  >
                    Login
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
