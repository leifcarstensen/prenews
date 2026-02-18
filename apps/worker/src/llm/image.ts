import { getAzureClient, getImageDeployment } from "./client.js";

/**
 * Generate a header image for a market article using GPT-image-1.5.
 *
 * This is a stub — image storage integration is deferred.
 * When ready, this will:
 * 1. Generate the image via Azure OpenAI
 * 2. Upload to blob storage (Azure Blob / Cloudflare R2 / Vercel Blob)
 * 3. Return the public URL
 *
 * For now, it returns null and logs the prompt for debugging.
 */
export async function generateArticleImage(params: {
  marketId: string;
  prompt: string;
}): Promise<string | null> {
  const deployment = getImageDeployment();

  if (!process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT) {
    console.log(JSON.stringify({
      job: "image-generation",
      status: "skipped",
      reason: "AZURE_OPENAI_IMAGE_DEPLOYMENT not configured",
      marketId: params.marketId,
      prompt: params.prompt.slice(0, 100) + "...",
    }));
    return null;
  }

  try {
    const client = getAzureClient();

    const response = await client.images.generate({
      model: deployment,
      prompt: params.prompt,
      n: 1,
      size: "1792x1024",
      quality: "high",
    });

    const imageData = response.data?.[0];
    if (!imageData) {
      console.warn(`No image data returned for market ${params.marketId}`);
      return null;
    }

    // TODO: Upload to blob storage and return public URL
    // For now, return the temporary URL if available
    if (imageData.url) {
      console.log(JSON.stringify({
        job: "image-generation",
        status: "generated",
        marketId: params.marketId,
        note: "image generated but storage not configured — URL is temporary",
      }));
      return imageData.url;
    }

    return null;
  } catch (err) {
    console.warn(`Image generation failed for market ${params.marketId}:`, err);
    return null;
  }
}
