import { ApplicationShell1 } from "@/components/dashboard/application-shell1";
import { getActiveOrganization, getOrganizations } from "@/server/orgs";
import { getCurrentUser } from "@/server/users";
import { redirect } from "next/navigation";

export default async function DashboardGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user.currentUser.onboarded) {
    redirect("/onboarding");
  }

  const organizations = await getOrganizations();
  const activeOrganization = await getActiveOrganization(user.currentUser.id);

  return (
    <div className="relative min-h-screen w-full">
      <ApplicationShell1
        user={user.currentUser}
        organizations={organizations}
        activeOrganization={activeOrganization}
      >
        {children}
      </ApplicationShell1>
    </div>
  );
}