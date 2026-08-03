import { ApplicationShell1 } from "@/components/dashboard/application-shell1";
export default async function DashboardGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative min-h-screen w-full">
      <ApplicationShell1>{children}</ApplicationShell1>
    </div>
  );
}