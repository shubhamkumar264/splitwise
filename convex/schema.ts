import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    tokenIdentifier: v.string(),
    imageUrl: v.optional(v.string()),
    upiId: v.optional(v.string()),          // ← NEW: for UPI payments
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .searchIndex("search_name", { searchField: "name" })
    .searchIndex("search_email", { searchField: "email" }),

  payments: defineTable({
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    amount: v.number(),
    method: v.string(),                     // "manual" | "upi" | "razorpay"
    status: v.string(),                     // "pending" | "awaiting_confirmation" | "completed"
    razorpayOrderId: v.optional(v.string()),
    razorpayPaymentId: v.optional(v.string()),
  })
    .index("by_from_user", ["fromUserId"])
    .index("by_to_user", ["toUserId"]),

  expenses: defineTable({
    description: v.string(),
    amount: v.number(),
    category: v.optional(v.string()),
    date: v.number(),
    paidByUserId: v.id("users"),
    splitType: v.string(),
    splits: v.array(
      v.object({
        userId: v.id("users"),
        amount: v.number(),
        paid: v.boolean(),
      })
    ),
    groupId: v.optional(v.id("groups")),
    createdBy: v.id("users"),
  })
    .index("by_group", ["groupId"])
    .index("by_user_and_group", ["paidByUserId", "groupId"])
    .index("by_date", ["date"]),

  settlements: defineTable({
    amount: v.number(),
    note: v.optional(v.string()),
    date: v.number(),
    paidByUserId: v.id("users"),
    receivedByUserId: v.id("users"),
    groupId: v.optional(v.id("groups")),
    relatedExpenseIds: v.optional(v.array(v.id("expenses"))),
    createdBy: v.id("users"),
  })
    .index("by_group", ["groupId"])
    .index("by_user_and_group", ["paidByUserId", "groupId"])
    .index("by_receiver_and_group", ["receivedByUserId", "groupId"])
    .index("by_date", ["date"]),

  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    members: v.array(
      v.object({
        userId: v.id("users"),
        role: v.string(),
        joinedAt: v.number(),
      })
    ),
  }),
});