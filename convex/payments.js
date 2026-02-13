import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/* ============================================================
   Create Payment (UPI or Razorpay)
============================================================ */

export const createPayment = mutation({
  args: {
    toUserId: v.id("users"),
    amount: v.number(),
    method: v.union(
      v.literal("upi"),
      v.literal("razorpay")
    ),
    razorpayOrderId: v.optional(v.string()),
  },

  handler: async (ctx, args) => {

    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const fromUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!fromUser) {
      throw new Error("User not found");
    }

    return await ctx.db.insert("payments", {
      fromUserId: fromUser._id,
      toUserId: args.toUserId,
      amount: args.amount,
      method: args.method,
      status:
        args.method === "upi"
          ? "awaiting_confirmation"
          : "pending",
      razorpayOrderId: args.razorpayOrderId,
    });
  },
});

/* ============================================================
   Confirm UPI Payment
============================================================ */

export const confirmPayment = mutation({
  args: {
    paymentId: v.id("payments"),
  },

  handler: async (ctx, args) => {

    await ctx.db.patch(args.paymentId, {
      status: "completed",
    });

    return true;
  },
});

/* ============================================================
   Complete Razorpay Payment
============================================================ */

export const completeRazorpayPayment = mutation({
  args: {
    paymentId: v.id("payments"),
    razorpayPaymentId: v.string(),
  },

  handler: async (ctx, args) => {

    await ctx.db.patch(args.paymentId, {
      status: "completed",
      razorpayPaymentId: args.razorpayPaymentId,
    });

    return true;
  },
});
