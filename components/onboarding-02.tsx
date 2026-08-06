'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconFileText,
  IconUser,
  IconShieldLock,
  IconBuilding,
  IconPlug,
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
  IconPlus,
  IconX,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { markCurrentUserOnboarded } from '@/server/users';

interface StepConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  isRequired: boolean;
}

const STEPS: StepConfig[] = [
  {
    id: 'terms',
    title: 'Terms & Conditions',
    description: 'Please review and accept our terms to continue using the platform.',
    icon: IconFileText,
    isRequired: true,
  },
  {
    id: 'profile',
    title: 'Profile Information',
    description: 'Set up your personal details to personalize your experience.',
    icon: IconUser,
    isRequired: true,
  },
  {
    id: 'mfa',
    title: 'MFA Setup',
    description: 'Secure your account with two-factor authentication.',
    icon: IconShieldLock,
    isRequired: true,
  },
  {
    id: 'org',
    title: 'Organization Details',
    description: 'Join an existing workspace or create a new one for your team.',
    icon: IconBuilding,
    isRequired: true,
  },
  {
    id: 'plugins',
    title: 'Browse Plugins',
    description: 'Enhance your workflow by discovering integrations (Optional).',
    icon: IconPlug,
    isRequired: false,
  },
];

export function DynamicOnboardingFlow() {
  const { data: session } = authClient.useSession();
  const [currentStep, setCurrentStep] = useState(0);
  const [orgMode, setOrgMode] = useState<'create' | 'join'>('create');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isOrgSubmitting, setIsOrgSubmitting] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgJoinToken, setOrgJoinToken] = useState('');

  const userWithTwoFactor = session?.user as { twoFactorEnabled?: boolean } | undefined;
  const isTwoFactorEnabled = Boolean(userWithTwoFactor?.twoFactorEnabled);

  const step = STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;

  const extractJoinToken = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';

    if (trimmed.includes('/join/')) {
      const segment = trimmed.split('/join/').pop() ?? '';
      return segment.split('?')[0]?.replace(/\/+$/, '') ?? '';
    }

    return trimmed;
  };

  const handleOrganizationStep = async () => {
    setOrgError(null);
    setIsOrgSubmitting(true);

    try {
      if (orgMode === 'create') {
        const normalizedName = orgName.trim();
        const normalizedSlug = orgSlug.trim().toLowerCase();

        if (!normalizedName || !normalizedSlug) {
          setOrgError('Organization name and slug are required.');
          return false;
        }

        await authClient.organization.create({
          name: normalizedName,
          slug: normalizedSlug,
        });

        return true;
      }

      const token = extractJoinToken(orgJoinToken);
      if (!token) {
        setOrgError('Provide a valid join link or token.');
        return false;
      }

      const response = await fetch(`/api/v2/join/${encodeURIComponent(token)}/request`, {
        method: 'POST',
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to submit organization join request.');
      }

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Organization step failed.';
      setOrgError(message);
      return false;
    } finally {
      setIsOrgSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (step.id === 'mfa' && !isTwoFactorEnabled) {
      setMfaError('Set up and verify 2FA before continuing.');
      return;
    }

    if (step.id === 'mfa') {
      setMfaError(null);
    }

    if (step.id === 'org') {
      const orgStepOk = await handleOrganizationStep();
      if (!orgStepOk) return;
    }

    if (!isLastStep) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    setIsCompleting(true);
    try {
      await markCurrentUserOnboarded();
      window.location.href = '/dashboard/control-plane';
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      setIsCompleting(false);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) setCurrentStep((prev) => prev - 1);
  };

  const handleDeclineTerms = async () => {
    setIsLoggingOut(true);
    try {
      await authClient.signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to sign out:', error);
      setIsLoggingOut(false);
    }
  };

  const handleAcceptTerms = () => {
    void handleNext();
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      {/* Container resized to max-w-2xl and p-8 for a roomier feel */}
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border bg-card p-8 shadow-md"
      >
        {/* Step Indicator Header */}
        <div className="mb-6 flex items-center justify-between border-b pb-5">
          <div className="flex items-center gap-2">
            {STEPS.map((s, idx) => {
              const isActive = idx === currentStep;
              const isCompleted = idx < currentStep;

              return (
                <div key={s.id} className="flex items-center">
                  <div
                    className={cn(
                      'flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                      isCompleted && 'bg-emerald-500 text-white',
                      isActive && 'bg-primary text-primary-foreground',
                      !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isCompleted ? <IconCheck className="size-4" /> : idx + 1}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'mx-2 h-0.5 w-6 transition-colors md:w-8',
                        idx < currentStep ? 'bg-emerald-500' : 'bg-muted'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Step {currentStep + 1} of {STEPS.length}
          </span>
        </div>

        {/* Dynamic Content Frame */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Step Header */}
            <div>
              <div className="flex items-center gap-2.5">
                <step.icon className="size-6 text-primary" />
                <h3 className="font-semibold text-foreground text-xl">
                  {step.title}
                </h3>
                {!step.isRequired && (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Optional
                  </span>
                )}
              </div>
              <p className="mt-1 text-muted-foreground text-sm">
                {step.description}
              </p>
            </div>

            {/* Step 0: Terms & Conditions */}
            {step.id === 'terms' && (
              <div className="space-y-4 pt-1">
                <div className="h-64 overflow-y-auto rounded-lg border bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground space-y-3">
                  <p className="font-medium text-foreground">Last Updated: August 2026</p>
                  <p>
                    # Terms & Conditions

**Last Updated:** August 7, 2026

Welcome to **Fortmont Control Plane** ("Fortmont", "we", "our", or "us"). By accessing or using Fortmont Control Plane, you agree to these Terms & Conditions. If you do not agree with these terms, please do not use the platform.

## 1. Use of the Service

Fortmont Control Plane provides a hosted platform for managing infrastructure, agents, organizations, and related services. You agree to use the platform only for lawful purposes and in accordance with these Terms.

You are responsible for ensuring that your use of the platform complies with all applicable laws, regulations, and organizational policies.

## 2. Account Responsibility

You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.

You agree to:

* Provide accurate and up-to-date account information.
* Keep your password and authentication methods secure.
* Notify us promptly if you believe your account has been compromised.

## 3. Organizations and Access

Organization owners are responsible for managing users, permissions, and access within their organization.

Users must only access resources they have been authorized to use. Attempting to bypass permissions, access another organization's data, or interfere with the operation of the platform is strictly prohibited.

## 4. Acceptable Use

You agree not to:

* Use the platform for unlawful or fraudulent activities.
* Attempt to gain unauthorized access to Fortmont or any connected systems.
* Distribute malware, malicious code, or harmful content.
* Disrupt or interfere with the availability or security of the platform.
* Reverse engineer or exploit vulnerabilities within the service.

## 5. Customer Data

You retain ownership of the data you upload or generate through Fortmont.

By using the service, you grant Fortmont permission to process, store, and transmit your data solely for the purpose of providing and improving the service.

We take reasonable measures to protect customer data but cannot guarantee absolute security.

## 6. Infrastructure Connections

Fortmont may connect to third-party infrastructure, including virtualization platforms, cloud services, and other supported systems.

You are responsible for ensuring you have the authority to connect Fortmont to those systems and for maintaining appropriate credentials and permissions.

## 7. Service Availability

While we aim to provide a reliable service, Fortmont is provided on an "as available" basis.

Maintenance, updates, unexpected outages, or circumstances beyond our control may temporarily affect service availability.

## 8. Security

We implement reasonable security measures to protect the platform and customer information. However, no internet-based service can guarantee complete security.

Users are encouraged to enable multi-factor authentication where available and follow security best practices.

## 9. Third-Party Services

Fortmont may integrate with third-party services, APIs, or infrastructure providers.

We are not responsible for the availability, security, or functionality of third-party services.

## 10. Intellectual Property

Fortmont Control Plane, including its software, branding, documentation, and associated materials, remains the property of Fortmont unless otherwise stated.

These Terms do not grant ownership or intellectual property rights to users.

## 11. Limitation of Liability

To the maximum extent permitted by law, Fortmont shall not be liable for indirect, incidental, consequential, or special damages arising from the use or inability to use the platform.

Users remain responsible for maintaining appropriate backups of important data and configurations.

## 12. Termination

We reserve the right to suspend or terminate accounts that violate these Terms, compromise platform security, or misuse the service.

Users may stop using the platform at any time.

## 13. Changes to These Terms

We may update these Terms & Conditions from time to time. Material changes will be communicated through the platform or by other reasonable means.

Continued use of Fortmont after updated Terms become effective constitutes acceptance of the revised Terms.

## 14. Contact

If you have any questions regarding these Terms & Conditions, please contact the Fortmont team using the support options available within the platform or through our official website.

                  </p>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    color="destructive"
                    onClick={handleDeclineTerms}
                    disabled={isLoggingOut}
                    size="sm"
                    className="gap-1.5 text-red-600 hover:text-red-700"
                  >
                    <IconX className="size-4" />
                    {isLoggingOut ? 'Signing out...' : 'Decline & Logout'}
                  </Button>
                  <Button onClick={handleAcceptTerms} size="sm" className="gap-1.5">
                    <IconCheck className="size-4" />
                    Accept Terms
                  </Button>
                </div>
              </div>
            )}

            {/* Step 1: Profile Information */}
            {step.id === 'profile' && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input id="first-name" placeholder="John" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input id="last-name" placeholder="Doe" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Work Email</Label>
                  <Input id="email" type="email" placeholder="john@company.com" />
                </div>
              </div>
            )}

            {/* Step 2: MFA Setup */}
            {step.id === 'mfa' && (
              <div className="space-y-4 pt-2">
                <div className="rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
                  Use an authenticator app like 1Password, Authy, or Google Authenticator.
                  This onboarding step requires 2FA before you can continue.
                </div>
                <div className="rounded-lg border bg-card/50 p-4">
                  <p className="text-sm font-medium">
                    {isTwoFactorEnabled
                      ? 'Two-factor authentication is enabled.'
                      : 'Two-factor authentication is not enabled yet.'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Open setup to generate your QR code and verify the first code.
                  </p>
                  <Button
                    type="button"
                    className="mt-3"
                    onClick={() => {
                      window.location.href = '/two-factor/setup?next=%2Fonboarding';
                    }}
                  >
                    {isTwoFactorEnabled ? 'Manage 2FA' : 'Set up 2FA'}
                  </Button>
                </div>

                {mfaError ? <p className="text-xs text-red-500">{mfaError}</p> : null}
              </div>
            )}

            {/* Step 3: Organization Setup */}
            {step.id === 'org' && (
              <div className="space-y-5 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={orgMode === 'create' ? 'default' : 'outline'}
                    onClick={() => setOrgMode('create')}
                    className="w-full justify-start gap-2 h-11"
                  >
                    <IconPlus className="size-4" />
                    Create Organization
                  </Button>
                  <Button
                    type="button"
                    variant={orgMode === 'join' ? 'default' : 'outline'}
                    onClick={() => setOrgMode('join')}
                    className="w-full justify-start gap-2 h-11"
                  >
                    <IconBuilding className="size-4" />
                    Join Existing
                  </Button>
                </div>

                {orgMode === 'create' ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input
                        id="org-name"
                        placeholder="Acme Inc."
                        value={orgName}
                        onChange={(event) => setOrgName(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="org-slug">Workspace URL</Label>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span className="shrink-0 font-mono text-xs">app.com/</span>
                        <Input
                          id="org-slug"
                          placeholder="acme"
                          value={orgSlug}
                          onChange={(event) => setOrgSlug(event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="org-code">Join Link or Token</Label>
                    <Input
                      id="org-code"
                      placeholder="https://.../join/agt_xxx or agt_xxx"
                      value={orgJoinToken}
                      onChange={(event) => setOrgJoinToken(event.target.value)}
                    />
                  </div>
                )}

                {orgError ? <p className="text-xs text-destructive">{orgError}</p> : null}
              </div>
            )}

            {/* Step 4: Browse Plugins */}
            {step.id === 'plugins' && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { name: 'GitHub Integration', desc: 'Sync pull requests, commits, and issue tracking.' },
                    { name: 'Slack Bot', desc: 'Get real-time notification alerts directly in your channels.' },
                    { name: 'Figma Embed', desc: 'Preview live UI/UX design components inside tasks.' },
                  ].map((plugin) => (
                    <label
                      key={plugin.name}
                      className="flex cursor-pointer items-start gap-3.5 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                    >
                      <input type="checkbox" className="mt-1 rounded border-muted size-4" />
                      <div>
                        <p className="font-medium text-sm text-foreground">{plugin.name}</p>
                        <p className="text-xs text-muted-foreground">{plugin.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer Navigation (standard navigation across non-Terms steps) */}
        {step.id !== 'terms' && (
          <div className="mt-8 flex items-center justify-between border-t pt-5">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={isFirstStep}
              className="gap-1.5 text-xs"
              size="sm"
            >
              <IconArrowLeft className="size-3.5" />
              Back
            </Button>

            <Button onClick={() => void handleNext()} disabled={isCompleting || isOrgSubmitting} className="gap-1.5 text-xs" size="sm">
              {step.id === 'org' && isOrgSubmitting
                ? 'Processing...'
                : isLastStep
                  ? (isCompleting ? 'Finishing...' : 'Finish')
                  : step.isRequired
                    ? 'Continue'
                    : 'Skip / Finish'}
              {!isLastStep && <IconArrowRight className="size-3.5" />}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}