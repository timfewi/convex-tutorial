import { mutation, query, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

export const sendMessage = mutation({
  args: {
    user: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("Received message:", args);
    await ctx.db.insert("messages", {
      user: args.user,
      body: args.body,
    });

    if (args.body.startsWith("/wiki ")) {
      const topic = args.body.slice(args.body.indexOf(" ") + 1);
      await ctx.scheduler.runAfter(0, internal.chat.getWikipeadiaSummary, { 
        topic 
      });
    }
  },
});

export const getMessages = query({
  handler: async (ctx) => {
    const messages = await ctx.db.query("messages").order("desc").take(40);
    return messages.reverse();
  },
});

export const processMessagesStreaming = mutation({
  args: {},
  handler: async (ctx) => {
    let count = 0;
    for await (const msg of ctx.db.query("messages")) {
      console.log("Processing message:", msg);
      count++;
    }
    return { count };
  },
});

export const listMessagesPage = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit });
  },
});

export const getMessagesAsArrayViaAsyncIterable = query({
  handler: async (ctx) => {
    const out: Array<any> = [];
    for await (const msg of ctx.db.query("messages")) {
      out.push(msg);
    }
    return out;
  },
});

export const getWikipeadiaSummary = internalAction({
  args: { topic: v.string() },
  handler: async (ctx, args) => {
    const response = await fetch(
      "https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&titles=" +
        args.topic
    );

    const summary = getSummaryFromJSON(await response.json());
    await ctx.scheduler.runAfter(0, api.chat.sendMessage, {
      user: "WikiBot",
      body: summary,
    })
  },
});

function getSummaryFromJSON(data: any): string {
  const firstPageId = Object.keys(data.query.pages)[0];
  return data.query.pages[firstPageId].extract;
}
