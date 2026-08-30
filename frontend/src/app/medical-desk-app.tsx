"use client";

import dynamic from "next/dynamic";
import { installSecureFetch } from "@/lib/secureFetch";

installSecureFetch();

const App = dynamic(() => import("@/App"), { ssr: false });

export default function MedicalDeskApp() {
  return <App />;
}
