import type { Message } from "ai";

export type SearchResult = {
  date: string;
  title: string;
  url: string;
  snippet: string;
  summary: string;
};

export type SearchHistoryEntry = {
  query: string;
  results: SearchResult[];
};

export class SystemContext {
  /**
   * The current step in the loop
   */
  private step = 0;

  /**
   * The history of all searches with their associated scraped content
   */
  private searchHistory: SearchHistoryEntry[] = [];

  /**
   * The conversation history
   */
  private conversationHistory: Message[];

  constructor(conversationHistory: Message[] = []) {
    this.conversationHistory = conversationHistory;
  }

  shouldStop() {
    return this.step >= 10;
  }

  getStep() {
    return this.step;
  }

  incrementStep() {
    this.step++;
  }

  getConversationHistory(): string {
    if (this.conversationHistory.length === 0) {
      return "";
    }

    return this.conversationHistory
      .map((message) => {
        const role = message.role === "user" ? "User" : "Assistant";
        return `<${role}>${message.content}</${role}>`;
      })
      .join("\n\n");
  }

  reportSearch(search: SearchHistoryEntry) {
    this.searchHistory.push(search);
  }

  getSearchHistory(): string {
    return this.searchHistory
      .map((search) =>
        [
          `## Query: "${search.query}"`,
          ...search.results.map((result) =>
            [
              `### ${result.date} - ${result.title}`,
              result.url,
              result.snippet,
              `<summary>`,
              result.summary,
              `</summary>`,
            ].join("\n\n"),
          ),
        ].join("\n\n"),
      )
      .join("\n\n");
  }

  
}
