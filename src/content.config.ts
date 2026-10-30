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
    status: z.enum(['Working draft','Published local demonstration','Published source-backed maintenance']),
    verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    author: z.enum(['AI-assisted project draft','Supplied local demonstration','AI-assisted sourced maintenance']),
    publication: z.object({
      revisionId:z.string().regex(/^[a-f0-9]{64}$/),publisherSnapshot:z.string().regex(/^[a-f0-9]{64}$/).optional(),
      schemaVersion:z.literal(2).optional(),sourceBacked:z.object({qualityReceiptHash:z.string().regex(/^[a-f0-9]{64}$/),generationEventId:z.string().regex(/^cfa-[a-f0-9]{48}$/)}).optional(),
      flags:z.array(z.enum(['editorial-review','source-recency','coverage-gap','limited-source-coverage'])),
      restoration:z.object({approvalId:z.uuid(),requestId:z.uuid(),restoredFromRevision:z.string().regex(/^[a-f0-9]{64}$/),previousRevision:z.string().regex(/^[a-f0-9]{64}$/)}).optional(),
      reviewedCorrections:z.array(z.object({approvalId:z.uuid(),submissionId:z.uuid(),submissionVersion:z.number().int().positive(),reviewer:z.literal('local-editor'),approvedAt:z.number().int().nonnegative()})).max(6).optional(),
      evidence:z.array(z.object({citationId:z.string(),sourceId:z.string(),url:z.url(),hash:z.string().regex(/^[a-f0-9]{64}$/),receiptKey:z.string()})),
    }).superRefine((value,ctx)=>{if(value.schemaVersion===2?(!value.sourceBacked||value.publisherSnapshot!==undefined):(!value.publisherSnapshot||value.sourceBacked!==undefined))ctx.addIssue({code:'custom',message:'Publication provenance metadata mismatch'});}).optional(),
    related: z.array(z.string().max(50).regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/)).min(1),
    sources: z.array(z.object({
      id: z.string().max(50).regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/), title: z.string(), url: z.url(),
      publisher: z.string(), context: z.string(),
    })).min(1),
  }),
});

export const collections = { articles };
