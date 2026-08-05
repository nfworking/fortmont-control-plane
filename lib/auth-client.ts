import { createAuthClient } from "better-auth/react"
import { organizationClient } from "better-auth/client/plugins"
import { twoFactorClient } from "better-auth/client/plugins"
export const authClient = createAuthClient({
    baseURL: "http://localhost:8090",
    plugins: [organizationClient(), twoFactorClient()],
})