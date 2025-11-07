# Axon Architecture Documentation

This directory contains detailed architectural documentation for the Axon context management system.

## Contents

- **[System Architecture](./system-architecture.md)**: Complete system overview with layer-by-layer breakdown
- **[Service Interactions](./service-interactions.md)**: How microservices communicate and coordinate
- **[Data Flow](./data-flow.md)**: Request flow from user prompt to LLM response
- **[Database Schema](./database-schema.md)**: MongoDB collections, Redis patterns, and Qdrant indexes
- **[Sequence Diagrams](./sequence-diagrams.md)**: Detailed sequence diagrams for key workflows
- **[Context Management](./context-management.md)**: Deep dive into CREE (Context Retrieval and Evolution Engine)
- **[Design Decisions](./design-decisions.md)**: Architectural Decision Records (ADRs)

## Quick Navigation

### For Developers

- New to the project? Start with [System Architecture](./system-architecture.md)
- Working on a service? Check [Service Interactions](./service-interactions.md)
- Debugging data flow? See [Data Flow](./data-flow.md)
- Database queries? Consult [Database Schema](./database-schema.md)

### For Architects

- High-level overview: [System Architecture](./system-architecture.md)
- Context strategy: [Context Management](./context-management.md)
- Design rationale: [Design Decisions](./design-decisions.md)

## Architecture Principles

Axon follows these core principles:

1. **Separation of Concerns**: Each service has a single, well-defined responsibility
2. **Microservices**: Independently scalable, deployable services
3. **Layered Architecture**: Clear abstraction layers with defined interfaces
4. **Context-First Design**: Every decision optimized for context quality
5. **Horizontal Scalability**: Stateless services that can scale independently
6. **Fail-Safe Defaults**: Graceful degradation when services unavailable
7. **Observable Systems**: Comprehensive logging, metrics, and tracing

## Technology Stack Summary

| Layer         | Technologies                                       |
| ------------- | -------------------------------------------------- |
| **Runtime**   | Node.js 20+, TypeScript 5.3+                       |
| **Build**     | Turbo (monorepo), pnpm (workspaces)                |
| **API**       | Express.js, Server-Sent Events (SSE)               |
| **Databases** | MongoDB (document), Redis (cache), Qdrant (vector) |
| **LLM**       | OpenAI GPT-4, Anthropic Claude                     |
| **Testing**   | Vitest, MongoDB Memory Server                      |
| **Quality**   | ESLint, Prettier, Husky                            |

## Key Workflows

1. **Prompt Processing** (see [Data Flow](./data-flow.md))
   - User submits prompt → Validation → Analysis → Context Retrieval → Synthesis → Injection → LLM → Post-processing

2. **Context Extraction** (see [Context Management](./context-management.md))
   - Workspace scan → File analysis → Entity extraction → Embedding generation → Vector indexing

3. **Context Evolution** (see [Context Management](./context-management.md))
   - Feedback collection → Confidence updates → Temporal decay → Consolidation → Conflict resolution

## Performance Targets

| Metric                 | Target    | Current   |
| ---------------------- | --------- | --------- |
| Prompt Analysis        | <200ms    | ~150ms    |
| Context Retrieval      | <500ms    | ~300ms    |
| Full Pipeline (median) | <3s       | ~2.5s     |
| Full Pipeline (p95)    | <5s       | ~4s       |
| Throughput             | >10 req/s | ~15 req/s |

## Version History

- **v1.0** (MVP) - Initial release with core context management
- **v2.0** (Planned) - Advanced evolution with ML, graph database, multi-user

---

Last Updated: 2025-11-03
