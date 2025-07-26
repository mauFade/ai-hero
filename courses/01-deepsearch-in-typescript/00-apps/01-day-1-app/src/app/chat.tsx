"use client";

import { ChatMessage } from "~/components/chat-message";
import { useChat } from "@ai-sdk/react";
import { Send, Loader } from "lucide-react";
import { SignInModal } from "~/components/sign-in-modal";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNewChatCreated } from "~/utils";
import type { Message } from "ai";
import { StickToBottom } from "use-stick-to-bottom";

interface ChatProps {
  userName: string;
  chatId: string | undefined;
  isAuthenticated: boolean;
  initialMessages: Message[];
}

export const ChatPage = ({ userName, chatId, initialMessages }: ChatProps) => {
  const router = useRouter();
  const { messages, input, handleInputChange, handleSubmit, isLoading, data } =
    useChat({
      body: {
        chatId,
      },
      initialMessages,
    });
  const { status } = useSession();
  const [modalOpen, setModalOpen] = useState(true);

  // Show modal if unauthenticated
  const showSignInModal = status === "unauthenticated" && modalOpen;

  // Handle new chat creation redirect
  useEffect(() => {
    const lastDataItem = data?.[data.length - 1];

    if (lastDataItem && isNewChatCreated(lastDataItem)) {
      router.push(`?id=${lastDataItem.chatId}`);
    }
  }, [data, router]);

  return (
    <>
      <div className="flex flex-1 flex-col">
        <StickToBottom
          className="mx-auto w-full max-w-[65ch] flex-1 overflow-y-auto p-4 [&>div]:scrollbar-thin [&>div]:scrollbar-track-gray-800 [&>div]:scrollbar-thumb-gray-600 [&>div]:hover:scrollbar-thumb-gray-500"
          resize="smooth"
          initial="smooth"
          role="log"
          aria-label="Chat messages"
        >
          <StickToBottom.Content className="flex flex-col gap-4">
            {messages.map((message, index) => {
              return (
                <ChatMessage
                  key={index}
                  parts={message.parts}
                  content={message.content}
                  role={message.role}
                  userName={userName}
                />
              );
            })}
          </StickToBottom.Content>
        </StickToBottom>

        <div className="border-t border-gray-700">
          <form onSubmit={handleSubmit} className="mx-auto max-w-[65ch] p-4">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Say something..."
                autoFocus
                aria-label="Chat input"
                className="flex-1 rounded border border-gray-700 bg-gray-800 p-2 text-gray-200 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex items-center justify-center rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-600 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:hover:bg-gray-700"
                aria-label={isLoading ? "Loading" : "Send"}
              >
                {isLoading ? (
                  <Loader className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      <SignInModal
        isOpen={showSignInModal}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
};
