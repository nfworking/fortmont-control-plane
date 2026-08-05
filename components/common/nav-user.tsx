"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import SettingsDialog from "@/components/account/account"; // Adjust path to your component
import router from "next/dist/shared/lib/router/router";
import { redirect } from "next/dist/client/components/navigation";

type NavUserProps = {
  user?: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  } | null;
};

export function NavUser({ user }: NavUserProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("profile-avatar-url");
  });
  const { data } = authClient.useSession();

  useEffect(() => {
    const handler = (event: Event) => {
      const avatarEvent = event as CustomEvent<{ imageUrl?: string }>;
      if (avatarEvent.detail?.imageUrl) {
        window.localStorage.setItem(
          "profile-avatar-url",
          avatarEvent.detail.imageUrl,
        );
        setAvatarOverride(avatarEvent.detail.imageUrl);
      }
    };

    window.addEventListener("profile-avatar-updated", handler);
    return () => window.removeEventListener("profile-avatar-updated", handler);
  }, []);

  const effectiveUser = {
    name: data?.user?.name ?? user?.name ?? "Guest",
    email: data?.user?.email ?? user?.email ?? "user@example.com",
    avatar: data?.user?.image ?? "",
  };

  const initials = (effectiveUser.name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="relative flex items-center gap-2 rounded-full outline-none ring-offset-background transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Open user menu"
          >
            <Avatar className="h-8 w-8 rounded-full">
              <AvatarImage
                src={effectiveUser.avatar ?? undefined}
                alt={effectiveUser.name ?? ""}
              />
              <AvatarFallback className="rounded-full text-xs font-medium">
                {initials || "U"}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm font-medium leading-tight">
              {effectiveUser.name}
            </p>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="w-56 rounded-xl border dark:bg-black/90 backdrop-blur-sm bg-white border-zinc-800 shadow-lg text-white"
          align="end"
          sideOffset={8}
        >
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-3 px-3 py-3">
              <Avatar className="h-9 w-9 rounded-full">
                <AvatarImage
                  src={effectiveUser.avatar ?? undefined}
                  alt={effectiveUser.name ?? ""}
                />
                <AvatarFallback className="rounded-full text-xs font-medium">
                  {initials || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="truncate text-sm font-medium leading-tight text-white">
                  {effectiveUser.name}
                </span>
                <span className="truncate text-xs leading-tight text-zinc-400">
                  {effectiveUser.email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="bg-zinc-800" />

          {/* Replaced Link with onClick handler to trigger the SettingsDialog */}
          <DropdownMenuItem
            onClick={() => setIsSettingsOpen(true)}
            className="gap-2 rounded-lg mx-1 cursor-pointer hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white"
          >
            <User className="size-4 text-zinc-400" />
            Account
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-zinc-800" />

          <DropdownMenuItem
            onClick={() =>
              authClient.signOut?.({
                fetchOptions: {
                  onSuccess: () => {
                    redirect("/login"); // redirect to login page
                  },
                },
              })
            }
            className="gap-2 rounded-lg mx-1 mb-1 cursor-pointer text-red-400 focus:text-red-400 focus:bg-zinc-900"
          >
            <LogOut className="size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Render the modal outside the dropdown tree to prevent layout conflicts */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
