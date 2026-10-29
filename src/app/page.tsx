import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";

export default async function HomePage() {
  const current = await getCurrentSession();
  if (current) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}

