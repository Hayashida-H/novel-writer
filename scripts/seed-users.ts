import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";
import * as schema from "../src/lib/db/schema";
import dotenv from "dotenv";

dotenv.config();

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  const usersData = [
    { username: "hirotsu", password: "4zm7KRvvIoskakt", role: "manager" as const },
    { username: "kayoko", password: "VMoDK7NJwvvVYmw", role: "reviewer" as const },
  ];

  for (const u of usersData) {
    const hash = await bcrypt.hash(u.password, 12);
    await db
      .insert(schema.users)
      .values({
        username: u.username,
        passwordHash: hash,
        role: u.role,
      })
      .onConflictDoNothing();
    console.log(`User "${u.username}" (${u.role}) created`);
  }

  console.log("Seed completed");
}

seed().catch(console.error);
