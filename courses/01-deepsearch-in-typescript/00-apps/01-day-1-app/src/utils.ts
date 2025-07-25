import type { Message } from "ai";

export function generateChatTitle(messages: Message[]): string {
  // Find the first user message
  const firstUserMessage = messages.find((message) => message.role === "user");

  if (!firstUserMessage?.content) {
    return "New Chat";
  }

  // Take the first 50 characters of the user's message as the title
  const title = firstUserMessage.content.slice(0, 50);

  // If the message is longer than 50 characters, add ellipsis
  return firstUserMessage.content.length > 50 ? `${title}...` : title;
}
