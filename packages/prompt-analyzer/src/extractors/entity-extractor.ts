/**
 * Entity Extractor
 * 
 * Extracts entities from prompts using regex patterns and NLP.
 * Identifies file paths, function names, class names, technologies, and more.
 */

import { EntityType, ExtractedEntity, ExtractorConfig } from '../types';
import { logger } from '@axon/shared';
import nlp from 'compromise';

/**
 * Regex patterns for entity extraction
 */
const ENTITY_PATTERNS = {
  // File paths (Windows and Unix)
  FILE_PATH: [
    /(?:^|\s)([A-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*)/gi, // Windows absolute
    /(?:^|\s)(\/(?:[^/\0]+\/)*[^/\0]*)/gi, // Unix absolute
    /(?:^|\s)(\.{1,2}\/(?:[^/\0]+\/)*[^/\0]*)/gi, // Relative paths
    /(?:^|\s)([a-zA-Z0-9_-]+\/[a-zA-Z0-9_\-./]+)/gi, // Simple paths
  ],

  // Function names (camelCase, snake_case, PascalCase)
  FUNCTION_NAME: [
    /\b([a-z][a-zA-Z0-9]*)\s*\(/g, // camelCase function calls
    /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, // function declarations
    /\bconst\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g, // const declarations
    /\b([a-z_][a-z0-9_]*)\s*\(/g, // snake_case function calls
  ],

  // Class names (PascalCase)
  CLASS_NAME: [
    /\bclass\s+([A-Z][a-zA-Z0-9]*)/g, // class declarations
    /\bnew\s+([A-Z][a-zA-Z0-9]*)/g, // class instantiation
    /\b([A-Z][a-zA-Z0-9]*)\s*\{/g, // React components or object literals
  ],

  // Variable names
  VARIABLE_NAME: [
    /\b(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, // variable declarations
    /\b([a-z][a-zA-Z0-9]*)\s*=/g, // assignments
  ],

  // Error messages and stack traces
  ERROR_MESSAGE: [
    /Error:\s*(.+?)(?:\n|$)/gi, // Error messages
    /Exception:\s*(.+?)(?:\n|$)/gi, // Exceptions
    /at\s+(.+?)(?:\n|$)/gi, // Stack trace lines
    /TypeError:\s*(.+?)(?:\n|$)/gi, // Type errors
    /ReferenceError:\s*(.+?)(?:\n|$)/gi, // Reference errors
  ],

  // Code snippets (backticks)
  CODE_SNIPPET: [
    /```[\s\S]*?```/g, // Multi-line code blocks
    /`([^`]+)`/g, // Inline code
  ],
};

/**
 * Known technologies, libraries, and frameworks
 */
const KNOWN_TECHNOLOGIES = [
  // JavaScript/TypeScript
  'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'gatsby',
  'express', 'fastify', 'koa', 'nest.js', 'node.js', 'deno', 'bun',
  'webpack', 'vite', 'rollup', 'parcel', 'esbuild', 'turbopack',
  'jest', 'vitest', 'mocha', 'chai', 'playwright', 'cypress',
  'typescript', 'javascript', 'tsx', 'jsx',
  'redux', 'mobx', 'zustand', 'recoil', 'jotai',
  
  // Python
  'django', 'flask', 'fastapi', 'pyramid', 'tornado',
  'numpy', 'pandas', 'matplotlib', 'scikit-learn', 'tensorflow', 'pytorch',
  'pytest', 'unittest', 'selenium',
  
  // Databases
  'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
  'dynamodb', 'firestore', 'supabase', 'prisma',
  'qdrant', 'pinecone', 'weaviate', 'chromadb',
  
  // Cloud/DevOps
  'aws', 'azure', 'gcp', 'vercel', 'netlify', 'heroku',
  'docker', 'kubernetes', 'k8s', 'terraform', 'ansible',
  'github actions', 'gitlab ci', 'jenkins', 'circleci',
  
  // Others
  'graphql', 'rest', 'grpc', 'websocket',
  'oauth', 'jwt', 'auth0', 'clerk',
  'tailwind', 'bootstrap', 'material-ui', 'chakra-ui',
];

/**
 * Entity Extractor
 */
export class EntityExtractor {
  private config: ExtractorConfig;

  constructor(config: Partial<ExtractorConfig> = {}) {
    this.config = {
      confidenceThreshold: 0.5,
      maxEntities: 50,
      enableNLP: true,
      ...config,
    };
  }

  /**
   * Extract all entities from a prompt
   */
  extract(prompt: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Extract using regex patterns
    entities.push(...this.extractFilePaths(prompt));
    entities.push(...this.extractFunctionNames(prompt));
    entities.push(...this.extractClassNames(prompt));
    entities.push(...this.extractVariableNames(prompt));
    entities.push(...this.extractErrorMessages(prompt));
    entities.push(...this.extractCodeSnippets(prompt));

    // Extract using NLP
    if (this.config.enableNLP) {
      entities.push(...this.extractTechnologies(prompt));
      entities.push(...this.extractConcepts(prompt));
    }

    // Deduplicate and sort by confidence
    const deduplicatedEntities = this.deduplicateEntities(entities);
    const sortedEntities = deduplicatedEntities.sort((a, b) => b.confidence - a.confidence);

    // Limit to max entities
    return sortedEntities.slice(0, this.config.maxEntities);
  }

  /**
   * Extract file paths
   */
  private extractFilePaths(prompt: string): ExtractedEntity[] {
    return this.extractWithPatterns(
      prompt,
      ENTITY_PATTERNS.FILE_PATH,
      EntityType.FILE_PATH,
      0.8
    );
  }

  /**
   * Extract function names
   */
  private extractFunctionNames(prompt: string): ExtractedEntity[] {
    return this.extractWithPatterns(
      prompt,
      ENTITY_PATTERNS.FUNCTION_NAME,
      EntityType.FUNCTION_NAME,
      0.7
    );
  }

  /**
   * Extract class names
   */
  private extractClassNames(prompt: string): ExtractedEntity[] {
    return this.extractWithPatterns(
      prompt,
      ENTITY_PATTERNS.CLASS_NAME,
      EntityType.CLASS_NAME,
      0.7
    );
  }

  /**
   * Extract variable names
   */
  private extractVariableNames(prompt: string): ExtractedEntity[] {
    return this.extractWithPatterns(
      prompt,
      ENTITY_PATTERNS.VARIABLE_NAME,
      EntityType.VARIABLE_NAME,
      0.6
    );
  }

  /**
   * Extract error messages
   */
  private extractErrorMessages(prompt: string): ExtractedEntity[] {
    return this.extractWithPatterns(
      prompt,
      ENTITY_PATTERNS.ERROR_MESSAGE,
      EntityType.ERROR_MESSAGE,
      0.9
    );
  }

  /**
   * Extract code snippets
   */
  private extractCodeSnippets(prompt: string): ExtractedEntity[] {
    return this.extractWithPatterns(
      prompt,
      ENTITY_PATTERNS.CODE_SNIPPET,
      EntityType.CODE_SNIPPET,
      0.95
    );
  }

  /**
   * Extract technologies using keyword matching
   */
  private extractTechnologies(prompt: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const lowerPrompt = prompt.toLowerCase();

    for (const tech of KNOWN_TECHNOLOGIES) {
      const regex = new RegExp(`\\b${tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = prompt.match(regex);

      if (matches) {
        for (const match of matches) {
          const index = prompt.indexOf(match);
          const context = this.getContext(prompt, index, match.length);

          // Determine if it's a library or framework based on common patterns
          const isLibrary = ['redux', 'mobx', 'numpy', 'pandas'].includes(tech.toLowerCase());
          const isFramework = ['react', 'vue', 'angular', 'django', 'flask'].includes(tech.toLowerCase());

          entities.push({
            type: isFramework ? EntityType.FRAMEWORK : isLibrary ? EntityType.LIBRARY : EntityType.TECHNOLOGY,
            value: match,
            confidence: 0.85,
            context,
            position: {
              start: index,
              end: index + match.length,
            },
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract concepts using NLP
   */
  private extractConcepts(prompt: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const doc = nlp(prompt);

    // Extract noun phrases as concepts
    const nouns = doc.nouns().out('array') as string[];
    for (const noun of nouns) {
      if (noun.length > 3) { // Filter short words
        const index = prompt.indexOf(noun);
        if (index !== -1) {
          const context = this.getContext(prompt, index, noun.length);
          entities.push({
            type: EntityType.CONCEPT,
            value: noun,
            confidence: 0.6,
            context,
            position: {
              start: index,
              end: index + noun.length,
            },
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract entities using regex patterns
   */
  private extractWithPatterns(
    prompt: string,
    patterns: RegExp[],
    type: EntityType,
    baseConfidence: number
  ): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);

      while ((match = regex.exec(prompt)) !== null) {
        const value = match[1] || match[0];
        if (value && value.trim()) {
          const context = this.getContext(prompt, match.index, value.length);
          
          entities.push({
            type,
            value: value.trim(),
            confidence: baseConfidence,
            context,
            position: {
              start: match.index,
              end: match.index + value.length,
            },
          });
        }
      }
    }

    return entities;
  }

  /**
   * Get surrounding context for an entity
   */
  private getContext(text: string, index: number, length: number, windowSize = 50): string {
    const start = Math.max(0, index - windowSize);
    const end = Math.min(text.length, index + length + windowSize);
    return text.substring(start, end).trim();
  }

  /**
   * Deduplicate entities by value and type
   */
  private deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const seen = new Map<string, ExtractedEntity>();

    for (const entity of entities) {
      const key = `${entity.type}:${entity.value.toLowerCase()}`;
      const existing = seen.get(key);

      if (!existing || entity.confidence > existing.confidence) {
        seen.set(key, entity);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ExtractorConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Entity extractor config updated', this.config);
  }
}
