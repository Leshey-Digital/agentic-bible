import { getCollection } from 'astro:content';

export const topics = [
  { id: 'foundations', name: 'Foundations', number: '01', description: 'The ideas behind systems that reason, act, and adapt.' },
  { id: 'capabilities', name: 'Capabilities', number: '02', description: 'How models reach beyond the conversation.' },
  { id: 'protocols', name: 'Protocols', number: '03', description: 'The shared interfaces that connect the pieces.' },
] as const;

export async function library() {
  return (await getCollection('articles')).sort((a, b) => a.data.order - b.data.order);
}

export const articleUrl = (id: string) => `/articles/${id}/`;
export const topicUrl = (topic: string) => `/topics/${topic.toLowerCase()}/`;
export const repository = 'https://github.com/Leshey-Digital/agentic-bible';
export const sourceBranch = 'feat/reference-library-slice';
