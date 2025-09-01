import ReactMarkdown, { type Components } from "react-markdown";
import type { Message } from "ai";
import { ReasoningSteps } from "./reasoning-steps";
import type { OurMessageAnnotation } from "~/get-next-action";

export type MessagePart = NonNullable<Message["parts"]>[number];

interface ChatMessageProps {
  parts: MessagePart[];
  content?: string;
  role: string;
  userName: string;
  annotations?: OurMessageAnnotation[];
}

const components: Components = {
  p: ({ children }) => <p className="mb-4 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal pl-4">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  code: ({ className, children, ...props }) => (
    <code className={`${className ?? ""}`} {...props}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-lg bg-gray-700 p-4">
      {children}
    </pre>
  ),
  a: ({ children, ...props }) => (
    <a
      className="text-blue-400 underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
};

const Markdown = ({ children }: { children: string }) => {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
};

function ToolInvocationPart({
  part,
}: {
  part: Extract<MessagePart, { type: "tool-invocation" }>;
}) {
  const { toolInvocation } = part;
  const state = toolInvocation.state;
  const stateColor =
    state === "result"
      ? "text-blue-400 underline cursor-pointer"
      : state === "call"
        ? "text-yellow-400"
        : "text-gray-400";

  return (
    <>
      <div className="mb-2 flex flex-col gap-1">
        <div className="text-xs text-gray-400">
          <span className="font-semibold">Tool:</span>{" "}
          <span>{toolInvocation.toolName}</span>
        </div>
        <div className="text-xs text-gray-400">
          <span className="font-semibold">State:</span>{" "}
          <span className={stateColor}>{state}</span>
        </div>
      </div>
      <div className="mb-2">
        <div className="mb-1 text-xs font-semibold text-gray-400">
          Arguments:
        </div>
        <pre className="overflow-x-auto rounded bg-gray-900 p-2 text-xs text-gray-200">
          {JSON.stringify(toolInvocation.args, null, 2)}
        </pre>
      </div>
      {"result" in toolInvocation && toolInvocation.result !== undefined && (
        <div className="mt-2">
          <div className="mb-1 text-xs font-semibold text-gray-400">
            Result:
          </div>
          <pre className="overflow-x-auto rounded bg-gray-900 p-2 text-xs text-gray-200">
            {JSON.stringify(toolInvocation.result, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}

export const ChatMessage = ({
  parts,
  content,
  role,
  userName,
  annotations,
}: ChatMessageProps) => {
  const isAI = role === "assistant";

  return (
    <div className="mb-4 w-full">
      <div className="mx-auto max-w-3xl rounded-lg border border-gray-700 bg-gray-800 p-6">
        <div className="mb-1 text-base font-bold text-white">
          {isAI ? "AI" : userName}
        </div>
        <div className="space-y-1">
          {/* Show reasoning steps for AI messages */}
          {isAI && annotations && annotations.length > 0 && (
            <ReasoningSteps annotations={annotations} />
          )}
          {content ? (
            <div className="text-[1.05rem] leading-relaxed text-gray-200">
              <Markdown>{content}</Markdown>
            </div>
          ) : (
            parts.map((part, i) => {
              if (part.type === "text") {
                return (
                  <div
                    key={i}
                    className="text-[1.05rem] leading-relaxed text-gray-200"
                  >
                    <Markdown>{part.text}</Markdown>
                  </div>
                );
              }
              if (part.type === "tool-invocation") {
                return <ToolInvocationPart key={i} part={part} />;
              }
              // For other types, show a subtle label
              return (
                <div key={i} className="mb-1 text-xs text-gray-500 opacity-70">
                  [Unhandled MessagePart: {part.type}]
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
