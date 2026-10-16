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
    status: z.enum(['Working draft','Published local demonstration']),
    verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    author: z.enum(['AI-assisted project draft','Supplied local demonstration']),
    publication: z.object({
      revisionId:z.string().regex(/^[a-f0-9]{64}$/),publisherSnapshot:z.string().regex(/^[a-f0-9]{64}$/),
      flags:z.array(z.enum(['editorial-review','source-recency','coverage-gap','limited-source-coverage'])),
      evidence:z.array(z.object({citationId:z.string(),sourceId:z.string(),url:z.url(),hash:z.string().regex(/^[a-f0-9]{64}$/),receiptKey:z.string()})),
    }).optional(),
    related: z.array(z.string()).min(1),
    sources: z.array(z.object({
      id: z.string(), title: z.string(), url: z.url(),
      publisher: z.string(), context: z.string(),
    })).min(2),
  }),
});

export const collections = { articles };
