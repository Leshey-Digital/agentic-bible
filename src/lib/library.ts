import { getCollection } from 'astro:content';
import {checkedReaderInventory} from './article-inventory.ts';

export const topics = [
  { id: 'foundations', name: 'Foundations', number: '01', description: 'The ideas behind systems that reason, act, and adapt.' },
  { id: 'capabilities', name: 'Capabilities', number: '02', description: 'How models reach beyond the conversation.' },
  { id: 'protocols', name: 'Protocols', number: '03', description: 'The shared interfaces that connect the pieces.' },
] as const;

export async function library() {
  return checkedReaderInventory(await getCollection('articles'));
}

export const articleUrl = (id: string) => `/articles/${id}/`;
export const topicUrl = (topic: string) => `/topics/${topic.toLowerCase()}/`;
export const repository = 'https://github.com/Leshey-Digital/agentic-bible';
export const sourceCommit: string|null = import.meta.env.PUBLIC_AGENTIC_BIBLE_SOURCE_COMMIT ?? null;
