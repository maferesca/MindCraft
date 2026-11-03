import { redirect } from "next/navigation";

// The proxy sends signed-in visitors to /workspace; everyone else signs in.
export default function HomePage() {
  redirect("/sign-in");
}
