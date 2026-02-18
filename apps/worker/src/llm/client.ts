import { AzureOpenAI } from "openai";

let _client: AzureOpenAI | null = null;

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

export function getDeployment(): string {
  return process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
}

export function getImageDeployment(): string {
  return process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT || "gpt-image-1-5";
}
