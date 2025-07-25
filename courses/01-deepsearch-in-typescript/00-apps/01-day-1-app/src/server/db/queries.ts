import { eq, desc, and } from "drizzle-orm";
import type { Message } from "ai";
import { db } from "./index";
import { chats, messages, users } from "./schema";

export const upsertChat = async (opts: {
  userId: string;
  chatId: string;
  title: string;
  messages: Message[];
}) => {
  const { userId, chatId, title, messages: chatMessages } = opts;

  // Check if the chat exists and belongs to the user
  const existingChat = await db.query.chats.findFirst({
    where: eq(chats.id, chatId),
  });

  if (existingChat) {
    if (existingChat.userId !== userId) {
      throw new Error("Chat not found");
    }
    await db.delete(messages).where(eq(messages.chatId, chatId));
  } else {
    await db.insert(chats).values({
      id: chatId,
      title,
      userId,
    });
  }

  await db.insert(messages).values(
    chatMessages.map((message, index) => ({
      id: crypto.randomUUID(),
      chatId,
      role: message.role,
      parts: message.content,
      order: index,
    })),
  );
};

export const getChat = async (opts: { userId: string; chatId: string }) => {
  const { userId, chatId } = opts;

  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      messages: {
        orderBy: (messages, { asc }) => [asc(messages.order)],
      },
    },
  });

  if (!chat) return null;

  return chat;
};

export const getChats = async (opts: { userId: string }) => {
  const { userId } = opts;

  return await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: (chats, { desc }) => [desc(chats.updatedAt)],
  });
};
