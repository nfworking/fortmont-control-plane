"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { LoginForm } from "@/components/ui/login-form"
import { HugeiconsIcon } from "@hugeicons/react"
import { DashboardSquare03Icon } from "@hugeicons/core-free-icons"
import {GridBackground} from "@/components/ui/grid-bg"
import { toast } from "sonner"

export default function LoginPage() {
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? undefined
  const verificationEmailSent = searchParams.get("verificationEmailSent") === "1"
  const emailVerified = searchParams.get("emailVerified") === "1"

  useEffect(() => {
    if (verificationEmailSent) {
      toast.info("Check your inbox to verify your email before signing in.")
    }
  }, [verificationEmailSent])

  useEffect(() => {
    if (emailVerified) {
      toast.success("Email verified successfully. You can now sign in.")
    }
  }, [emailVerified])

  return (
    <GridBackground>
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-cover bg-center p-6 md:p-10" >
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HugeiconsIcon icon={DashboardSquare03Icon} strokeWidth={2} className="size-4" />
          </div>
          Fortmont Control 
        </a>
        <LoginForm redirectTo={next} />
      </div>
    </div>
    </GridBackground>
  )
}
