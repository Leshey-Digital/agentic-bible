/**
 * Conservative prompt-token reservation for Cloudflare's pinned Llama 3.2 1B
 * model. This is only valid when the caller sends raw text with `raw: true`.
 * Cloudflare documents that `raw: false` applies a chat template but does not
 * publish a token ceiling for that framing, so the factory refuses that mode.
 *
 * Llama 3's published tokenizer is byte-level BPE: every input UTF-8 byte has
 * a base token and merges can only reduce the number of tokens. Reserve one
 * additional token for a possible beginning-of-sequence token. The model's
 * documented context window is 60,000 tokens; values outside it fail closed.
 */

export const cloudflareLlama32Model = '@cf/meta/llama-3.2-1b-instruct';
export const cloudflareLlama32ContextTokens = 60_000;

export interface CloudflareLlama32InputBoundOptions {
  /** Must match the actual AI.run request's `raw` parameter. */
  rawPrompt: boolean;
}

function wellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/**
 * Construct the input-token upper bound only when raw prompt mode is enabled.
 * Invalid text and prompts exceeding the published model context throw before
 * dispatch, allowing the accounting adapter to fail closed without a provider
 * call. Chat-template overhead is deliberately not guessed.
 */
export function createCloudflareLlama32InputTokenUpperBound(
  options: CloudflareLlama32InputBoundOptions,
): (prompt: string) => number {
  if (!options || options.rawPrompt !== true) {
    throw new Error('cloudflare_llama32_raw_prompt_required');
  }

  return (prompt: string): number => {
    if (typeof prompt !== 'string' || prompt.length === 0 || !wellFormedUnicode(prompt)) {
      throw new Error('cloudflare_llama32_prompt_invalid');
    }

    const byteLength = new TextEncoder().encode(prompt).byteLength;
    const upperBound = byteLength + 1;
    if (!Number.isSafeInteger(upperBound) || upperBound > cloudflareLlama32ContextTokens) {
      throw new Error('cloudflare_llama32_prompt_bound_exceeds_context');
    }
    return upperBound;
  };
}
