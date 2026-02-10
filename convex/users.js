import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/* ============================================================
   Helper: Extract safe display name from Clerk identity
============================================================ */

function getSafeName(identity) {
  return (
    identity.name ||
    identity.givenName ||
    identity.nickname ||
    identity.email?.split("@")[0] ||
    "Anonymous"
  );
}

/* ============================================================
   MUTATION: storeUser (Production Safe)
============================================================ */

export const store = mutation({
  args: {},
  handler: async (ctx) => {

    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("User not authenticated");
    }

    const tokenIdentifier = identity.tokenIdentifier;

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier)
      )
      .unique();

    const safeName = getSafeName(identity);

    /* ---------- USER EXISTS ---------- */
    if (existingUser) {

      // Only update if something changed
      if (
        existingUser.name !== safeName ||
        existingUser.email !== identity.email ||
        existingUser.imageUrl !== identity.pictureUrl
      ) {
        await ctx.db.patch(existingUser._id, {
          name: safeName,
          email: identity.email,
          imageUrl: identity.pictureUrl,
        });
      }

      return existingUser._id;
    }

    /* ---------- CREATE NEW USER ---------- */

    return await ctx.db.insert("users", {
      name: safeName,
      tokenIdentifier,
      email: identity.email,
      imageUrl: identity.pictureUrl,
    });
  },
});


/* ============================================================
   QUERY: getCurrentUser
============================================================ */

export const getCurrentUser = query({
  handler: async (ctx) => {

    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  },
});


/* ============================================================
   QUERY: searchUsers
============================================================ */

export const searchUsers = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {

    if (args.query.length < 2) {
      return [];
    }

    const identity = await ctx.auth.getUserIdentity();

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    const nameResults = await ctx.db
      .query("users")
      .withSearchIndex("search_name", (q) =>
        q.search("name", args.query)
      )
      .collect();

    const emailResults = await ctx.db
      .query("users")
      .withSearchIndex("search_email", (q) =>
        q.search("email", args.query)
      )
      .collect();

    // remove duplicates
    const users = [
      ...nameResults,
      ...emailResults.filter(
        (email) =>
          !nameResults.some((name) => name._id === email._id)
      ),
    ];

    return users
      .filter((u) => u._id !== currentUser._id)
      .map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        imageUrl: u.imageUrl,
      }));
  },
});
