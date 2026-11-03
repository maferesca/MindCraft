import type { Metadata } from "next";
import { OnboardingScreen } from "@/components/onboarding/onboarding-screen";

export const metadata: Metadata = { title: "Set up your space" };

export default function WelcomePage() {
  return <OnboardingScreen />;
}
