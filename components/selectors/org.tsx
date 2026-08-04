import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { getOrganizations, getActiveOrganization } from "@/server/orgs"
import { getCurrentUser } from "@/server/users"

const user = await getCurrentUser()
const items = await getOrganizations()
const activeOrg = await getActiveOrganization(user.currentUser.id)

export async function SelectOrgs() {
  return (
    <Select>
      <SelectTrigger className="w-full max-w-48">
        <SelectValue placeholder={activeOrg?.name || "Select an organization"} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Organizations</SelectLabel>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.slug}>
              {item.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
