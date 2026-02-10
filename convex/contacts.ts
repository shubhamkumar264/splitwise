// convex/contacts.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/* ─────────────────────────────────────────────────────────────
   1. getAllContacts – 1-to-1 contacts + groups
   ─────────────────────────────────────────────────────────── */
export const getAllContacts = query({
  args: {},
  handler: async (ctx:any) => {
    const currentUser = await ctx.runQuery(
      internal.users.getCurrentUser,
      {}
    );

    /* ── personal expenses where YOU are the payer ─────────── */
    const expensesYouPaid = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q:any) =>
        q.eq("paidByUserId", currentUser._id)
      )
      .filter((q:any) => q.eq(q.field("groupId"), undefined))
      .collect();

    /* ── personal expenses where YOU are NOT the payer ─────── */
    const expensesNotPaidByYou = (
      await ctx.db
        .query("expenses")
        .filter((q:any) => q.eq(q.field("groupId"), undefined))
        .collect()
    ).filter(
      (e:any) =>
        e.paidByUserId !== currentUser._id &&
        e.splits.some((s:any) => s.userId === currentUser._id)
    );

    const personalExpenses = [
      ...expensesYouPaid,
      ...expensesNotPaidByYou,
    ];

    /* ── extract unique contact IDs ───────────────────────── */
    const contactIds = new Set<string>();

    personalExpenses.forEach((exp) => {
      if (exp.paidByUserId !== currentUser._id) {
        contactIds.add(exp.paidByUserId);
      }

      exp.splits.forEach((s:any) => {
        if (s.userId !== currentUser._id) {
          contactIds.add(s.userId);
        }
      });
    });

    /* ── fetch contact users ───────────────────────────────── */
    const contactUsers = (
      await Promise.all(
        [...contactIds].map(async (id) => {
          const u = await ctx.db.get(id);
          return u
            ? {
                id: u._id,
                name: u.name,
                email: u.email,
                imageUrl: u.imageUrl,
                type: "user" as const,
              }
            : null;
        })
      )
    ).filter(Boolean);

    contactUsers.sort((a:any, b:any) => a.name.localeCompare(b.name));

    /* ── groups where user is a member ─────────────────────── */
    const userGroups = (await ctx.db.query("groups").collect())
      .filter((g:any) => g.members.some((m:any) => m.userId === currentUser._id))
      .map((g:any) => ({
        id: g._id,
        name: g.name,
        description: g.description,
        memberCount: g.members.length,
        type: "group" as const,
      }))
      .sort((a:any, b:any) => a.name.localeCompare(b.name));

    return {
      users: contactUsers,
      groups: userGroups,
    };
  },
});

/* ─────────────────────────────────────────────────────────────
   2. createGroup – create a new group
   ─────────────────────────────────────────────────────────── */
export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    members: v.array(v.id("users")),
  },
  handler: async (ctx: any, args: any): Promise<any> => {
    const currentUser = await ctx.runQuery(
      internal.users.getCurrentUser,
      {}
    );

    if (!args.name.trim()) {
      throw new Error("Group name cannot be empty");
    }

    const uniqueMembers = new Set<any>(args.members);
    uniqueMembers.add(currentUser._id);

    for (const id of uniqueMembers) {
      const user = await ctx.db.get(id);
      if (!user) {
        throw new Error(`User with ID ${id} not found`);
      }
    }

    return await ctx.db.insert("groups", {
      name: args.name.trim(),
      description: args.description?.trim() ?? "",
      createdBy: currentUser._id,
      members: [...uniqueMembers].map((id) => ({
        userId: id,
        role: id === currentUser._id ? "admin" : "member",
        joinedAt: Date.now(),
      })),
    });
  },
});

