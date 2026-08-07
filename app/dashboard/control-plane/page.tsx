"use client"

import { motion } from "framer-motion"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ActiveAgentsPanel } from "@/components/dashboard/active-agents-panel"
import { TotalUsersChart } from "@/components/dashboard/total-users-chart"
import { IntegrationsPanel } from "@/components/dashboard/integrations-panel"
import { AnnouncementsPanel } from "@/components/dashboard/announcements-panel"
import { AiUsageOverview } from "@/components/dashboard/ai-usage-overview"
import { InsightsPanel } from "@/components/dashboard/insights-panel"

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-6 md:py-6"
      >
        <DashboardHeader />

        {/* Top row */}
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <ActiveAgentsPanel />
          </div>
          <div className="lg:col-span-5">
            <TotalUsersChart />
          </div>
          <div className="lg:col-span-4">
            <IntegrationsPanel />
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <AnnouncementsPanel />
          </div>
          <div className="lg:col-span-3">
            <AiUsageOverview />
          </div>
          <div className="lg:col-span-4">
            <InsightsPanel />
          </div>
        </div>
      </motion.div>
    </main>
  )
}