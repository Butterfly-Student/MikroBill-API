// ========================================
// FREERADIUS TABLES

import { sql } from "drizzle-orm";
import { bigint, bigserial, check, index, inet, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

// ========================================
export const radacct = pgTable(
  "radacct",
  {
    RadAcctId: bigserial("radacctid", { mode: "number" }).primaryKey(),
    AcctSessionId: text("acctsessionid").notNull(),
    AcctUniqueId: text("acctuniqueid").notNull().unique(),
    UserName: text("username"),
    GroupName: text("groupname"),
    Realm: text("realm"),
    NASIPAddress: inet("nasipaddress").notNull(),
    NASPortId: text("nasportid"),
    NASPortType: text("nasporttype"),
    AcctStartTime: timestamp("acctstarttime", { withTimezone: true }),
    AcctUpdateTime: timestamp("acctupdatetime", { withTimezone: true }),
    AcctStopTime: timestamp("acctstoptime", { withTimezone: true }),
    AcctInterval: bigint("acctinterval", { mode: "number" }),
    AcctSessionTime: bigint("acctsessiontime", { mode: "number" }),
    AcctAuthentic: text("acctauthentic"),
    ConnectInfo_start: text("connectinfo_start"),
    ConnectInfo_stop: text("connectinfo_stop"),
    AcctInputOctets: bigint("acctinputoctets", { mode: "number" }),
    AcctOutputOctets: bigint("acctoutputoctets", { mode: "number" }),
    CalledStationId: text("calledstationid"),
    CallingStationId: text("callingstationid"),
    AcctTerminateCause: text("acctterminatecause"),
    ServiceType: text("servicetype"),
    FramedProtocol: text("framedprotocol"),
    FramedIPAddress: inet("framedipaddress"),
    FramedIPv6Address: inet("framedipv6address"),
    FramedIPv6Prefix: inet("framedipv6prefix"),
    FramedInterfaceId: text("framedinterfaceid"),
    DelegatedIPv6Prefix: inet("delegatedipv6prefix"),
    Class: text("class"),
    service_category: varchar("service_category", { length: 20 }).default(
      "pppoe"
    ),
  },
  (table) => [
    index("radacct_active_session_idx")
      .on(table.AcctUniqueId)
      .where(sql`${table.AcctStopTime} IS NULL`),

    index("radacct_bulk_close")
      .on(table.NASIPAddress, table.AcctStartTime)
      .where(sql`${table.AcctStopTime} IS NULL`),

    index("radacct_bulk_timeout").on(table.AcctStopTime, table.AcctUpdateTime),
    index("radacct_start_customer_idx").on(table.AcctStartTime, table.UserName),
    index("radacct_service_category_idx").on(
      table.service_category,
      table.AcctStartTime
    ),
    check(
      "service_category_check",
      sql`service_category IN ('pppoe', 'hotspot')`
    ),
  ]
);



// User check attributes
export const radcheck = pgTable(
  "radcheck",
  {
    id: serial("id").primaryKey(),
    UserName: text("username").notNull().default(""),
    Attribute: text("attribute").notNull().default(""),
    op: varchar("op", { length: 2 }).notNull().default("=="),
    Value: text("value").notNull().default(""),
  },
  (table) => [index("radcheck_username").on(table.UserName, table.Attribute)]
);

// Group check attributes
export const radgroupcheck = pgTable(
  "radgroupcheck",
  {
    id: serial("id").primaryKey(),
    GroupName: text("groupname").notNull().default(""),
    Attribute: text("attribute").notNull().default(""),
    op: varchar("op", { length: 2 }).notNull().default("=="),
    Value: text("value").notNull().default(""),
  },
  (table) => [
    index("radgroupcheck_groupname").on(table.GroupName, table.Attribute),
  ]
);

// Group reply attributes
export const radgroupreply = pgTable(
  "radgroupreply",
  {
    id: serial("id").primaryKey(),
    GroupName: text("groupname").notNull().default(""),
    Attribute: text("attribute").notNull().default(""),
    op: varchar("op", { length: 2 }).notNull().default("="),
    Value: text("value").notNull().default(""),
  },
  (table) => [
    index("radgroupreply_groupname").on(table.GroupName, table.Attribute),
  ]
);

// User reply attributes
export const radreply = pgTable(
  "radreply",
  {
    id: serial("id").primaryKey(),
    UserName: text("username").notNull().default(""),
    Attribute: text("attribute").notNull().default(""),
    op: varchar("op", { length: 2 }).notNull().default("="),
    Value: text("value").notNull().default(""),
  },
  (table) => [index("radreply_username").on(table.UserName, table.Attribute)]
);

// User group mapping
export const radusergroup = pgTable(
  "radusergroup",
  {
    id: serial("id").primaryKey(),
    UserName: text("username").notNull().default(""),
    GroupName: text("groupname").notNull().default(""),
    priority: integer("priority").notNull().default(0),
  },
  (table) => [index("radusergroup_username").on(table.UserName)]
);

// Post authentication log
export const radpostauth = pgTable("radpostauth", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  username: text("username").notNull(),
  pass: text("pass"),
  reply: text("reply"),
  CalledStationId: text("calledstationid"),
  CallingStationId: text("callingstationid"),
  authdate: timestamp("authdate", { withTimezone: true })
    .notNull()
    .defaultNow(),
  Class: text("class"),
});

// NAS configuration
export const nas = pgTable(
  "nas",
  {
    id: serial("id").primaryKey(),
    nasname: text("nasname").notNull(),
    shortname: text("shortname").notNull(),
    type: text("type").notNull().default("other"),
    ports: integer("ports"),
    secret: text("secret").notNull(),
    server: text("server"),
    community: text("community"),
    description: text("description"),
    require_ma: text("require_ma").notNull().default("auto"),
    limit_proxy_state: text("limit_proxy_state").notNull().default("auto"),
  },
  (table) => [index("nas_nasname").on(table.nasname)]
);

// NAS reload tracking
export const nasreload = pgTable("nasreload", {
  NASIPAddress: inet("nasipaddress").primaryKey(),
  ReloadTime: timestamp("reloadtime", { withTimezone: true }).notNull(),
});