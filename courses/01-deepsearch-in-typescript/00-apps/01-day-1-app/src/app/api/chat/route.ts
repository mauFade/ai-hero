import type { Message } from "ai";
import {
  streamText,
  createDataStreamResponse,
  type DataStreamWriter,
  appendResponseMessages,
} from "ai";
import { z } from "zod";
import { model } from "~/models";
import { auth } from "~/server/auth";
import { searchSerper } from "~/serper";
import { upsertChat } from "~/server/db/queries";
import { chats } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { Langfuse } from "langfuse";
import { env } from "~/env";
import { bulkCrawlWebsites } from "~/server/scraper";

const langfuse = new Langfuse({
  environment: env.NODE_ENV,
});

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    messages: Array<Message>;
    chatId?: string;
  };

  const { messages, chatId } = body;
  const userId = session.user.id;

  // Generate a chat ID if not provided
  const finalChatId = chatId ?? crypto.randomUUID();

  // Create a new chat if chatId was not provided
  let isNewChat = false;
  if (!chatId) {
    isNewChat = true;
    await upsertChat({
      userId,
      chatId: finalChatId,
      title: messages[messages.length - 1]!.content.slice(0, 50) + "...",
      messages,
    });
  } else {
    const chat = await db.query.chats.findFirst({
      where: eq(chats.id, finalChatId),
    });
    if (!chat || chat.userId !== session.user.id) {
      return new Response("Chat not found or unauthorized", { status: 404 });
    }
  }

  const trace = langfuse.trace({
    sessionId: finalChatId,
    name: "chat",
    userId: session.user.id,
  });

  return createDataStreamResponse({
    execute: async (dataStream: DataStreamWriter) => {
      // Send new chat ID if this is a new chat
      if (isNewChat) {
        dataStream.writeData({
          type: "NEW_CHAT_CREATED",
          chatId: finalChatId,
        });
      }

      const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
      const currentTime = new Date().toLocaleTimeString("en-US", {
        timeZone: "UTC",
        hour12: false,
      });

      const result = streamText({
        model,
        messages,
        system: `You are a helpful, verbose AI assistant that always provides detailed, comprehensive, and multi-paragraph answers. The current date is ${new Date().toLocaleString()}For any factual, informational, or open-ended question, you must use the search web tool to find and include as much relevant information as possible. Your responses should:

- Always be thorough, providing context, lists, facts, and related details.
- Use the web search tool for every question that could benefit from up-to-date or external information, not just when unsure.
- Always cite your sources with clickable markdown links using the format [text](url). For example, instead of writing "https://example.com", write [Example Website](https://example.com).
- When you find relevant information from search results, make sure to:
  1. Format the source URL as a clickable markdown link
  2. Use descriptive text for the link (not just the URL)
  3. Include the link inline with your response
- If a user asks about something that might be outdated or you're unsure about, search the web to provide accurate, up-to-date information.
- Be conversational and helpful, but always back up your claims with properly formatted source links.
- Err on the side of verbosity and completeness. Do not give short or single-sentence answers. Always provide as much useful information as possible.

## Current Date and Time
Today's date is ${currentDate} (UTC time: ${currentTime}). When users ask for "up-to-date" information, "current" information, or "latest" news, use this date to provide context about what "current" means. Always mention the publication dates of sources when discussing time-sensitive information, and explain how recent or current the information is relative to today's date.

## Available Tools

### searchWeb
Use this tool to search the web for current information. This returns search snippets that provide a quick overview of relevant content, including publication dates when available.

### scrapePages
Use this tool when you need to extract the full text content from specific web pages. This is particularly useful when:
- You need detailed information from specific articles or pages
- The search snippets don't provide enough detail
- You want to analyze the complete content of a webpage
- You need to extract structured information from multiple pages

When using scrapePages, provide an array of URLs you want to extract content from. The tool will return the full text content in markdown format for each successfully crawled page.

## IMPORTANT: Always Use scrapePages
After using the searchWeb tool, you MUST ALWAYS use the scrapePages tool to extract the full content from the most relevant URLs found in your search results. Do not rely solely on search snippets - always scrape the actual pages to get complete, detailed information. This ensures you provide the most comprehensive and accurate answers based on the full content of the web pages.

## CRITICAL: Scrape Multiple Diverse Sources
When using the scrapePages tool, you MUST ALWAYS scrape 4-6 different websites to ensure comprehensive coverage. Choose a diverse set of sources including:
- Different types of websites (news sites, blogs, official documentation, academic sources, etc.)
- Different perspectives and viewpoints
- Different domains and publishers
- Both recent and authoritative sources

This diversity ensures you provide well-rounded, comprehensive answers that cover multiple angles and sources of information.
`,
        tools: {
          searchWeb: {
            parameters: z.object({
              query: z.string().describe("The query to search the web for"),
            }),
            execute: async ({ query }, { abortSignal }) => {
              const results = await searchSerper(
                { q: query, num: 10 },
                abortSignal,
              );

              return results.organic.map((result) => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet,
                date: result.date,
              }));
            },
          },
          scrapePages: {
            parameters: z.object({
              urls: z
                .array(z.string())
                .describe(
                  "Array of URLs to scrape and extract full text content from",
                ),
            }),
            execute: async ({ urls }, { abortSignal }) => {
              const result = await bulkCrawlWebsites({ urls });

              if (!result.success) {
                return {
                  error: result.error,
                  results: result.results
                    .filter((r) => r.result.success)
                    .map((r) => ({
                      url: r.url,
                      content: (r.result as any).data,
                    })),
                  failedCrawls: result.results
                    .filter((r) => !r.result.success)
                    .map((r) => ({
                      url: r.url,
                      error: (r.result as any).error,
                    })),
                };
              }

              return {
                results: result.results.map((r) => ({
                  url: r.url,
                  success: r.result.success,
                  content: r.result.data,
                })),
              };
            },
          },
        },
        experimental_telemetry: {
          isEnabled: true,
          functionId: `agent`,
          metadata: {
            langfuseTraceId: trace.id,
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        onFinish: async (res) => {
          const updatedMessages = appendResponseMessages({
            messages,
            responseMessages: res.response.messages,
          });

          const lastMessage = messages[messages.length - 1];
          if (!lastMessage) {
            return;
          }

          // Save the complete chat history
          await upsertChat({
            userId: session.user.id,
            chatId: finalChatId,
            title: lastMessage.content.slice(0, 50) + "...",
            messages: updatedMessages,
          });

          await langfuse.flushAsync();
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (error: unknown) => {
      console.error(error);
      return "Oops, an error occurred!";
    },
  });
}
