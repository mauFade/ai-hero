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
import { generateChatTitle } from "~/utils";
import { chats } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";

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

  return createDataStreamResponse({
    execute: async (dataStream: DataStreamWriter) => {
      // Send new chat ID if this is a new chat
      if (isNewChat) {
        dataStream.writeData({
          type: "NEW_CHAT_CREATED",
          chatId: finalChatId,
        });
      }

      const result = streamText({
        model,
        messages,
        system: `You are a helpful, verbose AI assistant that always provides detailed, comprehensive, and multi-paragraph answers. For any factual, informational, or open-ended question, you must use the search web tool to find and include as much relevant information as possible. Your responses should:

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
              }));
            },
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
