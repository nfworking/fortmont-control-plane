import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";

/* ============================================================================
 * Better Auth Tables
 * ========================================================================== */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),

    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),

    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),

    scope: text("scope"),
    password: text("password"),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),

    identifier: text("identifier").notNull(),
    value: text("value").notNull(),

    expiresAt: timestamp("expires_at").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/* ============================================================================
 * Agents
 * ========================================================================== */

export const agent = pgTable(
  "agent",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /**
     * Friendly name shown in the dashboard.
     */
    name: text("name").notNull(),

    description: text("description"),

    /**
     * Unique identifier generated when the agent is first installed.
     */
    deviceId: text("device_id").notNull().unique(),

    /**
     * Computer information.
     */
    hostname: text("hostname").notNull(),
    localIp: text("local_ip"),
    publicIp: text("public_ip"),
    platform: text("platform").notNull(), // windows | linux | darwin
    architecture: text("architecture").notNull(), // amd64 | arm64

    /**
     * Agent version.
     */
    version: text("version").notNull(),

    /**
     * Long-lived token hash used by an already-enrolled agent to reconnect.
     */
    authTokenHash: text("auth_token_hash").unique(),
    authTokenIssuedAt: timestamp("auth_token_issued_at"),
    authTokenLastUsedAt: timestamp("auth_token_last_used_at"),

    /**
     * Connection state.
     */
    connected: boolean("connected").default(false).notNull(),

    lastSeen: timestamp("last_seen"),

    /**
     * Future expansion.
     * Can contain OS version, serial number, manufacturer, etc.
     */
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("agent_deviceId_idx").on(table.deviceId),
    index("agent_hostname_idx").on(table.hostname),
    index("agent_localIp_idx").on(table.localIp),
    index("agent_publicIp_idx").on(table.publicIp),
    index("agent_connected_idx").on(table.connected),
    index("agent_lastSeen_idx").on(table.lastSeen),
    index("agent_authTokenHash_idx").on(table.authTokenHash),
  ],
);

export const agentJoinToken = pgTable(
  "agent_join_token",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    tokenHash: text("token_hash").notNull().unique(),

    label: text("label"),

    maxUses: integer("max_uses").default(1).notNull(),
    usesCount: integer("uses_count").default(0).notNull(),

    revoked: boolean("revoked").default(false).notNull(),

    expiresAt: timestamp("expires_at").notNull(),

    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("agent_join_token_hash_idx").on(table.tokenHash),
    index("agent_join_token_expiresAt_idx").on(table.expiresAt),
    index("agent_join_token_revoked_idx").on(table.revoked),
  ],
);

/* ============================================================================
 * Relations
 * ========================================================================== */

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  agentJoinTokens: many(agentJoinToken),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const agentJoinTokenRelations = relations(agentJoinToken, ({ one }) => ({
  createdByUser: one(user, {
    fields: [agentJoinToken.createdByUserId],
    references: [user.id],
  }),
}));

/* ============================================================================
 * Schema Export
 * ========================================================================== */

export const schema = {
  user,
  session,
  account,
  verification,
  agent,
  agentJoinToken,
};