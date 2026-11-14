# CNIDARIA five-workstream execution board

The original toss game remains the core product. These workstreams are independent engineering lanes, not a claim that five separate autonomous agents are running.

| Lane | Scope | Next verified deliverable | Regression gate |
| --- | --- | --- | --- |
| 1 Motion | Sensor capture, launch/flight/impact, replay, honest scoring | Audit motion engine against Gauntlet result submission | motion replay tests |
| 2 Gauntlet | Direct challenges, rematches, history, two-phone sync | Verify archive/remove semantics and opponent-safe history | direct challenge regression |
| 3 Events | RSVP, authentication, host controls, privacy | Audit invitation lifecycle and permissions | RSVP security regression |
| 4 Natas | Safe agent tools, optional wallet, BSV | Add Hunt Mode guidance without granting transaction capabilities | Natas unit/security tests |
| 5 Hunt | Game UX, clues, checkpoints, Gryd/Nektar adapters | Offline checkpoint and shared-hunt design; no unverified API claims | Hunt regression |

## Integration rules

- Never replace or weaken the original motion engine for a new feature.
- Use distinct modules and tests, and check CI after each integration.
- No unverified hand-catch detection, external service APIs, wallet payments or prize promises.
- A local prototype is not a live multiplayer implementation.
- Archive/remove on one device must not delete another player's server data.
- Geolocation is opt-in; never publish a child's precise coordinates or private residential locations to a public map/blockchain.
- Report completed commits, passing/failing checks, and blockers separately.

## Proposed integration order

1. Verify current workflows and original motion replay.
2. Implement secure shared Hunt sessions, without GPS requirement.
3. Add optional private checkpoints with explicit permissions.
4. Introduce Natas hints through existing safe assistant tools.
5. Investigate documented Gryd/Nektar capabilities before adapters or money movement.
