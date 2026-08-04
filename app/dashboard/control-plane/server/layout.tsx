import { notFound } from "next/navigation";

export default function DisabledControlPlaneServerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  void children;
  notFound();
}
