/**
 * Simple Prompt Transformation Demo
 *
 * This script shows how a prompt is enriched with context before sending to the LLM.
 * Run with: tsx apps/api/src/utils/simple-trace.ts
 */

import {
  LLMGatewayService,
  createDefaultConfig,
  LLMProvider,
  LLMModel,
  MessageRole,
} from '@axon/llm-gateway';

async function demonstratePromptTransformation() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 AXON PROMPT TRANSFORMATION DEMO');
  console.log('='.repeat(80) + '\n');

  // ============================================================================
  // STAGE 1: Original User Prompt
  // ============================================================================
  console.log('📝 STAGE 1: ORIGINAL USER PROMPT');
  console.log('-'.repeat(80));

  const userPrompt = 'Fix the authentication bug in the login function';

  console.log('User Input:', userPrompt);
  console.log('Length:', userPrompt.length, 'characters\n');

  // ============================================================================
  // STAGE 2: Simulated Context Retrieval
  // ============================================================================
  console.log('🔎 STAGE 2: CONTEXT RETRIEVAL (Simulated)');
  console.log('-'.repeat(80));

  const buggyCode = `
export async function login(email: string, password: string) {
  const user = await db.users.findOne({ email });
  if (!user) {
    throw new Error('User not found');
  }
  
  // BUG: Password comparison is not using bcrypt
  if (user.password !== password) {
    throw new Error('Invalid password');
  }
  
  return generateToken(user);
}`;

  const correctExample = `
import bcrypt from 'bcrypt';

export async function register(email: string, password: string) {
  // Hash password properly
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await db.users.create({ email, password: hashedPassword });
  return generateToken(user);
}`;

  const bestPractice =
    'Best practice: Always use bcrypt.compare() for password verification. Never compare plain text passwords directly.';

  console.log('Retrieved 3 contexts:');
  console.log('1. Current login.ts code (buggy)');
  console.log('2. Correct example from register.ts');
  console.log('3. Security best practice\n');

  // ============================================================================
  // STAGE 3: Context Injection
  // ============================================================================
  console.log('💉 STAGE 3: CONTEXT INJECTION');
  console.log('-'.repeat(80));

  const systemPrompt = `You are a helpful coding assistant specializing in TypeScript and security best practices.

WORKSPACE CONTEXT:
- Tech Stack: TypeScript, Node.js, Express.js, MongoDB
- Authentication: JWT tokens
- Password Hashing: bcrypt

RELEVANT CODE:

[File: src/auth/login.ts - CURRENT CODE WITH BUG]
${buggyCode}

[File: src/auth/register.ts - CORRECT EXAMPLE]
${correctExample}

SECURITY BEST PRACTICE:
${bestPractice}

INSTRUCTIONS:
1. Identify the security vulnerability in the login function
2. Explain why it's a problem
3. Provide the corrected code using bcrypt.compare()
4. Be concise and clear`;

  console.log('System Prompt Created:');
  console.log('├─ Includes workspace context');
  console.log('├─ Shows buggy code');
  console.log('├─ Shows correct example');
  console.log('├─ Includes best practice');
  console.log('└─ Length:', systemPrompt.length, 'characters\n');

  // ============================================================================
  // STAGE 4: Final Prompt Construction
  // ============================================================================
  console.log('🏗️  STAGE 4: FINAL PROMPT CONSTRUCTION');
  console.log('-'.repeat(80));

  const messages = [
    {
      role: MessageRole.SYSTEM,
      content: systemPrompt,
    },
    {
      role: MessageRole.USER,
      content: userPrompt,
    },
  ];

  console.log('Constructed Messages:');
  console.log('├─ Message 1 (system): Context injection');
  console.log('│  └─ Length:', systemPrompt.length, 'characters');
  console.log('└─ Message 2 (user): Original prompt');
  console.log('   └─ Length:', userPrompt.length, 'characters');
  console.log('\nTotal prompt size:', systemPrompt.length + userPrompt.length, 'characters\n');

  console.log('--- FINAL PROMPT (What LLM Sees) ---\n');
  messages.forEach((msg, idx) => {
    console.log(`[Message ${idx + 1}] Role: ${msg.role}`);
    console.log(msg.content);
    console.log('\n' + '-'.repeat(40) + '\n');
  });

  // ============================================================================
  // STAGE 5: Send to Ollama
  // ============================================================================
  console.log('🤖 STAGE 5: LLM PROCESSING');
  console.log('-'.repeat(80));

  try {
    // Create LLM Gateway with Ollama
    const llmConfig = createDefaultConfig(LLMProvider.OLLAMA, 'not-required', {
      baseUrl: 'http://localhost:11434',
      defaultModel: LLMModel.LLAMA_3,
      timeout: 60000,
      enableCaching: false,
      rateLimit: { enabled: false },
    });

    const llmGateway = new LLMGatewayService(llmConfig);

    console.log('Sending to Ollama...');
    console.log('├─ Provider: Ollama');
    console.log('├─ Model: llama3.2:1b');
    console.log('├─ Base URL: http://localhost:11434');
    console.log('└─ Temperature: 0.3\n');

    const startTime = Date.now();

    const response = await llmGateway.complete({
      model: 'llama3.2:1b' as any, // Use actual Ollama model name
      messages,
      temperature: 0.3,
      maxTokens: 1000,
    });

    const duration = Date.now() - startTime;

    console.log('✅ Response Received!');
    console.log('├─ Duration:', duration, 'ms');
    console.log('├─ Finish Reason:', response.finishReason);
    console.log('├─ Prompt Tokens:', response.usage.promptTokens);
    console.log('├─ Completion Tokens:', response.usage.completionTokens);
    console.log('└─ Total Tokens:', response.usage.totalTokens);

    // ============================================================================
    // STAGE 6: Display Response
    // ============================================================================
    console.log('\n📤 STAGE 6: LLM RESPONSE');
    console.log('-'.repeat(80));
    console.log(response.content);
    console.log('-'.repeat(80));

    // ============================================================================
    // Summary
    // ============================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 TRANSFORMATION SUMMARY');
    console.log('='.repeat(80));
    console.log('\nPrompt Evolution:');
    console.log(`1. User Input:       "${userPrompt}" (${userPrompt.length} chars)`);
    console.log(`2. + Context:        ${systemPrompt.length} chars added`);
    console.log(`3. Final Size:       ${systemPrompt.length + userPrompt.length} chars`);
    console.log(`4. LLM Tokens:       ${response.usage.promptTokens} tokens`);
    console.log(`5. Response Tokens:  ${response.usage.completionTokens} tokens`);
    console.log(`6. Processing Time:  ${duration}ms`);
    console.log('\nContext Enhancement:');
    console.log(`- Original prompt: ${userPrompt.length} characters`);
    console.log(`- With context: ${systemPrompt.length + userPrompt.length} characters`);
    console.log(
      `- Enhancement: ${Math.round(((systemPrompt.length + userPrompt.length) / userPrompt.length - 1) * 100)}% larger`
    );
    console.log('\n' + '='.repeat(80) + '\n');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure Ollama is running');
    console.log('2. Verify model is installed: ollama list');
    console.log('3. Pull model if needed: ollama pull llama3.2:1b');
    console.log('4. Test Ollama: ollama run llama3.2:1b "test"\n');
  }
}

// Run the demo
demonstratePromptTransformation().catch(console.error);
