import type { Message } from "ai";
import {
  createDataStreamResponse,
  type DataStreamWriter,
  appendResponseMessages,
} from "ai";
import { auth } from "~/server/auth";
import { upsertChat } from "~/server/db/queries";
import { chats } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { Langfuse } from "langfuse";
import { env } from "~/env";
import { streamFromDeepSearch } from "~/deep-search";
import type { OurMessageAnnotation } from "~/get-next-action";

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

      // Collect annotations in memory
      const annotations: OurMessageAnnotation[] = [];

      // 1. Wait for the result
      const result = await streamFromDeepSearch({
        messages,
        onFinish: async (res) => {
          const updatedMessages = appendResponseMessages({
            messages,
            responseMessages: res.response.messages,
          });

          const lastMessage = messages[messages.length - 1];
          if (!lastMessage) {
            return;
          }

          lastMessage.annotations = annotations as any;
          // Save the complete chat history
          await upsertChat({
            userId: session.user.id,
            chatId: finalChatId,
            title: lastMessage.content.slice(0, 50) + "...",
            messages: updatedMessages,
          });

          await langfuse.flushAsync();
        },
        telemetry: {
          isEnabled: true,
          functionId: `agent`,
          metadata: {
            langfuseTraceId: trace.id,
          },
        },
        writeMessageAnnotation: (annotation) => {
          // Save the annotation in memory
          annotations.push(annotation);
          // Send it to the client
          dataStream.writeMessageAnnotation(annotation as any);
        },
      });

      // 2. Once the result is ready, merge it into the data stream
      result.mergeIntoDataStream(dataStream);
    },
    onError: (error: unknown) => {
      console.error(error);
      return "Oops, an error occurred!";
    },
  });
}
