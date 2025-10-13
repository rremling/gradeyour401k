i// src/app/admin/login/page.tsx
import { Suspense } from "react";
import AdminLoginClient from "./AdminLoginClient";

export default function Page() {
  return (
    <Suspense>
      <AdminLoginClient />
    </Suspense>
  );
}
