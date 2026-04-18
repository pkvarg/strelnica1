import { boolean, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const appSettings = pgTable(
  "app_settings",
  {
    id: integer("id").primaryKey().default(1),
    reminderSmsEnabled: boolean("reminder_sms_enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (t) => [
    // Singleton: always exactly one row with id=1
    sql`CHECK (${t.id} = 1)`,
  ],
);
