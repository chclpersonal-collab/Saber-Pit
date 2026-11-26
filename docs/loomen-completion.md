# LOOMEN completion tracker
**Release held.** Finish and verify all accepted requirements before updating the private Site. Latest review baseline: [d04601a](https://github.com/chclpersonal-collab/Saber-Pit/commit/d04601a6d1248dda1e9f36acca7789fdd0449169), Nov 26, 09:19 Manila. Source for Clarissa’s requests and ownership: [MAILBOX handoff](https://github.com/chclpersonal-collab/MAILBOX/pull/1#issuecomment-7179622186). Yesterday’s production build is unchanged.

**Clara: 1/17 (6%) verified · Clarissa: 2/7 (29%) verified.** These are acceptance checks, not estimates of hours worked. “Candidate” means built or checked in part; it does not count as verified. Shared checks are counted separately. The exact review baseline passed 1,237 automated tests, plus 7 save backend tests; those tests do not settle all the rows.

## Clara
| ID | Check | Status |
| --- | --- | --- |
| C01 | No auto-dodge, guard, or attacks for a player without input | Verified in targeted tests on the exact candidate |
| C02 | Distinct AI personalities show up in normal play | Candidate |
| C03 | SSS+V master trials vs 15+ F meet the agreed target across builds, maps and seeds | In progress; sampled results depend on time limit |
| C04 | Real friendly fire with clear attribution and no duplicate hits | In progress |
| C05 | Full customization, map and AI-count parity with useful Classic features in the v6 UI | In progress |
| C06 | Three Fronts lane choices match the requested behavior | Candidate; need exact request comparison |
| C07 | Auto Seasons runs repeatedly without lost records or stuck transitions | Candidate; long run pending |
| C08 | Old setup never flashes on cold/slow loads or upgrade, and failed startup offers Reload | Candidate; preview startup passed, exact upgrade pending |
| C09 | Old saves, Continue, recovery and replays work without data loss or practice overwriting rated state | Candidate; backend tests pass, signed-in play path pending |
| C10 | Three continuously spinning floating Orbit blades, individual recoil and idle fighters | Candidate; exact visual continuity pending |
| C11 | Backhand single, backhand dual, staff with both striking ends, Dual-Phase selection and ignition | Candidate; Dual-Phase absent from v6 Saber pane |
| C12 | Damage and fatality by body region with useful thresholds and no HP | Candidate; full gameplay verification pending |
| C13 | Physics-driven KO ragdoll with stable ground contact; injuries still affect limbs | In progress |
| C14 | Convincing and distinct fight, miss, contact and environment audio | Open |
| C15 | 15v15 body separation and visibly distinct silhouettes | Candidate; wide matrix pending |
| C16 | Equal-Grandmaster 1v2 survives over 15s; elite mirrors last near the clock | Open; earlier survival samples fell short |
| C17 | Real refresh-rate responsiveness and visual frame pacing | Candidate; device checks pending |

## Clarissa
| ID | Check | Status |
| --- | --- | --- |
| Q01 | Real Solo and Squads Tournament seats and results | Candidate; full run pending |
| Q02 | Restored human matches never show an AI replay as their own | Verified via source and restore tests on the exact candidate |
| Q03 | Gamepad Jump, Feint and Phase once per press; resume drops held input | Candidate; physical controller pending |
| Q04 | Pose and limb continuity, including no teleporting hands in covered transitions | Verified in exact candidate tests |
| Q05 | Phone stats show the full Blue form name | In progress |
| Q06 | Mobile navigation, Back and deep links route correctly | In progress |
| Q07 | Play a Hero 1v3 no longer ends almost immediately for the reported matchup | In progress |

## Shared and final gates
Reference-faithful v6 on each screen and dimensions; all intended modes playable including Gauntlet; smarter AI; Blue/Pink language; unclipped and usable ⋯ menus; no unwanted top labels/tabs/helper text; accurate form pose previews; no legacy player-facing builds; avoid unnecessary UI/code; modern copy pass; independent rank benchmarks with fixed fixtures; preset binding; and a whole unedited duel with the small visual, input and audio details checked. Fresh cache tags must match the final build; the joint release gate includes archive parity, private access, signed-in upgrade, physical Android and save/return checks. Preset and Three Fronts exact acceptance details are being matched to the original requests. Nothing deploys before sign-off on the full list.
