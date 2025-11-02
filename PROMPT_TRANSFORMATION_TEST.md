# Prompt Transformation Test Results

## Overview

This document shows how Axon transforms a simple user prompt into a context-rich prompt that the LLM can use to provide accurate, workspace-aware responses.

## Test Example

**User Input**: "Fix the authentication bug in the login function"

## Transformation Pipeline

### Stage 1: Original Prompt

- **Input**: `"Fix the authentication bug in the login function"`
- **Size**: 48 characters
- **Context**: None

### Stage 2: Context Retrieval

Retrieved 3 relevant contexts:

1. **Current buggy code** from `src/auth/login.ts` (relevance: 0.95)
2. **Correct example** from `src/auth/register.ts` (relevance: 0.82)
3. **Security best practice** about password hashing (relevance: 0.88)

### Stage 3: Context Injection

Created a system prompt that includes:

- Workspace context (tech stack, conventions)
- Buggy code with annotation
- Correct example for reference
- Security best practice
- Clear instructions

**Result**: 1,290 character system prompt

### Stage 4: Final Prompt Construction

**Messages sent to LLM**:

1. **System Message** (1,290 chars): All the context
2. **User Message** (48 chars): Original question

**Total Size**: 1,338 characters

### Stage 5: LLM Processing

- **Provider**: Ollama (local)
- **Model**: llama3.2:1b
- **Temperature**: 0.3
- **Prompt Tokens**: 319
- **Completion Tokens**: 136
- **Processing Time**: 20.6 seconds

### Stage 6: LLM Response

The LLM correctly identified the vulnerability and provided the fix:

```
The identified security vulnerability is that the password comparison
is not using `bcrypt.compare()`, which is the recommended way to compare
passwords securely.

This issue arises because the current implementation directly compares
the plain text password with the hashed password, which can be vulnerable
to rainbow table attacks or other types of password cracking.

To fix this bug, we should replace the line `if (user.password !== password)`
with `const isValidPassword = await bcrypt.compare(password, user.password);`.
```

## Impact Analysis

### Context Enhancement

- **Original prompt**: 48 characters
- **With context**: 1,338 characters
- **Enhancement**: **2,688% larger**

### Quality Improvement

Without context, the LLM would need to:

- Guess what "authentication bug" means
- Not know which file or function
- Provide generic advice

With context, the LLM:

- ✅ Identified the specific vulnerability (plain text comparison)
- ✅ Explained why it's a security issue
- ✅ Provided the exact fix with code
- ✅ Referenced the correct function (`bcrypt.compare`)

## Running the Test

```bash
# Make sure Ollama is running with the model
ollama pull llama3.2:1b

# Run the transformation demo
npx tsx apps/api/src/utils/simple-trace.ts
```

## Key Takeaways

1. **Context Amplification**: A 48-character prompt becomes 1,338 characters (27x larger)
2. **Workspace Awareness**: The LLM sees the actual code, tech stack, and conventions
3. **Precision**: Response is specific to the exact problem, not generic advice
4. **Security Focus**: Best practices are injected automatically
5. **Speed**: Local Ollama processed in ~20 seconds on consumer hardware

## Architecture Validation

This test demonstrates the core value proposition of Axon:

```
Simple Question → [Axon Context Engine] → Rich, Workspace-Aware Prompt → Precise Answer
```

The transformation pipeline works as designed:

1. ✅ User input collection
2. ✅ Context retrieval (simulated with relevant examples)
3. ✅ Context injection (system prompt with workspace data)
4. ✅ LLM processing (Ollama integration)
5. ✅ Quality response (accurate fix with explanation)

## Next Steps

To test with real context retrieval:

1. Set up MongoDB for workspace storage
2. Initialize Qdrant with embedded code
3. Run semantic search to retrieve contexts
4. Compare results with and without vector search

## Files

- **Test Script**: `apps/api/src/utils/simple-trace.ts`
- **Test Results**: This document
- **Ollama Integration**: `packages/llm-gateway/src/providers/ollama-provider.ts`
