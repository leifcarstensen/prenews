import { getAzureImageClient, getImageDeployment } from "./client.js";
import { put } from "@vercel/blob";

/**
 * Generate a header image for a market article using GPT-image-1.5.
 *
 * 1. Generate the image via Azure OpenAI
 * 2. Upload to Vercel Blob for permanent CDN-backed storage
 * 3. Return the public URL
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
    }));
    return null;
  }

  try {
    const client = getAzureImageClient();

    console.log(JSON.stringify({
      job: "image-generation",
      status: "calling-api",
      marketId: params.marketId,
      deployment,
      endpoint: process.env.AZURE_OPENAI_IMAGE_ENDPOINT ? "set" : "fallback-to-text",
    }));

    const response = await client.images.generate({
      model: deployment,
      prompt: params.prompt,
      n: 1,
      size: "1024x1024",
    });

    const imageData = response.data?.[0];
    if (!imageData) {
      console.warn(`No image data returned for market ${params.marketId}`);
      return null;
    }

    // If we have a URL, fetch the image and upload to Vercel Blob
    if (imageData.url) {
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const imageResponse = await fetch(imageData.url);
        if (!imageResponse.ok) {
          console.warn(`Failed to fetch generated image for market ${params.marketId}: ${imageResponse.status}`);
          return null;
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const blob = await put(
          `articles/${params.marketId}.png`,
          Buffer.from(imageBuffer),
          {
            access: "public",
            contentType: "image/png",
            addRandomSuffix: false,
          },
        );

        console.log(JSON.stringify({
          job: "image-generation",
          status: "stored",
          marketId: params.marketId,
          url: blob.url,
        }));

        return blob.url;
      }

      // Fallback: return temp URL if Vercel Blob not configured
      console.log(JSON.stringify({
        job: "image-generation",
        status: "generated",
        marketId: params.marketId,
        note: "BLOB_READ_WRITE_TOKEN not set — returning temporary URL",
      }));
      return imageData.url;
    }

    // If we have base64 data, upload directly
    if (imageData.b64_json) {
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const imageBuffer = Buffer.from(imageData.b64_json, "base64");
        const blob = await put(
          `articles/${params.marketId}.png`,
          imageBuffer,
          {
            access: "public",
            contentType: "image/png",
            addRandomSuffix: false,
          },
        );

        console.log(JSON.stringify({
          job: "image-generation",
          status: "stored",
          marketId: params.marketId,
          url: blob.url,
        }));

        return blob.url;
      }
    }

    return null;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStatus = (err as { status?: number })?.status;
    console.error(JSON.stringify({
      job: "image-generation",
      status: "error",
      marketId: params.marketId,
      error: errMsg,
      httpStatus: errStatus ?? null,
      deployment,
    }));
    return null;
  }
}
