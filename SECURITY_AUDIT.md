# Alaska AI Security Audit

Audit scope: source tree supplied as `alaska-chat-buddy-main.zip` on 2026-09-11.

## Executive summary

**Status: 🟡 Not ready to make public yet.**

No Supabase service-role key, Lovable API key, OpenAI secret key, or private SSH/RSA key was found in the supplied source tree. The committed `.env` file did contain a Supabase publishable key and project URL. A publishable Supabase key is intended for client use, but `.env` should still never be committed.

The repository also contains several application-level issues that should be addressed before presenting the project as production-secure.

## Findings

### 1. `.env` committed — FIXED IN THIS CLEAN COPY
**Severity: Medium (repository hygiene / accidental-secret risk)**

The original archive contained `.env` with Supabase project configuration and a publishable key. The cleaned copy removes `.env`, adds `.env`/`.env.*` to `.gitignore`, and adds `.env.example` with placeholders.

**Important:** if `.env` was previously pushed to GitHub, deleting it in a new commit does not remove it from Git history. If the repository is going public again, remove the file from history or recreate the repository history. The publishable key itself is not a service-role secret, but repository history should still be clean.

### 2. Profile privacy policy is too broad — NEEDS FIX
**Severity: High**

The latest migration recreates `profiles_select_authenticated` with `USING (true)`. That means every authenticated user can select all columns from `profiles`, including fields such as `bio` and `chat_rules`. Earlier migrations had a more restrictive own/friends policy, but the later migration re-opens the table.

Before public/real-user deployment, move sensitive profile fields to a private table or otherwise enforce a safe-column/public-profile design.

### 3. Chat API accepts an unbounded message array — NEEDS FIX
**Severity: Medium**

`/api/chat` checks that `messages` is an array but does not impose a maximum number of messages or total payload size. A client can send a very large request and cause unnecessary parsing, embedding, moderation, and model work.

Add request-size, message-count, and per-message limits before production deployment.

### 4. Image generation input limits are missing — NEEDS FIX
**Severity: Medium**

`/api/generate-image` does not enforce a length limit on `prompt` or a size/format limit on `referenceImage` before forwarding data to the AI gateway.

Add strict prompt length and reference-image validation/size limits.

### 5. Output moderation is performed after streaming — NEEDS FIX
**Severity: Medium / safety**

The chat response is streamed to the client, while output moderation happens in `onFinish`. Therefore, an unsafe model response can already have been delivered before the moderation decision is made. The code can prevent unsafe content from being stored, but it cannot reliably prevent the streamed content from reaching the user.

If output blocking is required, moderate the completed response before sending it, or use a streaming moderation design that can stop/replace unsafe output.

### 6. Moderation fails open on gateway errors — NEEDS FIX / PRODUCT DECISION
**Severity: Medium / safety**

`moderateText()` returns an allowed verdict when the moderation service errors. This preserves availability but means safety filtering is bypassed during an AI gateway outage.

Decide explicitly whether the product should fail open or fail closed. For a strict safety mode, fail closed or use a deterministic local fallback for high-risk categories.

### 7. Friendship status can be updated by either participant — NEEDS FIX
**Severity: Medium**

The friendship UPDATE policy allows either requester or addressee to update a friendship row. The client currently uses this to accept requests, but the database policy does not restrict which status transitions are legal. A requester could potentially change its own pending request to `accepted` directly.

Use a database function or stricter update policy to allow only valid transitions (for example, addressee: pending → accepted, requester: pending → cancelled).

## Positive security controls found

- Server-only `LOVABLE_API_KEY` is read from environment variables rather than hardcoded.
- Server-only `SUPABASE_SERVICE_ROLE_KEY` is read from environment variables and was not present as a value in the supplied archive.
- API routes authenticate bearer tokens with Supabase.
- AI threads/messages use ownership-based RLS.
- Knowledge-base retrieval filters on `auth.uid()`.
- Storage policies are scoped to user ownership.
- Rate limiting is implemented server-side through a database RPC.
- Account deletion uses a server-side service-role client rather than exposing that key to the browser.
- The source scan found no obvious OpenAI `sk-...`, Supabase `sb_secret_...`, or private-key material in the supplied archive.

## Dependency audit limitation

`npm audit` could not contact the npm registry in the audit environment, so dependency vulnerabilities could not be freshly verified. Run `npm audit` locally after installing dependencies and review the result before publishing.

## Recommended publication gate

Before changing the GitHub repository to public:

1. Keep `.env` out of Git.
2. Clean any previously committed `.env` from Git history.
3. Fix the `profiles` privacy policy.
4. Add API request-size/input limits.
5. Fix output-moderation streaming behavior if safety blocking is a requirement.
6. Tighten friendship status transitions.
7. Run `npm audit`, `npm run lint`, and `npm run build` locally.
8. Verify no secrets with a final secret scan.
