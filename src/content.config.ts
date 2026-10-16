import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    topic: z.enum(['Foundations', 'Capabilities', 'Protocols']),
    order: z.number().int().positive(),
    status: z.literal('Working draft'),
    verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    author: z.literal('AI-assisted project draft'),
    related: z.array(z.string()).min(1),
    sources: z.array(z.object({
      id: z.string(), title: z.string(), url: z.url(),
      publisher: z.string(), context: z.string(),
    })).min(2),
  }),
});

export const collections = { articles };
