import type { Metadata } from "next";
import { AboutView } from "./_components/AboutView";

export const metadata: Metadata = {
  title: "About",
};

/** Public — reachable from the guest nav, and the only help a guest has. */
export default function AboutPage() {
  return <AboutView />;
}
