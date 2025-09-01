import type { Message, TelemetrySettings, StreamTextResult } from "ai";
import { streamText } from "ai";
import { runAgentLoop } from "./run-agent-loop";

export const streamFromDeepSearch = async (opts: {
  messages: Message[];
  onFinish: Parameters<typeof streamText>[0]["onFinish"];
  telemetry: TelemetrySettings;
}): Promise<StreamTextResult<{}, string>> => {
  // Get the user's question from the last message
  const lastMessage = opts.messages[opts.messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user") {
    throw new Error("No user message found");
  }

  // Run the agent loop and return the result
  return runAgentLoop(lastMessage.content);
};

export async function askDeepSearch(messages: Message[]) {
  const result = await streamFromDeepSearch({
    messages,
    onFinish: () => {}, // just a stub
    telemetry: {
      isEnabled: false,
    },
  });

  // Consume the stream - without this,
  // the stream will never finish
  await result.consumeStream();

  return await result.text;
}
