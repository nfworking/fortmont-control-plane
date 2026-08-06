import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IconArrowLeft } from "@tabler/icons-react";

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-4xl py-10 px-4">
        <div className="mb-6">
        <Button asChild variant="outline" className="gap-2">
          <Link href="/">
            <IconArrowLeft className="size-4" />
            Back to Home
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">
            Terms & Conditions
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Last Updated: August 7, 2026
          </p>
        </CardHeader>

        <CardContent className="prose prose-neutral dark:prose-invert max-w-none">
          <p>
            Welcome to <strong>Fortmont Control Plane</strong> ("Fortmont",
            "we", "our", or "us"). By accessing or using Fortmont Control
            Plane, you agree to these Terms & Conditions. If you do not agree
            with these terms, please do not use the platform.
          </p>

          <h2>1. Use of the Service</h2>

          <p>
            Fortmont Control Plane provides a hosted platform for managing
            infrastructure, agents, organizations, and related services. You
            agree to use the platform only for lawful purposes and in accordance
            with these Terms.
          </p>

          <p>
            You are responsible for ensuring that your use of the platform
            complies with all applicable laws, regulations, and organizational
            policies.
          </p>

          <h2>2. Account Responsibility</h2>

          <p>
            You are responsible for maintaining the confidentiality of your
            account credentials and for all activities that occur under your
            account.
          </p>

          <ul>
            <li>Provide accurate and up-to-date account information.</li>
            <li>Keep your password and authentication methods secure.</li>
            <li>
              Notify us promptly if you believe your account has been
              compromised.
            </li>
          </ul>

          <h2>3. Organizations and Access</h2>

          <p>
            Organization owners are responsible for managing users,
            permissions, and access within their organization.
          </p>

          <p>
            Users must only access resources they have been authorized to use.
            Attempting to bypass permissions, access another organization's
            data, or interfere with the operation of the platform is strictly
            prohibited.
          </p>

          <h2>4. Acceptable Use</h2>

          <ul>
            <li>Use the platform for unlawful or fraudulent activities.</li>
            <li>
              Attempt to gain unauthorized access to Fortmont or connected
              systems.
            </li>
            <li>Distribute malware or malicious content.</li>
            <li>Disrupt or interfere with the availability of the platform.</li>
            <li>Reverse engineer or exploit the platform.</li>
          </ul>

          <h2>5. Customer Data</h2>

          <p>
            You retain ownership of the data you upload or generate through
            Fortmont.
          </p>

          <p>
            By using the service, you grant Fortmont permission to process,
            store, and transmit your data solely for the purpose of providing
            and improving the service.
          </p>

          <h2>6. Infrastructure Connections</h2>

          <p>
            Fortmont may connect to third-party infrastructure, including
            virtualization platforms, cloud services, and other supported
            systems.
          </p>

          <p>
            You are responsible for ensuring you have the authority to connect
            Fortmont to those systems and for maintaining appropriate
            credentials and permissions.
          </p>

          <h2>7. Service Availability</h2>

          <p>
            While we aim to provide a reliable service, Fortmont is provided on
            an "as available" basis. Maintenance, updates, and unexpected
            outages may temporarily affect service availability.
          </p>

          <h2>8. Security</h2>

          <p>
            We implement reasonable security measures to protect the platform
            and customer information. However, no internet-based service can
            guarantee complete security.
          </p>

          <h2>9. Third-Party Services</h2>

          <p>
            Fortmont may integrate with third-party services or APIs. We are
            not responsible for their availability or functionality.
          </p>

          <h2>10. Intellectual Property</h2>

          <p>
            Fortmont Control Plane, including its software, branding,
            documentation, and associated materials, remains the property of
            Fortmont unless otherwise stated.
          </p>

          <h2>11. Limitation of Liability</h2>

          <p>
            To the maximum extent permitted by law, Fortmont shall not be liable
            for indirect, incidental, consequential, or special damages arising
            from the use or inability to use the platform.
          </p>

          <h2>12. Termination</h2>

          <p>
            We reserve the right to suspend or terminate accounts that violate
            these Terms or compromise the security of the platform.
          </p>

          <h2>13. Changes to These Terms</h2>

          <p>
            We may update these Terms & Conditions from time to time. Continued
            use of Fortmont after changes become effective constitutes
            acceptance of the revised Terms.
          </p>

          <h2>14. Contact</h2>

          <p>
            If you have any questions regarding these Terms & Conditions,
            please contact the Fortmont team through the support options
            available within the platform or via our official website.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}