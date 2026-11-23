# Saber Pit v0.9 lore and moveset notes

Research: CLARA-06, 2026-10-15. This is a design reference, not an implementation report or an authoritative catalogue of every Star Wars technique.

## Evidence and continuity

Use three labels in help text and release notes:

- **Canon depiction:** an action or principle supported by the films, television, or the official StarWars.com Databank. This establishes the fictional action, not game statistics.
- **Legends / reference tradition:** material from the former Expanded Universe or descriptions whose precise modern-canon wording has not been verified here. Lucasfilm's [2014 continuity announcement](https://www.starwars.com/news/the-legendary-star-wars-expanded-universe-turns-a-new-page) explains the Legends distinction. An old idea reappearing in canon does not make all of its old details canon.
- **Saber Pit adaptation:** invented action labels, attack sequences, animation timings, resource costs, ranges, damage, status effects, progression and AI rules. Every proposal below is an adaptation, even when inspired by a documented action.

The seven-form names and broad identities below are corroborated by the accessible [seven-form overview](https://www.theorysabers.com/blogs/article/lightsaber-forms-explained), a **secondary commercial source**, not Lucasfilm. Its article mixes continuities and contains dubious peripheral statements; use only the conservative identity summaries below. Wookieepedia pages could not be retrieved during this research. A primary-text, modern-canon audit of every form-specific historical claim remains incomplete. Do not advertise this work as a complete canon moveset.

## Seven forms: compact playable proposals

The identity column summarizes the reference tradition in fewer than 150 words. The move labels and all behavior in the other columns are original game-design proposals, not quotations or claims of named canonical techniques. These should be visible action choices or distinct AI behaviors, rather than seven cosmetic versions of the same attack.

| Form and reference identity | Proposed Saber Pit actions (adaptations) | Readability and tradeoff (adaptations) |
| --- | --- | --- |
| **I — Shii-Cho:** foundational, broad and useful against groups. | **Opening cut:** diagonal approach strike. **Clearing sweep:** broad horizontal arc hitting at most a bounded number of nearby foes. **Disarming pressure:** a successful follow-up briefly reduces guard rather than permanently removing the weapon. | Wide saber trail; modest reach and damage; a missed sweep leaves recovery. Avoid describing a beginner form as inherently inferior. |
| **II — Makashi:** precise dueling, economical movement. | **Line thrust:** narrow, longer forward hit zone. **Sidestep riposte:** short lateral evade followed by a stab if an attack was avoided. **Blade feint:** delayed second cut toward the same target. | Thin forward telegraph; strong single-target accuracy; limited crowd coverage. A curved hilt is flavor, not a required mechanical gate. |
| **III — Soresu:** compact defense and patient counters. | **Close guard:** reduce frontal damage while movement slows. **Deflection turn:** timed defense followed by a small reposition. **Patient return:** short counter available after a defended hit. | Tight circular guard effect; must still spend guard/resource and be vulnerable to flanks or recovery. No permanent invulnerability. |
| **IV — Ataru:** Force-assisted acrobatics and aggressive mobility. | **Vaulting cut:** jump arc with an apex slash and readable landing. **Spiral pass:** lateral rotating strike that ends beside the target. **Rebound retreat:** short backward flip that resets spacing without dealing damage. | Show body rotation, height/shadow separation, and landing compression. Expensive burst movement; exposed landing and recovery. Collision and arena boundaries still apply. |
| **V — Shien / Djem So:** two related variants emphasizing redirection and powerful counters. | **Shien — Turning guard:** redirect a suitable incoming projectile into an aimed return. **Djem So — Heavy answer:** block then deliver a strong descending cut. **Driving cut:** forward strike that creates limited knockback. | Shien needs a real eligible projectile; in saber-only battles emphasize its defensive reposition instead. Djem So has slower commitment and recovery. These variants occupy one primary form. |
| **VI — Niman:** generalist integration of earlier forms. | **Linked cut:** moderate slash followed by a short Force push. **Draw and strike:** pull a visible target a limited distance, then attack only if it enters actual reach. **Balanced ward:** brief guard while a Force action recovers. | Give saber and Force portions separate animations and resolution. The hybrid emphasis is a design interpretation; a failed pull must not create a guaranteed remote saber hit. |
| **VII — Juyo / Vaapad:** ferocious pressure; Vaapad is a distinct Mace-associated variant. | **Juyo — Broken rhythm:** uneven three-cut sequence with an interruptible gap. **Juyo — Committed rush:** fast approach ending in a recoverable strike. **Vaapad — Measured return:** successful timed defense builds a capped bonus for the next counter. | Strong pressure with costly misses. Do not turn Vaapad into automatic victory over dark-side opponents or identify every Juyo user as a Vaapad user. The bonus meter is wholly a game invention. |

These seven primary forms can support nine selectable configurations by splitting Form V into Shien and Djem So, and Form VII into Juyo and Vaapad. That selection structure is a game interface decision. Weapon count is separate from form: two blades or a saberstaff do not establish a fighter's form by themselves.

## Yoda: distinct acrobatics and Force behavior

Yoda's duels in *Attack of the Clones* and *Revenge of the Sith* are the visual inspiration for his leaping, turning saber motion. The official [Yoda Databank](https://www.starwars.com/databank/yoda) confirms the Dooku and Sidious confrontations, his exceptional Force connection, sensing the Jedi deaths, and his communication with Ezra. The [official Senate duel page](https://www.starwars.com/video/senate-force-duel) provides the film reference. Its fetched text is a synopsis, not a frame-by-frame animation analysis. The Ataru label and Force-assisted acrobatic association are separately corroborated by this [secondary Ataru discussion](https://www.theorysabers.com/blogs/article/ataru-lightsaber-form-explored).

Recommended Yoda adaptation: alternate a low ready pose with short burst attacks, visibly rotate during a vault, use an offset ground shadow to convey height, and land before the next decision. Give him different approach and retreat arcs so every action is not the same spin. A jump should have takeoff, airborne motion, and landing states; speed alone does not communicate acrobatics. Any airborne dodge benefit must be bounded and exposed in help text as a rule.

Yoda visibly levitates Luke's X-wing; the official [greatest-moments article](https://www.starwars.com/news/7-of-yodas-greatest-moments) describes this feat. For gameplay, use a small-object lift or limited enemy displacement with a visible charge. Do not infer unlimited lift strength, remote unavoidable damage, or a fixed numerical power ranking from that scene.

Yoda's film lightning defense inspires an optional **energy catch** reaction: a short frontal response to lightning, followed by recovery. This is supported at the ability-family level by the official [Force Lightning entry](https://www.starwars.com/databank/force-lightning), which describes lightsaber defense and exceptional Jedi neutralization. The animation should differ from firing lightning. Avoid treating the specialized term **tutaminis** or a universal absorb-and-refill rule as established by that page; it does not use that term.

Do not automatically give Yoda offensive Sith lightning, choke, life drain, or every named power from Legends. Likewise, a living arena fighter's kit should not silently inherit abilities performed in a different state or narrative context, such as a Force spirit.

## Varied Force kit proposals

These are selectable mechanics, not a claim that every fighter or every form canonically possesses every power. Assign a small loadout per fighter so opponents can learn it. All ranges, costs, cooldowns, channel duration, immunity windows and damage values are adaptations.

| Ability | Evidence | Distinct Saber Pit behavior and counterplay (adaptation) |
| --- | --- | --- |
| **Push** | [Official Force Push](https://www.starwars.com/databank/force-push): Jedi and Sith use it offensively and defensively. | Short visible cone; knockback resolved against obstacles; guard reduces displacement; no through-wall targets. |
| **Pull / lift** | [The Force](https://www.starwars.com/databank/the-force) supports levitation; Yoda's X-wing example above supplies a concrete feat. | Single visible target moves toward the caster or briefly rises; stop at collision; never teleport a target through a wall. The precise enemy-control attack is an adaptation. |
| **Sensing** | [The Force](https://www.starwars.com/databank/the-force) describes awareness of things before they happen. | Brief threat-direction cue or limited perception increase. It does not grant guaranteed hits or perfect omniscience. |
| **Mind trick** | [Official Jedi Mind Trick](https://www.starwars.com/databank/jedi-mind-trick) describes suggestion and limited susceptibility. | Brief target-selection disruption on eligible foes; visible status indicator; strong opponents resist; never imply irresistible control over all minds. |
| **Lightning** | [Official Force Lightning](https://www.starwars.com/databank/force-lightning) identifies a dark-side ability with possible defenses. | Visible directed channel, periodic resource drain and damage, interruptible by loss of sight, range or a stagger. Distinct from a one-shot blue projectile. |
| **Choke** | [Official Force Choke](https://www.starwars.com/databank/force-choke) links it to Sith intimidation and strangling. | Single-target short channel with an explicit interrupt; concentrated commitment exposes the caster. Keep visual treatment stylized. |
| **Energy catch** | Lightning defense entry above; Yoda's film confrontations. | Reactive frontal lightning mitigation with recovery, separate from ordinary saber guard. Resource refund, if any, is a capped game rule. |
| **Focus / rally** | Yoda's mentor role is documented, but this exact arena power is **not** established by the consulted sources. | Clearly label a Saber Pit support adaptation: short focus regeneration or ally guard support with a visible radius. Do not rename it canonical battle meditation without a suitable continuity-specific source. |

## Accuracy and implementation acceptance notes

1. Use “inspired by the seven forms” or “lore-informed adaptations.” Avoid “all canonical moves,” “complete authentic arsenal,” or “the official moveset.”
2. Keep source-backed lore blurbs separate from invented combo names and numerical rules. Do not cite the official Yoda biography as evidence for the whole seven-form taxonomy.
3. Legends techniques can be included when explicitly labeled. Terms such as battle meditation, Force valor, and tutaminis need their own reliable continuity-specific citations before appearing as factual glossary entries.
4. Do not infer a deterministic form-versus-form winner from a film duel. Character skill, fatigue, circumstance and story matter; matchup bonuses are game balance.
5. Distinguish available design proposals from implemented actions. A move is implemented only if AI/direct control can trigger it, its collision and resource rules resolve, and its animation makes the action observable.
6. For saber-only mode, disable Force attack and status payloads consistently. If generic jumps/dashes remain, explain them as the mode's movement rules; no claim is made that the fiction removes the Force from acrobatics.
7. Validate form differences with one readable example per form; validate Yoda with a visible takeoff/apex/landing sequence; validate each Force power with both successful use and a blocked or interrupted case.

## Research limits

Official Databank pages and Lucasfilm's continuity statement were directly retrieved. The form summaries were checked against accessible secondary pages; their primary book sources were not inspected. Inaccessible pages and search snippets are not represented here as fully read evidence. This is sufficient to guide honestly labeled adaptations, but not to certify every form attribute or named technique as current canon.

## Implementation naming review

Reviewed the v0.9 work-in-progress `combat-forms.js`, `force-abilities.js`, `content.js`, and relevant app labels. This review addresses wording; it does not certify runtime behavior or replace combat tests.

- The authored three-action form sequences use appropriate adaptation language in source comments. Keep that distinction visible in the combat guide or inspector as well. Names such as **Patient riposte**, **Deflection sweep**, and **Returning guard** must not promise a reactive counter or reflected projectile unless the corresponding mechanic exists.
- **Force grip and release** appropriately describes a telekinetic hold. Do not call it **Force choke** merely because a target cannot move: the official choke reference specifically describes strangling.
- **Force repulse** means this game's radial-push action. **Telekinetic sweep** means this game's forward area action. Neither name here certifies an exact current-canon technique, and neither is established as exclusive to a particular form by the consulted sources.
- **Force barrier** is this game's temporary, finite damage mitigation. The sources consulted do not establish its exact name, duration, absorption budget, or universal availability. Treat it as a defensive adaptation.
- **Saber throw** is a film-inspired action; a fixed blade lockout, guaranteed return, damage value, and unlock rank are game mechanics. **Force lightning** has a canon dark-side identity, while granting it to every eligible arena fighter is a sandbox progression decision. Ataru alone does not imply that a fighter is Yoda or possesses Yoda's exact abilities.
- Preserve the displayed identity of legacy **Force burst** and **Force pulse** when they supply the basic cast's behavior. If a shared internal ability identifier is used, resolve its visible name from the equipped family or label it **Basic Force cast**. An internal `force_push` selection should not silently relabel every family as push.
- The eight implemented candidate powers differ from the wider design menu above. Sensing, mind trick, energy catch, and focus/rally remain proposals unless separately implemented; a guide must not list them as playable solely because this research document discusses them.
