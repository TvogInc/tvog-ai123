import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl, fileType, fileName, prompt } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Determine if this is an image or document
    const isImage = fileType?.startsWith("image/");
    
    let messages: any[];

    if (isImage) {
      // For images, use vision capabilities
      messages = [
        {
          role: "system",
          content: "You are a helpful AI assistant that analyzes images. Provide detailed descriptions and insights about what you see in the image."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt || `Please analyze this image (${fileName}) and describe what you see in detail.`
            },
            {
              type: "image_url",
              image_url: {
                url: fileUrl
              }
            }
          ]
        }
      ];
    } else {
      // For documents/text files, fetch the actual file content first
      console.log("Fetching file content from:", fileUrl);
      
      let fileContent = "";
      try {
        const fileResponse = await fetch(fileUrl);
        if (fileResponse.ok) {
          fileContent = await fileResponse.text();
          console.log("File content fetched, length:", fileContent.length);
        } else {
          console.error("Failed to fetch file:", fileResponse.status);
          throw new Error(`Failed to fetch file: ${fileResponse.status}`);
        }
      } catch (fetchError) {
        console.error("Error fetching file:", fetchError);
        throw new Error("Could not fetch file content");
      }

      messages = [
        {
          role: "system",
          content: "You are a helpful AI assistant that analyzes documents, code, and files. Provide detailed insights, explanations, and answer questions about the content. When analyzing code, explain what it does, how it works, and any notable patterns or issues."
        },
        {
          role: "user",
          content: `Here is the content of the file "${fileName}":\n\n\`\`\`\n${fileContent}\n\`\`\`\n\n${prompt || "Please analyze this file and explain what it does."}`
        }
      ];
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Unable to analyze the file.";

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-file error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
