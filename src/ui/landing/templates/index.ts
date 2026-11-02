import { assistant } from "./assistant";
import type { Template } from "./build";
import { chat } from "./chat";
import { ecommerce } from "./ecommerce";
import { urlShortener } from "./urlShortener";

export type { Template };

export const templates: Template[] = [urlShortener, ecommerce, chat, assistant];
