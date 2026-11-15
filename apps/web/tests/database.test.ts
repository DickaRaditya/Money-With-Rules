import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("PostgreSQL migration: deny browser roles, enforce constraints, atomic nonce consumption, expiry and rate limit", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;",
    );
    await db.exec(
      await fs.readFile(
        new URL("../../../supabase/migrations/001_initial.sql", import.meta.url),
        "utf8",
      ),
    );
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relname in ('profiles','child_relationships','merchant_applications','auth_nonces','wallet_sessions','payment_attempts')",
    );
    assert.equal(tables.rows.length, 6);
    assert.ok(tables.rows.every((t) => t.relrowsecurity));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from public.wallet_sessions"), /permission denied/);
      await assert.rejects(
        db.query(
          "select public.consume_wallet_nonce('00000000-0000-0000-0000-000000000000','fake')",
        ),
        /permission denied/,
      );
      await db.exec("reset role");
    }
    const address = "0x1111111111111111111111111111111111111111";
    await db.query(
      "insert into public.profiles(wallet, display_name, role) values ($1,'Test parent','parent')",
      [address],
    );
    await db.exec("grant select on public.profiles to anon; set role anon");
    assert.equal(
      (await db.query("select * from public.profiles")).rows.length,
      0,
      "RLS still denies rows if grants are accidentally added",
    );
    await db.exec("reset role; revoke select on public.profiles from anon;");
    await assert.rejects(
      db.query(
        "insert into public.profiles(wallet, display_name, role) values ('bad','bad','admin')",
      ),
      /check constraint/,
    );
    await db.exec("set role service_role");
    const issued = await db.query<{ id: string }>(
      "select public.issue_wallet_nonce($1,'nonce1','message',31337) as id",
      [address],
    );
    const id = issued.rows[0].id;
    const attempts = await Promise.all([
      db.query<{ ok: boolean }>("select public.consume_wallet_nonce($1,'hash1') as ok", [id]),
      db.query<{ ok: boolean }>("select public.consume_wallet_nonce($1,'hash2') as ok", [id]),
    ]);
    assert.equal(
      attempts.filter((a) => a.rows[0].ok).length,
      1,
      "One nonce creates exactly one session",
    );
    assert.equal((await db.query("select * from public.wallet_sessions")).rows.length, 1);
    const expired = await db.query<{ id: string }>(
      "select public.issue_wallet_nonce($1,'nonce2','message',31337) as id",
      [address],
    );
    await db.query(
      "update public.auth_nonces set expires_at=now()-interval '1 minute' where id=$1",
      [expired.rows[0].id],
    );
    const consumed = await db.query<{ ok: boolean }>(
      "select public.consume_wallet_nonce($1,'hash3') as ok",
      [expired.rows[0].id],
    );
    assert.equal(consumed.rows[0].ok, false);
    for (let i = 3; i <= 5; i++)
      await db.query("select public.issue_wallet_nonce($1,$2,'message',31337)", [
        address,
        `nonce${i}`,
      ]);
    await assert.rejects(
      db.query("select public.issue_wallet_nonce($1,'nonce6','message',31337)", [address]),
      /RATE_LIMIT/,
    );
  } finally {
    await db.close();
  }
});
