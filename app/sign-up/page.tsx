"use client"

import { useSearchParams } from "next/navigation"
import { SignUpForm } from "@/components/ui/signup-form"
import { HugeiconsIcon } from "@hugeicons/react"
import { LayoutBottomIcon } from "@hugeicons/core-free-icons"
import {GridBackground} from "@/components/ui/grid-bg"

export default function SignUpPage() {
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? undefined

  return (
    <GridBackground>
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-cover bg-center p-6 md:p-10" >
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="/sign-up" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HugeiconsIcon icon={LayoutBottomIcon} strokeWidth={2} className="size-4" />
          </div>
          Fortmont Control Plane
        </a>
        <SignUpForm redirectTo={next} />
      </div>
    </div>
    </GridBackground>
  )
}
