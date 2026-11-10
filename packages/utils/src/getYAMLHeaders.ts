import z from 'zod';
import matter from 'gray-matter';
import fs from 'fs';

/**
 * Reuseable function to validate a YAML header of a .md file this function can be used to validate
 * rules , skills file
 * @argument schema zod schema of expected headers
 * @argument path filesystem location of target file
 */
export async function getYamlHeaders<HeaderSchema extends z.ZodType>(
  schema: HeaderSchema,
  filePath: string,
): Promise<
  | {
      success: false;
    }
  | {
      success: true;
      headers: z.infer<HeaderSchema>;
      content: string;
    }
> {
  const fileContent = await fs.promises.readFile(filePath, 'utf-8');
  const { data, content } = matter(fileContent); // data = parsed YAML , content = Markdown body
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { success: false };
  } else {
    return {
      success: parsed.success,
      headers: parsed.data,
      content,
    };
  }
}
