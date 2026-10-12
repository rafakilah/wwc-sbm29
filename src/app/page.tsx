import { redirect } from "next/navigation";

// Proxy mengarahkan "/" ke /login, /onboarding, atau /dashboard sesuai status user.
export default function Home() {
  redirect("/dashboard");
}
