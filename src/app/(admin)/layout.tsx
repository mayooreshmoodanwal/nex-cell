import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    const payload = await verifyAccessToken(token);
    if (!payload.roles?.includes("admin") && !payload.roles?.includes("treasurer")) {
      redirect("/dashboard?error=forbidden");
    }
    user = { id: payload.sub, email: payload.email, roles: payload.roles };
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-navy-950 flex">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <Navbar user={user} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
