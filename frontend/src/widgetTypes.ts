/**
 * Shared TypeScript interfaces used across multiple widgets.
 * Import from here instead of re-declaring locally.
 */

/** A single news article from any RSS feed. description is optional — not all feeds include it. */
export interface NewsItem {
  title:        string;
  link:         string;
  pub_date:     string;
  description?: string;
}

/** A source-agnostic collection of news items with a feed label. */
export interface NewsData {
  items:  NewsItem[];
  source: string;
}

/** A quote with attribution — used by QuoteWidget and GreetingWidget. */
export interface Quote {
  text:   string;
  author: string;
}
