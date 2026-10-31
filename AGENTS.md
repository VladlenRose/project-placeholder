<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules
- Matching and bargaining between trade requests is deterministic code in src/lib/bargain.ts (tested with `bun test`); AI only rephrases results — keeps outcomes predictable and cheap.
- Negotiation snapshots and immutable versions are persisted through authenticated server functions and atomic service-only database RPCs after participant authorization; browser clients are read-only on these tables to prevent forged participants, approvals, or lost concurrent updates.
- Parameter counteroffers use src/lib/negotiation.ts, preserve priorities, and reset human approvals only on the changed parameter; preview drafts never write to the database.
- Post-bargain scoring uses src/lib/agreement.ts and is stored in each new snapshot; proximity never authorizes crossing limits. Contract drafts require unanimous parameter approvals plus both final proposals; the service-only finalization RPC atomically records a participant's proposal and creates the draft after the second. Counteroffers clear both final proposals while resetting only the changed parameter's approvals, so old global consent cannot authorize new terms.
- Product similarity eligibility is shared via src/lib/request-similarity.ts and checked again by the authenticated negotiation opener; registry and chat display persisted negotiation results rather than preliminary match scores.
- Admin negotiation deletion uses an authenticated server function plus an atomic service-only RPC with role and version checks; preserve requests and documents, delete versions before negotiations, and keep request deletion blocked by existing foreign keys to avoid implicit data loss.
- RequestOwner uses the safe public profile RPC for participant names; RequestDetails opens existing requests by ID without navigating to the creation form, shared by chat, catalog, and profile history.
- Public participant names fall back to registration metadata through the safe profile RPC; profile saves invalidate all participant-name queries so requests reflect changes immediately.
- Catalog deletion uses an atomic authenticated RPC with database-checked owner/admin permissions, preserves request snapshots and negotiations, and shares one confirmation control across catalog, seller and admin views.
- Product photos use the provisioned private product-images bucket and Storage API signed URLs; bucket provisioning is separate from object access policies.
- Password recovery uses Cloud Auth email links to the public /reset-password route; only recovery links/sessions show the new-password form, with no custom token storage or email infrastructure.
