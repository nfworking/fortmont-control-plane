"use client"


import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, User } from "lucide-react"
import { authClient} from "@/lib/auth-client"
type NavUserProps = {
  user?: {
    name?: string | null
    email?: string | null
    avatar?: string | null
  } | null
}


export function NavUser({ user }: NavUserProps) {
  const { data, isPending } = authClient.useSession();

  const effectiveUser = {
    name: data?.user?.name ?? "Guest",
    email: data?.user?.email ?? "user@example.com",
    avatar:  "",
  }

  // const effectiveUser = {
  //   name: user?.name ?? "Dashboard User",
  //   email: user?.email ?? "user@example.com",
  //   avatar: user?.avatar ?? "",
  // }
  const initials = (effectiveUser.name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
  

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
        className="w-56 rounded-xl border dark:bg-background/80 backdrop-blur-sm bg-white border-border/50 shadow-lg"
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
              <span className="truncate text-sm font-medium leading-tight dark:text-white text-black">
                {effectiveUser.name}
              </span>
              <span className="truncate text-xs leading-tight dark:text-white text-black">
                {effectiveUser.email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          asChild
          className="gap-2 rounded-lg mx-1 cursor-pointer"
        >
          <Link href="/account">
            <User className="size-4 text-muted-foreground" />
            Account
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          asChild
          className="gap-2 rounded-lg mx-1 mb-1 cursor-pointer text-destructive focus:text-destructive"
        >
          <Link href="/login">
            <LogOut className="size-4" />
            Log out
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}