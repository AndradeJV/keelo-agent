import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config, getLLMConfig, DEFAULT_MODELS, logger } from '../config/index.js';

// =============================================================================
// LLM Clients
// =============================================================================

const openai = config.llm.openai.apiKey 
  ? new OpenAI({ apiKey: config.llm.openai.apiKey })
  : null;

const anthropic = config.llm.anthropic.apiKey
  ? new Anthropic({ apiKey: config.llm.anthropic.apiKey })
  : null;

// =============================================================================
// Unified LLM Call
// =============================================================================

export interface LLMCallOptions {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Base64 encoded image for vision analysis */
  imageBase64?: string;
  /** Image URL for vision analysis */
  imageUrl?: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export async function callLLM(options: LLMCallOptions): Promise<string> {
  const llmConfig = getLLMConfig();
  const {
    systemPrompt,
    userPrompt,
    jsonMode = true,
    maxTokens = llmConfig.maxTokens,
    temperature = llmConfig.temperature,
    imageBase64,
    imageUrl,
  } = options;

  const hasImage = !!(imageBase64 || imageUrl);

  if (llmConfig.provider === 'anthropic') {
    return callAnthropic(systemPrompt, userPrompt, maxTokens, jsonMode, imageBase64, imageUrl);
  } else {
    return callOpenAI(systemPrompt, userPrompt, maxTokens, temperature, jsonMode, imageBase64, imageUrl);
  }
}

/**
 * Call LLM and return response with token usage
 */
export async function callLLMWithUsage(options: LLMCallOptions): Promise<LLMResponse> {
  const llmConfig = getLLMConfig();
  const {
    systemPrompt,
    userPrompt,
    jsonMode = true,
    maxTokens = llmConfig.maxTokens,
    imageBase64,
    imageUrl,
  } = options;

  if (llmConfig.provider === 'anthropic') {
    return callAnthropicWithUsage(systemPrompt, userPrompt, maxTokens, jsonMode, imageBase64, imageUrl);
  } else {
    // For OpenAI, estimate tokens (OpenAI SDK doesn't always return usage in streaming)
    const content = await callOpenAI(systemPrompt, userPrompt, maxTokens, llmConfig.temperature, jsonMode, imageBase64, imageUrl);
    const estimatedInput = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    const estimatedOutput = Math.ceil(content.length / 4);
    return {
      content,
      usage: {
        inputTokens: estimatedInput,
        outputTokens: estimatedOutput,
        totalTokens: estimatedInput + estimatedOutput,
      },
    };
  }
}

async function callAnthropicWithUsage(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  jsonMode: boolean,
  imageBase64?: string,
  imageUrl?: string
): Promise<LLMResponse> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  const llmConfig = getLLMConfig();
  const model = llmConfig.model || DEFAULT_MODELS.anthropic;

  const systemWithJson = jsonMode
    ? systemPrompt + '\n\nIMPORTANT: You must respond with valid JSON only. No text before or after the JSON object.'
    : systemPrompt;

  const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

  if (imageBase64) {
    const mediaTypeMatch = imageBase64.match(/^data:(image\/[^;]+);base64,/);
    const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : 'image/png';
    const base64Data = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: base64Data,
      },
    });
  } else if (imageUrl) {
    content.push({
      type: 'image',
      source: { type: 'url', url: imageUrl },
    } as Anthropic.ImageBlockParam);
  }

  content.push({ type: 'text', text: userPrompt });

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemWithJson,
    messages: [{ role: 'user', content }],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  const responseContent = textBlock && 'text' in textBlock ? textBlock.text : '{}';

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  return {
    content: jsonMode ? extractJSON(responseContent) : responseContent,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
  };
}

// =============================================================================
// Anthropic (Claude) Integration with Vision
// =============================================================================

async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  jsonMode: boolean,
  imageBase64?: string,
  imageUrl?: string
): Promise<string> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  const llmConfig = getLLMConfig();
  // Use vision model if image is provided
  const hasImage = !!(imageBase64 || imageUrl);
  const model = llmConfig.model || DEFAULT_MODELS.anthropic;

  const systemWithJson = jsonMode
    ? systemPrompt + '\n\nIMPORTANT: You must respond with valid JSON only. No text before or after the JSON object.'
    : systemPrompt;

  // Build message content
  const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

  // Add image if provided
  if (imageBase64) {
    // Parse base64 to extract media type
    const mediaTypeMatch = imageBase64.match(/^data:(image\/[^;]+);base64,/);
    const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : 'image/png';
    const base64Data = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');

    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: base64Data,
      },
    });
  } else if (imageUrl) {
    content.push({
      type: 'image',
      source: {
        type: 'url',
        url: imageUrl,
      },
    } as Anthropic.ImageBlockParam);
  }

  // Add text prompt
  content.push({
    type: 'text',
    text: userPrompt,
  });

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemWithJson,
    messages: [
      { role: 'user', content },
    ],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  const responseContent = textBlock && 'text' in textBlock ? textBlock.text : '{}';

  logger.info({ 
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    stopReason: response.stop_reason,
    model,
    provider: 'anthropic',
    hasImage,
  }, 'LLM response received');

  // Extract JSON from response if needed
  return jsonMode ? extractJSON(responseContent) : responseContent;
}

// =============================================================================
// OpenAI Integration with Vision
// =============================================================================

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
  jsonMode: boolean,
  imageBase64?: string,
  imageUrl?: string
): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  const llmConfig = getLLMConfig();
  const hasImage = !!(imageBase64 || imageUrl);
  // Use vision model if image is provided
  const model = hasImage 
    ? 'gpt-4o' // GPT-4o supports vision
    : (llmConfig.model || DEFAULT_MODELS.openai);

  // Build message content
  type ContentPart = OpenAI.ChatCompletionContentPart;
  const content: ContentPart[] = [];

  // Add image if provided
  if (imageBase64) {
    content.push({
      type: 'image_url',
      image_url: {
        url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`,
        detail: 'high',
      },
    });
  } else if (imageUrl) {
    content.push({
      type: 'image_url',
      image_url: {
        url: imageUrl,
        detail: 'high',
      },
    });
  }

  // Add text prompt
  content.push({
    type: 'text',
    text: userPrompt,
  });

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content },
    ],
    temperature,
    max_tokens: maxTokens,
    ...(jsonMode && !hasImage && { response_format: { type: 'json_object' as const } }),
  });

  const responseContent = response.choices[0]?.message?.content || '{}';
  
  logger.info({ 
    tokensUsed: response.usage?.total_tokens,
    finishReason: response.choices[0]?.finish_reason,
    model,
    provider: 'openai',
    hasImage,
  }, 'LLM response received');

  return jsonMode ? extractJSON(responseContent) : responseContent;
}

// =============================================================================
// JSON Extraction Helper
// =============================================================================

function extractJSON(text: string): string {
  // Try to find JSON object in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    let json = jsonMatch[0];
    
    // Try to parse and repair truncated JSON
    try {
      JSON.parse(json);
      return json;
    } catch {
      // JSON is invalid, try to repair it
      json = repairTruncatedJSON(json);
      return json;
    }
  }
  return text;
}

/**
 * Attempts to repair truncated JSON by adding missing closing brackets
 */
function repairTruncatedJSON(json: string): string {
  let repaired = json.trim();
  
  // Count opening and closing brackets
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;
  
  // If JSON appears truncated, try to repair
  if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
    logger.warn({
      openBraces,
      closeBraces,
      openBrackets,
      closeBrackets,
    }, 'Detected truncated JSON response, attempting repair');
    
    // Remove incomplete trailing content (partial strings, keys, etc.)
    repaired = repaired.replace(/,\s*"[^"]*$/, ''); // Incomplete key
    repaired = repaired.replace(/,\s*"[^"]*":\s*$/, ''); // Key without value
    repaired = repaired.replace(/,\s*"[^"]*":\s*"[^"]*$/, ''); // Incomplete string value
    repaired = repaired.replace(/,\s*$/, ''); // Trailing comma
    
    // Add missing closing brackets/braces
    const missingBrackets = closeBrackets < openBrackets ? openBrackets - closeBrackets : 0;
    const missingBraces = closeBraces < openBraces ? openBraces - closeBraces : 0;
    
    repaired += ']'.repeat(missingBrackets);
    repaired += '}'.repeat(missingBraces);
    
    // Validate repair
    try {
      JSON.parse(repaired);
      logger.info('Successfully repaired truncated JSON');
    } catch (e) {
      logger.warn({ error: e }, 'Failed to repair truncated JSON');
    }
  }
  
  return repaired;
}
