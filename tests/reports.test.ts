import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./helpers/database.ts";
import {
  reportFilters,
  reportMoney,
  vietnamDate,
  type CashReport,
} from "../src/lib/report.ts";
test("M6 report dates use Vietnam boundaries, strict input and exact integer VND", () => {
  assert.equal(vietnamDate(new Date("2026-11-18T17:00:00Z")), "2026-11-19");
  assert.deepEqual(reportFilters({}, new Date("2026-11-18T17:00:00Z")), {
    from: "2026-11-01",
    to: "2026-11-19",
    group: "day",
    page: 1,
  });
  for (const q of [
    { from: "2026-02-30" },
    { from: "2026-11-20", to: "2026-11-19" },
    { from: "2024-01-01", to: "2025-01-01" },
    { page: "-1" },
    { page: "1.5" },
    { group: "year" },
    { from: ["2026-01-01"] },
  ])
    assert.throws(() => reportFilters(q));
  assert.equal(
    reportFilters({ from: "2024-01-01", to: "2024-12-31" }).from,
    "2024-01-01",
  );
  assert.match(reportMoney("9007199254740993"), /9\.007\.199\.254\.740\.993/);
  assert.match(reportMoney("-160000"), /-160\.000/);
});
test("M6 SQL: ledger cash basis, Vietnam dates, current COD, refunds, pagination and authorization", async (t) => {
  const db = await createTestDatabase(),
    admin = randomUUID();
  const actor = async (role: string, id = "") => {
    await db.exec(`reset role;set role ${role}`);
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [id, JSON.stringify({ session_id: id })],
    );
  };
  const report = async (
    from = "2026-11-19",
    to = from,
    group = "day",
    page = 1,
  ) =>
    (
      await db.query<{ v: CashReport }>(
        "select public.cash_report($1::date,$2::date,$3,$4) v",
        [from, to, group, page],
      )
    ).rows[0].v;
  try {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,'report@example.test',now())",
      [admin],
    );
    await db.query("insert into auth.identities values($1,'google',$2)", [
      admin,
      { email: "report@example.test", email_verified: true },
    ]);
    await db.query("insert into auth.sessions values($1,$1)", [admin]);
    await db.query(
      "insert into public.admin_members(user_id,email) values($1,'report@example.test')",
      [admin],
    );
    const orders: string[] = [];
    for (let i = 0; i < 7; i++) {
      const id = randomUUID();
      orders.push(id);
      await db.query(
        "insert into private.orders(id,code,customer_name,phone,keyboard,plan,total_vnd,actor_id,stage,cancelled_at,created_at,internal_note,shipping_address) values($1,$2,'PRIVATE CUSTOMER','0901234567','Report keyboard',$3,$4,$5,$6,$7,'2025-01-01','SECRET NOTE','SECRET ADDRESS')",
        [
          id,
          `TK-${String(i).repeat(32)}`,
          [1, 2, 4, 6].includes(i) ? "transfer_full" : "deposit_cod",
          [100000, 200000, 100000, 300000, 400000, 500000, 300000][i],
          admin,
          [2, 0, 0, 1, 2, 2, 0][i],
          [1, 2, 6].includes(i) ? "2026-11-19T00:00:00Z" : null,
        ],
      );
    }
    const payment = async (
      i: number,
      kind: string,
      amount: number,
      at: string,
    ) =>
      db.query(
        "insert into private.order_payments(order_id,kind,amount_vnd,method,reference,actor_id,created_at) values($1,$2,$3,'bank','SECRET BANK REFERENCE',$4,$5)",
        [orders[i], kind, amount, admin, at],
      );
    await payment(0, "receipt", 20000, "2026-11-18T17:00:00Z");
    await payment(1, "receipt", 200000, "2026-11-18T16:59:59Z");
    await payment(1, "refund", 160000, "2026-11-19T17:00:00Z");
    await payment(2, "receipt", 100000, "2026-11-19T10:00:00Z");
    await payment(2, "refund", 80000, "2026-11-19T11:00:00Z");
    await payment(3, "receipt", 60000, "2026-11-19T16:59:59Z");
    await payment(5, "receipt", 100000, "2026-11-18T10:00:00Z");
    await payment(5, "receipt", 400000, "2026-11-19T12:00:00Z");
    await payment(6, "receipt", 300000, "2026-11-17T10:00:00Z");
    await t.test(
      "guest/service cannot call report; unprivileged authenticated RPC is forbidden",
      async () => {
        await actor("anon");
        await assert.rejects(report(), /permission denied/);
        await actor("service_role");
        await assert.rejects(report(), /permission denied/);
        await actor("authenticated");
        await assert.rejects(report(), /forbidden/);
      },
    );
    await actor("authenticated", admin);
    await t.test(
      "receipts and refunds count on their own date, not order creation/completion/cancellation",
      async () => {
        const r = await report();
        assert.equal(r.received, "580000");
        assert.equal(r.refunded, "80000");
        assert.equal(r.net, "500000");
        assert.equal(r.transactionCount, 5);
        assert.equal(r.orderCount, 4);
        assert.equal(r.series.length, 1);
        assert.equal(r.series[0].net, r.net);
        assert.doesNotMatch(
          JSON.stringify(r),
          /0901234567|SECRET|PRIVATE CUSTOMER|TK-|cost_vnd|profit/,
        );
        assert.equal(r.pending.count, 2);
        assert.equal(r.pending.amount, "320000");
        assert.equal(r.pending.readyCount, 1);
        assert.equal(r.pending.readyAmount, "80000");
        assert.equal(r.pending.refundAmount, "240000");
        assert.equal(r.pending.refundCount, 1);
        const later = await report("2026-11-20");
        assert.equal(later.net, "-160000");
        assert.equal(later.received, "0");
        assert.deepEqual(later.pending, r.pending);
      },
    );
    await t.test(
      "monthly grouping matches ledger total; empty days and periods remain explicit",
      async () => {
        const r = await report("2026-11-17", "2026-11-21", "month");
        assert.equal(r.series.length, 1);
        assert.equal(r.net, "940000");
        const days = await report("2026-11-17", "2026-11-21");
        assert.equal(days.series.length, 5);
        assert.equal(days.series.at(-1)?.net, "0");
        assert.equal(
          days.series.reduce((n, x) => n + BigInt(x.net), BigInt(0)).toString(),
          r.net,
        );
        const empty = await report("1901-01-01");
        assert.equal(empty.transactionCount, 0);
        assert.deepEqual(empty.transactions, []);
        assert.equal(empty.net, "0");
        assert.equal(empty.pending.amount, "320000");
      },
    );
    await t.test("range/offset/group guard exists at DB boundary", async () => {
      for (const args of [
        ["2026-11-20", "2026-11-19", "day", 1],
        ["2024-01-01", "2025-01-01", "day", 1],
        ["2026-01-01", "2026-01-01", "year", 1],
        ["2026-01-01", "2026-01-01", "day", 0],
      ])
        await assert.rejects(
          report(...(args as [string, string, string, number])),
          /invalid_report_range/,
        );
    });
    await t.test(
      "pagination does not cap aggregates at the page size or 200 newest orders",
      async () => {
        await actor("postgres");
        await db.query(
          "insert into private.order_payments(order_id,kind,amount_vnd,method,reference,actor_id,created_at) select $1,'receipt',1,'bank','Fixture pagination',$2,'2040-01-01T00:00:00Z'::timestamptz+g*interval '1 second' from generate_series(1,251) g",
          [orders[4], admin],
        );
        await actor("authenticated", admin);
        const first = await report("2040-01-01"),
          last = await report("2040-01-01", "2040-01-01", "day", 6);
        assert.equal(first.received, "251");
        assert.equal(first.transactionCount, 251);
        assert.equal(first.transactions.length, 50);
        assert.equal(last.transactions.length, 1);
        assert.equal(last.net, first.net);
        assert.notEqual(first.transactions[0].id, last.transactions[0].id);
      },
    );
    await t.test(
      "disabled admin and revoked live session cannot inspect financial report",
      async () => {
        await actor("postgres");
        await db.query("update public.admin_members set active=false where user_id=$1",[admin]);
        await actor("authenticated",admin);
        await assert.rejects(report(),/forbidden/);
        await actor("postgres");
        await db.query("update public.admin_members set active=true where user_id=$1",[admin]);
        await db.query("delete from auth.sessions where id=$1", [admin]);
        await actor("authenticated", admin);
        await assert.rejects(report(), /forbidden/);
      },
    );
  } finally {
    await db.close();
  }
});
