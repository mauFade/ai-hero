import type { Message, TelemetrySettings, StreamTextResult } from "ai";
import { streamText } from "ai";
import { runAgentLoop } from "./run-agent-loop";
import type { OurMessageAnnotation } from "./get-next-action";

export const streamFromDeepSearch = async (opts: {
  messages: Message[];
  onFinish: Parameters<typeof streamText>[0]["onFinish"];
  telemetry: TelemetrySettings;
  writeMessageAnnotation: (annotation: OurMessageAnnotation) => void;
}): Promise<StreamTextResult<{}, string>> => {
  // Get the user's question from the last message
  const lastMessage = opts.messages[opts.messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user") {
    throw new Error("No user message found");
  }

  // Extract langfuseTraceId from telemetry metadata
  const langfuseTraceId = typeof opts.telemetry.metadata?.langfuseTraceId === 'string' 
    ? opts.telemetry.metadata.langfuseTraceId 
    : "";

  // Run the agent loop and return the result
  return runAgentLoop(lastMessage.content, {
    writeMessageAnnotation: opts.writeMessageAnnotation,
    langfuseTraceId,
  });
};

export async function askDeepSearch(messages: Message[]) {
  const result = await streamFromDeepSearch({
    messages,
    onFinish: () => {}, // just a stub
    telemetry: {
      isEnabled: false,
    },
    writeMessageAnnotation: () => {}, // no-op for evals
  });

  // Consume the stream - without this,
  // the stream will never finish
  await result.consumeStream();

  return await result.text;
}
