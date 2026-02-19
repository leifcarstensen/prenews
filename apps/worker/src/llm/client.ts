import { AzureOpenAI } from "openai";

let _client: AzureOpenAI | null = null;
let _imageClient: AzureOpenAI | null = null;

/** Azure OpenAI client for text (article generation, enrichment) */
export function getAzureClient(): AzureOpenAI {
  if (_client) return _client;

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

  if (!endpoint || !apiKey) {
    throw new Error("AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY are required");
  }

  _client = new AzureOpenAI({
    endpoint,
    apiKey,
    apiVersion,
  });

  return _client;
}

/**
 * Azure OpenAI client for image generation.
 * Falls back to the text client credentials if separate image credentials aren't set.
 */
export function getAzureImageClient(): AzureOpenAI {
  if (_imageClient) return _imageClient;

  // Use dedicated image credentials if available, otherwise fall back to text credentials
  const endpoint = process.env.AZURE_OPENAI_IMAGE_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_IMAGE_API_KEY || process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_IMAGE_API_VERSION || process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

  if (!endpoint || !apiKey) {
    throw new Error("AZURE_OPENAI_IMAGE_ENDPOINT/AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_IMAGE_API_KEY/AZURE_OPENAI_API_KEY are required for image generation");
  }

  _imageClient = new AzureOpenAI({
    endpoint,
    apiKey,
    apiVersion,
  });

  return _imageClient;
}

export function getDeployment(): string {
  return process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
}

export function getImageDeployment(): string {
  return process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT || "gpt-image-1-5";
}
