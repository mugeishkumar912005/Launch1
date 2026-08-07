import Groq from "groq-sdk";


export interface MetadataInput {
  title: string;
  description: string;
}

export async function rewriteMetadata({
  title,
  description,
}: MetadataInput) {
  const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY!,
  });

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile", 
    temperature: 0.7,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: `You are an expert YouTube SEO copywriter.

      Rewrite ONLY the title and description.

        Rules:
        - Preserve the original meaning.
        - Make the title compelling but not clickbait.
        - Keep the title under 100 characters.
        - Improve the description for readability and SEO.
        - add only youtube trending tags that make the video perform better.
        - add hashtags.
        - generate tags.
        - Do NOT invent facts.
        - Return ONLY valid JSON.

        Expected format:
        {
          "title": "...",
          "description": "..."
        }`,
      },
      {
        role: "user",
        content: JSON.stringify({
          title,
          description,
        }),
      },
    ],
  });

  const content = completion.choices[0].message.content;

  if (!content) {
    throw new Error("No response received from Groq");
  }

  return JSON.parse(content);
}