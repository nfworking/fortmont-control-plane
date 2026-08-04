"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Server, LogOut, ArrowRight, ShieldCheck } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

// Update this with your actual Control Plane URL
const CONTROL_PLANE_URL = "/dashboard/control-plane"; 

export default function Homepage() {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success("Signed out successfully");
          router.push("/login");
        },
      },
    });
  };

  const handleRedirectToControlPlane = () => {
    window.location.href = CONTROL_PLANE_URL;
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-black text-white p-6 overflow-hidden">
      {/* Sleek Ambient Lighting & Subtle Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#121212_1px,transparent_1px),linear-gradient(to_bottom,#121212_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-80" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-zinc-800/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-8 shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition-all">
        
        {/* Status Indicator Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-400 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Fortmont Cloud API Engine
          </div>
        </div>

        {/* Title & Core Description */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-black/60 text-zinc-100 shadow-inner">
            <Server className="h-5 w-5 text-zinc-300" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Fortmont Cloud API
          </h1>

          <p className="text-sm text-zinc-400 leading-relaxed">
            This endpoint functions purely as an API server. To access management tools, view metrics, or manage projects, proceed to the Control Plane.
          </p>
        </div>

        {/* User Session Info */}
        {isPending ? (
          <div className="mt-6 rounded-lg border border-zinc-800/60 bg-black/40 p-3 text-center text-xs text-zinc-400">
            Loading...
          </div>
        ) : data?.user ? (
          <div className="mt-6 rounded-lg border border-zinc-800/60 bg-black/40 p-3 text-center text-xs text-zinc-400">
            Authenticated as <span className="font-medium text-zinc-200">{data.user.email}</span>
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Securely authenticated with Fortmont Cloud</span>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          <Button
            onClick={handleRedirectToControlPlane}
            className="w-full bg-white text-black hover:bg-zinc-200 font-medium transition-all shadow-[0_0_20px_-3px_rgba(255,255,255,0.2)] group"
            size="lg"
          >
            Open Control Plane
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>

          <Button
            onClick={handleSignOut}
            variant="ghost"
            className="w-full text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/50"
            size="sm"
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 text-center text-xs text-zinc-600 tracking-wider">
        FORTMONT CLOUD INFRASTRUCTURE &bull; API HOST
      </footer>
    </main>
  );
}