import { fal } from "@fal-ai/client";

// Configure fal.ai client
fal.config({
  credentials: import.meta.env.VITE_FAL_API_KEY
});

interface ImageGenerationResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

interface BriaBackgroundRemoveOutput {
  image: {
    url: string;
  };
}

async function removeBackground(imageUrl: string): Promise<string> {
  try {
    const result = await fal.subscribe("fal-ai/bria/background/remove", {
      input: {
        image_url: imageUrl
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    });

    if (!result.data || !result.data.image?.url) {
      throw new Error('No image URL in background removal response');
    }

    return result.data.image.url;
  } catch (error) {
    console.error('Background removal failed:', error);
    throw error;
  }
}

export async function generateImage(prompt: string): Promise<string | null> {
  try {
    console.log('Generating image with prompt:', prompt);
    
    // Ensure consistent style and background
    const enhancedPrompt = `${prompt}. High-quality 3D rendered character in the exact style of Disney's Zootopia - modern, expressive, and detailed 3D animation with careful attention to fur texture and facial expressions. The character should be highly expressive with clear emotions, maintaining the high production quality of a Disney/Pixar animated film. Pure white background only - no environmental elements.`;
    
    const response = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell",
        prompt: enhancedPrompt,
        steps: 10,
        n: 1,
        size: "1024x1024",
        negative_prompt: "2D, flat, cartoon, simple, minimalist, line drawing, sketch, Mo Willems style, children's book illustration, background elements, scene elements, environment, setting, context, anything except the character and white background"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    const data: ImageGenerationResponse = await response.json();
    console.log('API Response:', data);

    // Get the image URL from the response
    let imageUrl: string;
    if (data.data[0].url) {
      imageUrl = data.data[0].url;
    } else if (data.data[0].b64_json) {
      // If we get base64, we need to create a temporary URL for it
      const blob = await fetch(`data:image/png;base64,${data.data[0].b64_json}`).then(r => r.blob());
      imageUrl = URL.createObjectURL(blob);
    } else {
      throw new Error('No image data in response');
    }

    // Remove background using fal.ai
    try {
      const imageWithoutBg = await removeBackground(imageUrl);
      
      // If we created a temporary URL, clean it up
      if (data.data[0].b64_json) {
        URL.revokeObjectURL(imageUrl);
      }
      
      return imageWithoutBg;
    } catch (bgError) {
      console.error('Background removal failed, returning original image:', bgError);
      return imageUrl;
    }
  } catch (error) {
    console.error('Failed to generate image:', error);
    return null;
  }
} 