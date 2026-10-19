import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cloudflareLlama32ContextTokens,
  cloudflareLlama32Model,
  createCloudflareLlama32InputTokenUpperBound,
} from '../../src/maintenance-adapters/cloudflare-llama32-input-bound.ts';

test('pins the upper bound to the documented Cloudflare model and context limit', () => {
  assert.equal(cloudflareLlama32Model, '@cf/meta/llama-3.2-1b-instruct');
  assert.equal(cloudflareLlama32ContextTokens, 60_000);
});

test('reserves UTF-8 bytes plus a BOS token for raw prompts, including Unicode', () => {
  const bound = createCloudflareLlama32InputTokenUpperBound({ rawPrompt: true });
  for (const prompt of ['Hello, world!', 'café', '東京 🦊', '<|begin_of_text|> literal']) {
    assert.equal(bound(prompt), new TextEncoder().encode(prompt).byteLength + 1);
  }
});

test('refuses chat-templated mode because official docs publish no framing ceiling', () => {
  assert.throws(
    () => createCloudflareLlama32InputTokenUpperBound({ rawPrompt: false }),
    { message: 'cloudflare_llama32_raw_prompt_required' },
  );
});

test('fails closed for empty, malformed, or over-context prompts', () => {
  const bound = createCloudflareLlama32InputTokenUpperBound({ rawPrompt: true });
  assert.throws(() => bound(''), { message: 'cloudflare_llama32_prompt_invalid' });
  assert.throws(() => bound('\ud800'), { message: 'cloudflare_llama32_prompt_invalid' });
  assert.throws(
    () => bound('x'.repeat(cloudflareLlama32ContextTokens)),
    { message: 'cloudflare_llama32_prompt_bound_exceeds_context' },
  );
  assert.equal(bound('x'.repeat(cloudflareLlama32ContextTokens - 1)), cloudflareLlama32ContextTokens);
});
