import { DynamicOnboardingFlow } from "@/components/onboarding-02";
import { getCurrentUser } from "@/server/users";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (user.currentUser.onboarded) {
    redirect("/dashboard/control-plane");
  }

  return (
       
    
      <DynamicOnboardingFlow />

  );
}