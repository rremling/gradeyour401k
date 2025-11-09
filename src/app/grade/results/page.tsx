// src/app/grade/results/page.tsx
import dynamic from "next/dynamic";

// Import the client UI without SSR so nothing server-side needs to serialize
const ResultsClient = dynamic(() => import("./ResultsClient"), { ssr: false });

export default function Page() {
  // Do NOT accept or pass searchParams/params here
  return <ResultsClient />;
}
