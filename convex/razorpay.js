"use node";

import Razorpay from "razorpay";
import { action } from "./_generated/server";
import { v } from "convex/values";

export const createRazorpayOrder = action({
  args: {
    amount: v.number(),
  },

  handler: async (ctx, args) => {

    // Create instance INSIDE handler
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: args.amount * 100,
      currency: "INR",
    });

    return order;
  },
});
