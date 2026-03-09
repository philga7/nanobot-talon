#!/usr/bin/env node
/**
 * bird-x-read-mcp: Read-only X/Twitter MCP server for profiles and tweets.
 *
 * Uses @steipete/bird with AUTH_TOKEN and CT0 from env (or TWITTER_AUTH_TOKEN, TWITTER_CT0).
 * Exposes: bird_read_tweet, bird_read_thread, bird_user_tweets, bird_profile_about
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TwitterClient, resolveCredentials } from "@steipete/bird";
import { z } from "zod";

const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.TWITTER_AUTH_TOKEN;
const CT0 = process.env.CT0 || process.env.TWITTER_CT0;

async function getClient(): Promise<TwitterClient> {
  const { cookies } = await resolveCredentials({
    authToken: AUTH_TOKEN,
    ct0: CT0,
  });
  if (!cookies.authToken || !cookies.ct0) {
    throw new Error(
      "Missing X/Twitter credentials. Set AUTH_TOKEN and CT0 (or TWITTER_AUTH_TOKEN, TWITTER_CT0) in env."
    );
  }
  return new TwitterClient({ cookies });
}

function toTextContent(obj: unknown): { content: Array<{ type: "text"; text: string }> } {
  const text = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  return { content: [{ type: "text", text }] };
}

const server = new McpServer({
  name: "bird-x-read-mcp",
  version: "0.1.0",
});

server.tool(
  "bird_read_tweet",
  "Read a single X/Twitter tweet by URL or ID",
  {
    tweetIdOrUrl: z
      .string()
      .min(1)
      .describe("Tweet ID or URL (e.g. https://x.com/user/status/123 or 1234567890123456789)"),
  },
  async ({ tweetIdOrUrl }) => {
    const id = tweetIdOrUrl.replace(/^.*\/status\/(\d+).*$/, "$1");
    const client = await getClient();
    const result = await client.getTweet(id);
    if (!result.success) {
      throw new Error(result.error || "Failed to fetch tweet");
    }
    return toTextContent(result.tweet);
  }
);

server.tool(
  "bird_read_thread",
  "Read a full X/Twitter thread (root tweet plus replies in order)",
  {
    tweetIdOrUrl: z
      .string()
      .min(1)
      .describe("Tweet ID or URL of any tweet in the thread"),
    maxPages: z.number().int().min(1).max(5).optional().default(2).describe("Max pagination pages (default 2)"),
  },
  async ({ tweetIdOrUrl, maxPages }) => {
    const id = tweetIdOrUrl.replace(/^.*\/status\/(\d+).*$/, "$1");
    const client = await getClient();
    const result = await client.getThreadPaged(id, { maxPages });
    if (!result.success) {
      throw new Error(result.error || "Failed to fetch thread");
    }
    return toTextContent(result.tweets || []);
  }
);

server.tool(
  "bird_user_tweets",
  "Get recent tweets from a user's profile timeline",
  {
    username: z
      .string()
      .min(1)
      .describe("Username (handle without @, e.g. steipete)"),
    count: z.number().int().min(1).max(100).optional().default(20).describe("Number of tweets to fetch (max 100)"),
  },
  async ({ username, count }) => {
    const client = await getClient();
    const lookup = await client.getUserIdByUsername(username.startsWith("@") ? username.slice(1) : username);
    if (!lookup.success || !lookup.userId) {
      throw new Error(lookup.error || `User @${username} not found`);
    }
    const result = await client.getUserTweets(lookup.userId, count);
    if (!result.success) {
      throw new Error(result.error || "Failed to fetch user tweets");
    }
    return toTextContent(result.tweets || []);
  }
);

server.tool(
  "bird_profile_about",
  "Get X/Twitter account origin and location info for a user",
  {
    username: z
      .string()
      .min(1)
      .describe("Username (handle without @, e.g. steipete)"),
  },
  async ({ username }) => {
    const client = await getClient();
    const result = await client.getUserAboutAccount(username.startsWith("@") ? username.slice(1) : username);
    if (!result.success) {
      throw new Error(result.error || `Failed to fetch profile info for @${username}`);
    }
    return toTextContent(result.aboutProfile || result);
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
