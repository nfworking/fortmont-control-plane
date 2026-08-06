"use client"

import React, { useState, useEffect } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  User,
  Shield,
  Key,
  Building2,
  X,
  Camera,
  Copy,
  Plus,
  Trash2,
  Loader2,
  Check,
} from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { CreateOrganizationDialog } from "@/components/forms/create-org-form"
import { getOrganizations } from "@/server/orgs"

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

type OrganizationSummary = {
  id: string
  name: string
  createdAt: Date
  slug: string
  logo: string | null
  metadata: string | null
}

type JoinLink = {
  id: string
  label: string | null
  enabled: boolean
  createdAt: string
  updatedAt?: string
}

type JoinRequestItem = {
  id: string
  status: string
  requestedAt: string
  decidedAt: string | null
  userId: string
  userName: string
  userEmail: string
  userImage: string | null
}

type OrganizationMemberItem = {
  id: string
  userId: string
  role: string
  createdAt: string
  name: string
  email: string
  image: string | null
}

function isAdminRole(roleValue: string | null | undefined) {
  if (!roleValue) return false
  const roles = roleValue
    .split(",")
    .map((value) => value.trim().toLowerCase())

  return roles.includes("owner") || roles.includes("admin")
}

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { data } = authClient.useSession()
  const userImg = authClient.useSession()?.data?.user?.image ?? null
  const [activeTab, setActiveTab] = useState<
    "profile" | "account" | "api-keys" | "organizations"
  >("profile")
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)
  const [activeMemberRole, setActiveMemberRole] = useState<string | null>(null)
  const [joinLink, setJoinLink] = useState<JoinLink | null>(null)
  const [joinRequests, setJoinRequests] = useState<JoinRequestItem[]>([])
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMemberItem[]>([])
  const [generatedJoinLinkUrl, setGeneratedJoinLinkUrl] = useState<string | null>(null)
  const [copiedJoinLink, setCopiedJoinLink] = useState(false)
  const [orgAdminBusy, setOrgAdminBusy] = useState(false)
  const [orgAdminError, setOrgAdminError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem("profile-avatar-url")
  })
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null)
  const [editedName, setEditedName] = useState<string>("")
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null)
  const [profileSaveSuccess, setProfileSaveSuccess] = useState<string | null>(null)

  useEffect(() => {
    getOrganizations().then(setOrganizations)
  }, [])

  useEffect(() => {
    if (data?.user?.name) {
      setEditedName(data.user.name)
    }
  }, [data?.user?.name])

  const loadAdminData = async () => {
    const [linkResponse, requestsResponse] = await Promise.all([
      fetch("/api/v2/organization/join-links", { cache: "no-store" }),
      fetch("/api/v2/organization/join-requests?status=pending", { cache: "no-store" }),
    ])

    if (!linkResponse.ok) {
      const body = await linkResponse.json().catch(() => null)
      throw new Error(body?.error ?? "Failed to load join link")
    }

    if (!requestsResponse.ok) {
      const body = await requestsResponse.json().catch(() => null)
      throw new Error(body?.error ?? "Failed to load join requests")
    }

    const linkPayload = await linkResponse.json()
    const requestsPayload = await requestsResponse.json()

    setJoinLink((linkPayload?.link ?? null) as JoinLink | null)
    setJoinRequests((requestsPayload?.requests ?? []) as JoinRequestItem[])
  }

  const loadOrganizationMembers = async () => {
    const response = await fetch("/api/v2/organization/members", { cache: "no-store" })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(payload?.error ?? "Failed to load organization members")
    }

    setOrganizationMembers((payload?.members ?? []) as OrganizationMemberItem[])
  }

  const selectOrganization = async (organizationId: string) => {
    setOrgAdminBusy(true)
    setOrgAdminError(null)
    setGeneratedJoinLinkUrl(null)
    setCopiedJoinLink(false)

    try {
      await authClient.organization.setActive({ organizationId })
      window.dispatchEvent(new CustomEvent("organization-changed"))

      const roleResult = (await authClient.organization.getActiveMemberRole()) as {
        data?: { role?: string } | string | null
      }

      const resolvedRole =
        typeof roleResult?.data === "string"
          ? roleResult.data
          : roleResult?.data?.role ?? null

      setSelectedOrganizationId(organizationId)
      setActiveMemberRole(resolvedRole)
      await loadOrganizationMembers()

      if (isAdminRole(resolvedRole)) {
        await loadAdminData()
      } else {
        setJoinLink(null)
        setJoinRequests([])
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load organization details"
      setOrgAdminError(message)
    } finally {
      setOrgAdminBusy(false)
    }
  }

  const rotateJoinLink = async () => {
    setOrgAdminBusy(true)
    setOrgAdminError(null)

    try {
      const response = await fetch("/api/v2/organization/join-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ label: "Account settings" }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to rotate join link")
      }

      if (typeof payload?.joinUrl === "string") {
        setGeneratedJoinLinkUrl(payload.joinUrl)
        setCopiedJoinLink(false)
      }

      await loadAdminData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to rotate join link"
      setOrgAdminError(message)
    } finally {
      setOrgAdminBusy(false)
    }
  }

  const toggleJoinLink = async (enabled: boolean) => {
    setOrgAdminBusy(true)
    setOrgAdminError(null)

    try {
      const response = await fetch("/api/v2/organization/join-links", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled, linkId: joinLink?.id ?? null }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update join link")
      }

      await loadAdminData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update join link"
      setOrgAdminError(message)
    } finally {
      setOrgAdminBusy(false)
    }
  }

  const revokeJoinLink = async () => {
    setOrgAdminBusy(true)
    setOrgAdminError(null)

    try {
      const linkId = joinLink?.id
      const url = linkId
        ? `/api/v2/organization/join-links?linkId=${encodeURIComponent(linkId)}`
        : "/api/v2/organization/join-links"

      const response = await fetch(url, {
        method: "DELETE",
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to revoke join link")
      }

      await loadAdminData()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to revoke join link"
      setOrgAdminError(message)
    } finally {
      setOrgAdminBusy(false)
    }
  }

  const decideRequest = async (requestId: string, decision: "approve" | "reject") => {
    setOrgAdminBusy(true)
    setOrgAdminError(null)

    try {
      const response = await fetch(`/api/v2/organization/join-requests/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ decision }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update join request")
      }

      await loadAdminData()
      await loadOrganizationMembers()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update join request"
      setOrgAdminError(message)
    } finally {
      setOrgAdminBusy(false)
    }
  }

  const copyGeneratedJoinLink = async () => {
    if (!generatedJoinLinkUrl) return

    try {
      await navigator.clipboard.writeText(generatedJoinLinkUrl)
      setCopiedJoinLink(true)
      window.setTimeout(() => setCopiedJoinLink(false), 1800)
    } catch {
      setOrgAdminError("Failed to copy join link")
    }
  }

  const displayName = editedName || data?.user?.name || "User"
  const userWithTwoFactor = data?.user as { twoFactorEnabled?: boolean } | undefined
  const isTwoFactorEnabled = Boolean(userWithTwoFactor?.twoFactorEnabled)
  const avatarInitials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  async function uploadAvatarFile(file: File) {
    const contentType = file.type.toLowerCase()
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]

    if (!allowedTypes.includes(contentType)) {
      throw new Error("Unsupported file type. Allowed: JPG, PNG, GIF, WEBP")
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("File is too large. Maximum size is 5MB")
    }

    const presignResponse = await fetch("/api/v2/profile/avatar/presign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType,
        contentLength: file.size,
      }),
    })

    if (!presignResponse.ok) {
      const payload = await presignResponse.json().catch(() => null)
      throw new Error(payload?.error || "Failed to initialize upload")
    }

    const presignPayload: {
      key: string
      uploadUrl: string
      requiredHeaders?: {
        "Content-Type"?: string
      }
    } = await presignResponse.json()

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("PUT", presignPayload.uploadUrl)
      xhr.setRequestHeader("Content-Type", presignPayload.requiredHeaders?.["Content-Type"] || contentType)

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        const progress = Math.min(100, Math.round((event.loaded / event.total) * 100))
        setUploadProgress(progress)
      }

      xhr.onerror = () => {
        reject(new Error("Upload failed due to a network error"))
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(100)
          resolve()
          return
        }

        reject(new Error(`Upload failed with status ${xhr.status}`))
      }

      xhr.send(file)
    })

    const completeResponse = await fetch("/api/v2/profile/avatar/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: presignPayload.key,
        contentType,
      }),
    })

    if (!completeResponse.ok) {
      const payload = await completeResponse.json().catch(() => null)
      throw new Error(payload?.error || "Failed to save profile image")
    }

    const completePayload: { imageUrl: string } = await completeResponse.json()
    setAvatarUrl(completePayload.imageUrl)
    window.localStorage.setItem("profile-avatar-url", completePayload.imageUrl)

    window.dispatchEvent(
      new CustomEvent("profile-avatar-updated", {
        detail: { imageUrl: completePayload.imageUrl },
      }),
    )
  }

  const saveProfile = async () => {
    setIsSavingProfile(true)
    setProfileSaveError(null)
    setProfileSaveSuccess(null)

    const { error } = await authClient.updateUser({ name: editedName })

    if (error) {
      setProfileSaveError(error.message ?? "Failed to update profile")
    } else {
      setProfileSaveSuccess("Profile updated")
      window.setTimeout(() => setProfileSaveSuccess(null), 2500)
    }

    setIsSavingProfile(false)
  }

  async function handleAvatarInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return

    setAvatarError(null)
    setAvatarSuccess(null)
    setUploadProgress(0)
    setIsUploadingAvatar(true)

    try {
      await uploadAvatarFile(file)
      setAvatarSuccess("Profile picture updated")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload profile picture"
      setAvatarError(message)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const navItems = [
    { id: "profile", label: "Profile", icon: User },
    { id: "account", label: "Account", icon: Shield },
    { id: "api-keys", label: "API Keys", icon: Key },
    { id: "organizations", label: "Organizations", icon: Building2 },
  ] as const

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {/* Pitch Black Backdrop Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300" />

        {/* Pitch Black Main Modal Container with Extra-Rounded Corners (3xl) */}
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-full max-w-4xl h-[660px] bg-black border border-zinc-900 rounded-3xl shadow-2xl flex overflow-hidden text-white font-sans outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200">
          
          {/* Left Sidebar */}
          <aside className="w-64 border-r border-zinc-900/80 p-5 flex flex-col justify-between bg-black">
            <div className="space-y-6">
              {/* Close Button Styled Like Tile Block */}
              <div className="flex items-center justify-between px-1">
                <DialogPrimitive.Close className="w-9 h-9 flex items-center justify-center bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-all outline-none">
                  <X className="w-4 h-4" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>

              {/* Navigation Items */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = activeTab === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 ${
                        isActive
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-zinc-400"}`} />
                      {item.label}
                    </button>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col bg-black overflow-y-auto">
            <div className="p-8 max-w-2xl">
              
              {/* PROFILE TAB */}
              {activeTab === "profile" && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-white">Profile</h2>
                  </div>

                  {/* Profile Banner Tile Inspired by Reference */}
                  <div className="relative rounded-2xl bg-zinc-900/50 border border-zinc-800/60 p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        <Avatar className="w-14 h-14 rounded-full border border-zinc-800 bg-black">
                          <AvatarImage src={userImg ?? undefined} alt={displayName} />
                          <AvatarFallback className="bg-zinc-800 text-zinc-300 text-base font-medium">
                            {avatarInitials || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <label
                          htmlFor="avatar-upload"
                          className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <Camera className="w-4 h-4 text-zinc-200" />
                        </label>
                        <input
                          id="avatar-upload"
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                          className="hidden"
                          disabled={isUploadingAvatar}
                          onChange={handleAvatarInputChange}
                        />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{displayName}</h4>
                        <p className="text-xs text-zinc-400 mt-0.5">JPG, PNG, GIF or WEBP. Max 5MB.</p>
                        {avatarError && <p className="mt-1 text-[11px] text-red-400">{avatarError}</p>}
                        {avatarSuccess && <p className="mt-1 text-[11px] text-emerald-400">{avatarSuccess}</p>}
                      </div>
                    </div>

                    <label
                      htmlFor="avatar-upload"
                      className={`px-4 py-2 text-xs font-medium rounded-full border border-zinc-700 bg-black text-zinc-200 hover:bg-zinc-800 transition-all cursor-pointer shrink-0 ${
                        isUploadingAvatar ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {isUploadingAvatar ? "Uploading..." : "Upload Photo"}
                    </label>
                  </div>

                  {/* Continuous Line List Items */}
                  <div className="space-y-6 pt-2">
                    <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
                      <div>
                        <p className="text-sm font-medium text-white">Display Name</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Your public display name</p>
                      </div>
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="w-56 px-3.5 py-1.5 bg-black border border-zinc-800 rounded-xl text-sm text-white text-right focus:outline-none focus:border-zinc-600 transition-all"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        {profileSaveError && <p className="text-[11px] text-red-400">{profileSaveError}</p>}
                        {profileSaveSuccess && <p className="text-[11px] text-emerald-400">{profileSaveSuccess}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => void saveProfile()}
                        disabled={isSavingProfile || editedName.trim() === ""}
                        className="px-5 py-2 text-xs font-medium bg-white text-black rounded-full hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSavingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ACCOUNT TAB */}
              {activeTab === "account" && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold tracking-tight text-white mb-6">Account</h2>

                  {/* Reference-Style Security Notice Banner */}
                  <div className="relative rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="w-8 h-8 rounded-xl bg-black border border-zinc-800 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Secure your account</p>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        Add multi-factor authentication (MFA) to help protect your account when logging in.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = "/two-factor/setup?next=%2Fdashboard%2Fcontrol-plane"
                      }}
                      className="inline-block mt-2 px-4 py-2 text-xs font-medium bg-black border border-zinc-700 text-white rounded-full hover:bg-zinc-800 transition-all"
                    >
                      {isTwoFactorEnabled ? "Manage MFA" : "Set up MFA"}
                    </button>
                  </div>

                  {/* List Rows with Divider Lines */}
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between py-3 border-b border-zinc-900">
                      <div>
                        <p className="text-sm font-medium text-white">Email Address</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Primary account email</p>
                      </div>
                      <span className="text-sm font-mono text-zinc-400">{data?.user?.email ?? "—"}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-zinc-900">
                      <div>
                        <p className="text-sm font-medium text-white">Two-Factor Authentication</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Status</p>
                      </div>
                      <span className={`text-xs font-medium ${isTwoFactorEnabled ? "text-emerald-400" : "text-zinc-500"}`}>
                        {isTwoFactorEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* API KEYS TAB */}
              {activeTab === "api-keys" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold tracking-tight text-white">API Keys</h2>
                    <button className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-white text-black rounded-full hover:bg-zinc-200 transition-all">
                      <Plus className="w-3.5 h-3.5" />
                      Create Key
                    </button>
                  </div>

                  <div className="space-y-1">
                    {[
                      { name: "Production Key", created: "May 12, 2026", key: "sk_live_...9a4f" },
                      { name: "Development Key", created: "Jul 28, 2026", key: "sk_test_...1b8e" },
                    ].map((k, idx) => (
                      <div key={idx} className="flex items-center justify-between py-4 border-b border-zinc-900">
                        <div>
                          <p className="text-sm font-medium text-white">{k.name}</p>
                          <p className="text-xs text-zinc-500 font-mono mt-0.5">{k.key} • Created {k.created}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="p-2 text-zinc-400 hover:text-white rounded-lg transition-all">
                            <Copy className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-zinc-500 hover:text-red-400 rounded-lg transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ORGANIZATIONS TAB */}
              {activeTab === "organizations" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold tracking-tight text-white">Organizations</h2>
                    <CreateOrganizationDialog />
                  </div>

                  {orgAdminError ? <p className="text-xs text-red-400">{orgAdminError}</p> : null}

                  <div className="space-y-1">
                    {organizations.map((org) => (
                      <button
                        type="button"
                        key={org.id}
                        onClick={() => void selectOrganization(org.id)}
                        className="w-full text-left flex items-center justify-between py-3.5 border-b border-zinc-900 transition-all group"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-200">
                            {org.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white group-hover:text-zinc-300">{org.name}</p>
                            <p className="text-xs text-zinc-500">/{org.slug}</p>
                          </div>
                        </div>

                        {selectedOrganizationId === org.id ? (
                          <span className="text-[11px] text-zinc-300 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">Active</span>
                        ) : null}
                      </button>
                    ))}

                    {!organizations.length ? (
                      <p className="text-xs text-zinc-500 py-4">No organizations found.</p>
                    ) : null}
                  </div>

                  {selectedOrganizationId ? (
                    <div className="mt-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">Organization Controls</p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Role: <span className="text-white font-medium">{activeMemberRole ?? "unknown"}</span>
                          </p>
                        </div>
                        {orgAdminBusy ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> : null}
                      </div>

                      {isAdminRole(activeMemberRole) ? (
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center justify-between py-3 border-b border-zinc-900">
                            <div>
                              <p className="text-xs font-medium text-zinc-300">Join Link</p>
                              <p className="text-[11px] text-zinc-500 mt-0.5">
                                {joinLink ? (joinLink.enabled ? "Enabled" : "Disabled") : "No active link"}
                              </p>
                            </div>
                            <button
                              className="px-3.5 py-1.5 text-xs font-medium bg-black border border-zinc-700 text-zinc-200 rounded-full hover:bg-zinc-800 transition-all"
                              onClick={() => void rotateJoinLink()}
                              disabled={orgAdminBusy}
                              type="button"
                            >
                              Generate Link
                            </button>
                          </div>

                          {generatedJoinLinkUrl ? (
                            <div className="rounded-xl bg-black border border-zinc-900 p-3">
                              <p className="text-[11px] text-zinc-500">Shareable Link</p>
                              <div className="mt-1 flex items-center gap-2">
                                <p className="font-mono text-xs break-all text-zinc-300 flex-1">{generatedJoinLinkUrl}</p>
                                <button
                                  type="button"
                                  onClick={() => void copyGeneratedJoinLink()}
                                  className="inline-flex items-center gap-1 rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-900 transition-all shrink-0"
                                >
                                  {copiedJoinLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                  {copiedJoinLink ? "Copied" : "Copy"}
                                </button>
                              </div>
                            </div>
                          ) : null}

                          <div className="space-y-2 pt-2">
                            <p className="text-xs font-medium text-zinc-300">Pending Requests</p>
                            {joinRequests.map((request) => (
                              <div key={request.id} className="flex items-center justify-between py-2 border-b border-zinc-900">
                                <div>
                                  <p className="text-xs font-medium text-white">{request.userName || request.userEmail}</p>
                                  <p className="text-[11px] text-zinc-500">{request.userEmail}</p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => void decideRequest(request.id, "approve")}
                                    disabled={orgAdminBusy}
                                    className="px-3 py-1 text-xs font-medium bg-white text-black rounded-full hover:bg-zinc-200 transition-all"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => void decideRequest(request.id, "reject")}
                                    disabled={orgAdminBusy}
                                    className="px-3 py-1 text-xs font-medium border border-zinc-800 text-zinc-400 rounded-full hover:bg-zinc-900 transition-all"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            ))}
                            {!joinRequests.length && (
                              <p className="text-xs text-zinc-500">No pending join requests.</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">Admin privileges required to manage join settings.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

            </div>
          </main>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}