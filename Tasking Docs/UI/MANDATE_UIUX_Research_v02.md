# MANDATE — UI/UX Research: Dense Strategy Games with Fintech Aesthetics

**Version 0.2 — March 2026**

---

## Changelog

| Version | Changes |
|---------|---------|
| 0.1 | Initial research: progressive disclosure, Bloomberg patterns, crypto UX, dual onboarding, real-time feeds, failure modes, design trends |
| 0.2 | Expanded dual onboarding → **three-axis onboarding** (crypto, strategy, AI/agent literacy). Added full AI-naive player onboarding section. Replaced generic design system recommendations (Inter, JetBrains Mono, #121212) with **MegaETH brand kit** values (Helvetica Neue, Wudoo Mono, Night Sky #19191A, Moon White #ECE8E8). Added "AI jargon" as seventh failure mode. Updated all colour/typography references throughout. |

---

**The most effective complex game interfaces share three traits: they treat the world itself as the primary visualization, they let every number explain itself through tooltip chains, and they never force users to leave context to take action.** For MANDATE specifically—a blockchain strategy game targeting crypto-natives, strategy veterans, and players unfamiliar with AI—the research points to a clear design philosophy: build a Bloomberg Terminal that plays like Crusader Kings III, abstract the blockchain completely, teach delegation before mechanics, and let players configure their own information density. The games and platforms that get this right (CK3's nested tooltips, Factorio's alt-mode, Bloomberg's temporal density, Influence's game-tempo-around-blockchain) share a common refusal to compromise on depth while making that depth *navigable*. The ones that fail (Victoria 3's disconnected screens, Dwarf Fortress pre-Steam, 75% of all web3 games launched 2018–2023) almost always fail at the same point: they present information without connecting it to action.

---

## 1. Strategy games solved progressive disclosure — steal their patterns

The grand strategy genre has spent two decades iterating on exactly the problem MANDATE faces: how to surface dozens of interconnected systems without overwhelming players. The solutions that emerged are remarkably consistent across studios and titles.

**Crusader Kings III's nested tooltips** represent the gold standard for progressive disclosure in information-dense games. Designer Philip Ardeljan's system lets players hover over any term to get an explanation, then hover over terms *within* that explanation for deeper context, creating an infinitely explorable information tree without ever leaving the current screen. A web designer who studied the system noted it was "surprisingly intuitive" — users keep their cursor still, locate what they want to learn more about, and drill in. This solves MANDATE's core challenge of displaying 7 resource types with production rates, consumption, and market prices: show the summary, let every number explain itself on hover, and chain those explanations as deep as needed.

**Europa Universalis IV's map modes** offer the most powerful spatial filtering system in gaming. Over 20 map modes recolor the entire game world to visualize a single data dimension — political control, trade routes, religious influence, development levels. Each mode transforms the same spatial canvas into a completely different information view. For MANDATE's hex-tile world map, this pattern maps directly: terrain mode, building mode, territory control mode, resource production mode, intelligence coverage mode. The key implementation detail is that **contextual tooltips change based on the active map mode**, so hovering over a hex shows different information depending on what the player is currently investigating.

**Factorio's alt-mode** introduces a toggle that overlays recipe and content icons on every machine, transforming the visual factory into an information-rich schematic. Players almost universally play with alt-mode enabled. The deeper lesson is that **the world itself is the visualization** — you can literally see bottlenecks by watching belt flow, rather than needing a separate analytics screen. Factorio's production statistics screen further demonstrates best practices: a unified search box filtering both production and consumption simultaneously, selectable timescales from 5 seconds to all-time, and interactive graphs with hovering and highlighting. The **Factoriopedia** (added in the Space Age expansion) allows players to ALT+click any entity to open its encyclopedia page directly, with browser-style back/forward navigation history — eliminating the need to alt-tab to a wiki.

The critical failure pattern across all these games is **outliner scaling**. Stellaris's right-side outliner — a scrollable list of all empire assets — becomes unusable in late-game, spawning the near-universally-installed "Tiny Outliner" mod. Civilization VI's vanilla UI is so insufficient that the CQUI community mod became essential. Victoria 3 fragments critical economic information across dozens of disconnected screens. **The lesson: interfaces designed for early-game scale reliably break down as complexity grows.** MANDATE should design for maximum complexity from the start, then use progressive disclosure to simplify the early experience — not the reverse.

---

## 2. Bloomberg's control room is MANDATE's design blueprint

Since MANDATE's aesthetic targets "Westworld control room meets AI lab operations centre," financial trading interfaces — not traditional game UI — provide the most relevant design language. Bloomberg Terminal's architecture maps almost perfectly to MANDATE's needs.

**Bloomberg's command-line interface is the single most transferable pattern.** Users type short mnemonics (`TOP <GO>` for top news, `OMON <GO>` for option monitor) and navigate between dense views instantaneously. This creates muscle memory that makes power users extraordinarily productive — a skilled Terminal user navigates between dozens of charts and graphs in milliseconds. The critical insight from UI density researcher Matt Ström is that **temporal density (how quickly users can move through information over time) is more impactful than visual density (how much stuff is on one screen)**. Bloomberg's killer feature isn't cramming more data onto each panel — it's making navigation between panels instant. For MANDATE, this means implementing a command bar where players type short codes (`RES` for resources, `ORD` for order book, `MAP` for world map, `AGT` for agent feed) with autocomplete and instant view switching. The Cmd+K command palette pattern, now standard in tools like Linear, Notion, and VS Code, is the modern evolution of this concept — combine it with Bloomberg-style mnemonics for the "professional operator" feel. The command palette's text input should render in Wudoo Mono, reinforcing the terminal aesthetic and the sense that the player is operating at the machine layer.

**Bloomberg's 4-panel system** lets users run independent workstations they switch between using a dedicated key — similar to virtual desktops but exclusively for data views. Interactive Brokers' Mosaic Layout takes this further with freely arrangeable window tiles that users drag and resize to create custom workspaces. **For MANDATE, the recommendation is a tiling layout with 2-4 configurable panels, preset layouts for different play styles ("Overview," "Trading," "Production," "Intelligence"), and the ability to create custom arrangements.** TradingView's approach — a dominant "hero" view occupying 60-70% of screen space with collapsible side panels — offers the best single-screen translation of multi-monitor trading setups.

**For the on-chain order book specifically**, the Depth of Market (DOM) price ladder is the established standard: a vertical list centered on current price, bids stacking below in green/blue, asks above in red, with volume shown as horizontal bars at each price level. Click-to-trade directly on the price ladder. Bookmap's heatmap visualization — time on X-axis, price on Y-axis, color intensity representing order size — creates a video-like view of how the order book evolves over time. Humans can spot patterns like spoofing and absorption "with a glance" in this format. Order book activity on MegaETH should surface as a live feed — not batch updates — making the chain's 10ms block speed *perceptible* as continuous motion rather than discrete refreshes.

**Typography for dense numerical data demands tabular (monospaced) numerals.** Proportional-width digits cause vertical misalignment in columns, making users misperceive magnitudes. Bloomberg commissioned Matthew Carter (creator of Georgia and Verdana) to create a custom font pair for this reason. The `font-variant-numeric: tabular-nums` CSS property is essential for any column of numbers.

---

## 3. MegaETH brand alignment: the authoritative design system

MANDATE is a native MegaETH product. The visual language is drawn directly from MegaETH's brand kit and the GDD's aesthetic direction. These values are locked — they override any generic fintech design recommendations.

**Colour palette.** Night Sky (#19191A) as primary background. Moon White (#ECE8E8) for primary text and UI elements. Accent colours drawn from MegaETH's pastel range — each of the seven resource types maps to a distinct colour from the official palette. This is a near-black + warm off-white system, not the cooler #121212 + #e0e0e0 palette common in generic dark mode. The Night Sky background is warmer and denser than pure dark grey; the Moon White text is softer and less clinical than standard off-white. Surface elevation should use subtle lightening of #19191A (e.g. #1f1f20 for raised panels, #252526 for modals/overlays) rather than shadows.

**Typography — dual register.** Helvetica Neue for the player-facing dashboard, portfolio views, market data, and all UI chrome — the professional ops console register. Wudoo Mono for all agent communications, mandate input fields, event feed entries, terminal outputs, and the command palette — the machine layer. The visual split reinforces the game's core tension: the human layer looks like a portfolio management tool, the agent layer looks like a terminal. When numerical data appears in the Helvetica Neue context (resource counts, prices, P&L), apply `font-variant-numeric: tabular-nums` to ensure column alignment. When agent actions stream into the activity feed in Wudoo Mono, they should feel like reading server logs — terse, timestamped, factual.

**Speed made visible.** MegaETH's identity is real-time. Every design decision that makes the chain's speed perceptible reinforces the brand. Agent actions surface as live streams, not batch updates. The order book is a live feed. World events arrive as breaking news hitting a trading terminal — not as popup notifications after a delay. Animations should be fast (100-200ms transitions) but *present* — the interface should feel like a system with momentum, not a static page that occasionally refreshes. Loading states should be near-instantaneous; if they exist at all, use a brief pulse animation rather than a spinner.

**Tone of voice.** Short, direct, technically specific, occasionally dry. No gamified enthusiasm ("Great job! You earned 500 tokens!"). No sanitised corporate neutrality. The register of someone who actually understands the subject matter. Tooltips should read like Bloomberg terminal field descriptions, not game tutorial prose. Error messages should be specific and actionable ("Insufficient COMPUTE: 340 available, 500 required for Training Cluster Tier 2") not vague ("Not enough resources").

---

## 4. Making blockchain invisible is the only viable path

The data on web3 game UX is damning: **75.5% of all web3 games launched between 2018 and 2023 became inactive**, with 53% of industry professionals citing poor UX as the biggest challenge. The games that survive treat blockchain as invisible infrastructure.

**Wallet connection must never precede gameplay.** Requiring wallet setup before showing value is "asking someone to install an engine before test-driving a car." The abandonment rate exceeds **70%** at wallet setup. The proven pattern is progressive disclosure: Gods Unchained lets players start with 85 free cards and no wallet, deferring crypto until they want to trade. Pixels uses email/phone signup with optional wallet connection and hit **1 million daily active players**. Primodium generates a browser-cached private key automatically — no MetaMask, no signing popups, no visible gas costs. For MANDATE, the recommendation is an **embedded smart wallet created on signup** (via Privy, Sequence, or similar Wallet-as-a-Service), with the option for crypto-natives to connect their own wallet later.

**Influence (Unstoppable Games) demonstrates the smartest UX pattern in on-chain gaming: designing game tempo around blockchain constraints.** In Influence, actions take minutes to days to complete (ships flying, buildings constructing), which naturally accommodates transaction confirmation times. Players never feel the blockchain because the game's pace inherently masks it. MANDATE's epoch-based structure and building construction timescales can exploit this same principle. For the 100ms reflex windows — where blockchain latency is obviously incompatible with real-time human action — the pattern from high-frequency trading applies: **humans configure rules in advance; machines execute within the window.** The UI role is setup and monitoring, not split-second decision-making.

**Session keys** (as implemented by Influence via Argent wallet on Starknet) allow players to sign once per session, then all subsequent in-game actions are automatically signed — mimicking a traditional game "login." **Account abstraction (ERC-4337)** eliminates the need for users to understand gas, nonces, or transaction signing. Dark Forest's plugin architecture proved that blockchain can enable genuinely novel game mechanics (cryptographic fog of war via zkSNARKs), but also demonstrated that on-chain games need thick UX layers — the community had to build essential quality-of-life features because the base UX was insufficient.

The Axie Infinity cautionary tale remains definitive: a **$1,500+ entry barrier**, shallow gameplay masked by earning incentives, complex multi-wallet setup, and an 86% user decline when token prices dropped. The lesson: extrinsic motivation (earning) without intrinsic motivation (fun) creates a player base that evaporates. MANDATE should ensure the strategy game is compelling independent of any token economics.

---

## 5. Three audiences, one interface, branching onboarding

MANDATE faces a **three-axis onboarding challenge**: crypto-natives who understand wallets but not strategy depth, strategy gamers who understand complex systems but not blockchain, and — critically — players unfamiliar with AI agents who have no mental model for "I write instructions and a machine interprets them." These axes are independent; a player might be strong on two and weak on the third, or weak on all three. The onboarding system must handle every combination.

**Self-declaration at signup creates the branching point.** Trello's approach — asking users about their experience during initial setup and tailoring the onboarding flow accordingly — achieved a **36% lift in activation**. For MANDATE, three independent toggles: "I'm familiar with crypto/wallets" / "I'm familiar with strategy games" / "I've used AI tools (ChatGPT, etc.)." Each selection enables or skips a corresponding tutorial track. Players who check all three skip directly to gameplay; players who check none receive all three tracks in a carefully sequenced order.

**CK3's nested tooltip system solves the "what does this term mean?" problem for all three audiences simultaneously.** Every concept — whether crypto-specific ("gas fee," "on-chain settlement"), game-specific ("diplomatic action," "resource conversion rate"), or AI-specific ("mandate interpretation," "agent confidence," "non-deterministic execution") — should be hoverable, with explanations that themselves contain hoverable terms. A persistent triple glossary (crypto terms + game terms + AI terms) should be always accessible.

### Axis 1: Crypto onboarding (for strategy gamers and AI-naive players)

Skip wallet setup entirely. Embedded smart wallet on signup, session keys for automatic signing, all blockchain jargon translated into game language. "Transaction fee" becomes "network cost" or is hidden entirely; "minting" becomes "building"; wallet addresses never displayed outside an advanced settings panel. Crypto-natives get an opt-in advanced panel showing on-chain details.

### Axis 2: Strategy onboarding (for crypto-natives and AI-naive players)

The "learn by doing" principle outperforms front-loaded tutorials. Miyamoto's Super Mario Bros. World 1-1 teaches through environment design, not text. Factorio's natural progression from manual crafting to automated production introduces complexity as players encounter the need for it. For MANDATE, the first 15 minutes should be playable with simplified mechanics — perhaps a single-resource economy and one building — gradually introducing the full 7-resource system, the order book, and the espionage layer as the player demonstrates competency. Always include a skip button; always provide a way back.

### Axis 3: AI/agent onboarding (for players who have never used AI tools)

This is the axis most games and products get wrong because they assume baseline AI literacy that doesn't exist. Half of adults struggle to translate strategic intent into precise written instructions — and MANDATE's entire core loop depends on this skill. The mandate editor is, in UX terms, a prompt engineering interface disguised as a strategy game.

**Round Zero — "The Agent Without a Mandate."** Before the player writes anything, show the agent acting with no instructions. It makes random trades, accepts bad deals, ignores threats. Then overlay a well-written mandate and replay the same scenario. The agent now trades strategically, stockpiles resources, and rejects unfavorable terms. This single demonstration establishes three critical mental models: the player's mandate is what matters, the agent is capable but needs direction, and mandate quality directly determines outcomes.

**Template-first writing, not blank page.** Provide pre-written mandates the player edits rather than creates from scratch. This lowers the articulation barrier (the gap between what users intend and what they can express in writing). A structured mandate builder — Priority Resource dropdown, Trading Aggressiveness slider, Hard Constraints checklist — generates natural-language text the player then customises. Midjourney's progression from "type any words" to advanced parameter syntax is the model: start with zero-parameter input, progressively reveal constraint tools as the player demonstrates competency.

**Teach that constraints are power, not limitation.** New players will write broad, open-ended mandates thinking they give the agent "freedom." Research shows role-based prompts improved AI output relevance by 34%, and constraints improved adherence by 25%. Round Four of onboarding should present an unconstrained mandate producing mediocre results, then show how adding three specific constraints dramatically improves performance. A visible "Mandate Clarity" score reinforces this.

**Address the five killer misconceptions directly through UI, not documentation:**

1. **"Same input = same output"** — Players will expect deterministic execution. The tutorial should show the same mandate running three times with different outcomes, framed as strategic variance, not a bug.
2. **"Broad instructions = better results"** — Show the vague-vs-specific comparison viscerally. Side-by-side outcomes with scores.
3. **"The agent understands what I mean"** — The intent preview pattern (agent states its interpretation before executing) catches misalignment before it costs the player.
4. **"I should be clicking buttons"** — Frame delegation as power: "You are the strategist; the agent is your operations team." Majesty (2001) proved this framing works — the player as quest-assigning ruler, not button-pressing hero.
5. **"The agent is a person"** — Use mechanical language ("your agent," not "your advisor"), Wudoo Mono for all agent communications, and when emotional mandates are detected ("please be careful"), surface a translation prompt: "Translate to: Reject any trade where we give more value than we receive?"

**Build trust through transparency, not magic.** Every agent action should be inspectable — click any action to see which mandate clause drove it, what conditions were evaluated, and what alternatives were considered. An autonomy dial per domain (Advisory → Supervised → Delegated → Full Autonomy) lets players set their comfort level. Auto-checkpoint before major decisions enables rollback. The existence of undo — even if rarely used — creates psychological safety that reduces delegation anxiety.

**The setup-execute-analyze loop is the core teaching mechanism.** Auto-battlers (TFT) already proved that the pattern at MANDATE's heart — write instructions, watch autonomous execution, analyze results, iterate — can be deeply engaging. Zachtronics' histogram feedback (showing how your solution compares to all other players across metrics) is directly applicable: show mandate performance as a distribution curve, not a single ranking. Gladiabots' real-time AI tree visualization — selecting a unit during replay shows which conditions were evaluated and which actions triggered — should be adapted for MANDATE's post-round replay: click any agent action and see which part of the mandate it was following.

**Progressive disclosure for the mandate editor:**

- **Tier 1 (Tutorial rounds)**: Single-sentence mandates with one clear objective. Template-based editing.
- **Tier 2 (Early game)**: Multi-clause mandates with conditions. "If attacked, prioritize defense; otherwise, expand territory." UI introduces "Add Condition" button.
- **Tier 3 (Mid game)**: Priority-weighted mandates with resource constraints and sliders.
- **Tier 4 (Advanced)**: Full mandate editor with conditional logic, agent personality tuning, diplomatic stance, and inter-round persistence controls.

The Dwarf Fortress Steam release provides the most dramatic evidence that UI is the bottleneck, not depth. The same game that earned ~$1M total over 15 years through donations sold **160,000 copies in 24 hours** and **over 1 million copies by April 2025** after receiving mouse support, tooltips, text filters, and scrollable menus. The underlying simulation didn't change. Only the UI did.

---

## 6. Taming real-time chaos across six simultaneous data streams

MANDATE's simultaneous real-time streams — agent activity, order book, world events, reflex windows, building production, epoch countdown — present the highest UX risk in the entire design. The research converges on a tiered priority framework and specific attention management techniques.

**Every notification needs a priority tier.** PagerDuty's Impact × Urgency matrix separates technical severity from business urgency — "not everything critical is urgent." For MANDATE, three tiers:

- **Tier 1 (Critical — accent red from MegaETH pastel range)**: Reflex windows, direct territorial attacks, critical agent failures. Interrupt with audio + visual + screen-edge glow against Night Sky.
- **Tier 2 (Warning — accent amber/yellow from MegaETH pastel range)**: Significant market movements, intelligence events, agent anomalies. Visual notification in Moon White with optional audio.
- **Tier 3 (Info — subdued, desaturated)**: Routine trades, building production updates, epoch progress ticks. Passive indicators with batched updates, rendered in dimmed Moon White or mid-grey.

**Smart batching prevents notification storms.** For MANDATE's agent activity feed (rendered in Wudoo Mono, streaming like server logs), group by agent/entity/time window — "Agent Alpha completed 3 trades in COMPUTE market" instead of three separate entries. Different urgency levels for different events, with **user-configurable thresholds per feed and event type**.

**Peripheral vision monitoring lets players focus on one stream while tracking others.** Screen-edge glows against Night Sky, subtle colour shifts using MegaETH accent pastels, and soft pulse animations (200-400ms) draw attention through peripheral motion detection without requiring direct focus. Compress non-focused panels to status indicator strips — a row of coloured dots showing "all systems normal" or "attention needed" — that expand to full detail on click.

**Collapsible panel layouts are essential for single-screen real-time interfaces.** The recommended MANDATE layout:

- **Dominant panel**: Main view (map or active task)
- **Right sidebar** (collapsible): Agent feed in Wudoo Mono, live stream
- **Left/bottom panel**: Order book as compact DOM-style price ladder
- **Below main**: World news/intelligence as expandable summaries (headlines in Helvetica Neue, detail expanding into Wudoo Mono)
- **Persistent top bar**: Epoch timer, alert banner, resource summary — all in Helvetica Neue with tabular numerals
- **Bottom status bar**: Building production heartbeat — periodic polling, not event-driven

**For the 100ms reflex windows**, the HFT pattern applies: humans don't make 100ms decisions — machines do. The UI provides pre-configuration, visual countdown, one-key manual override, immediate outcome feedback, and historical replay. This transforms reflex windows from a reaction-time challenge into a strategic configuration challenge.

---

## 7. Dense, dark, and keyboard-first: the 2025–2026 design moment

Current UX trends align almost perfectly with MANDATE's design needs and MegaETH's brand identity.

**"Minimalist maximalism" or "productive density" is the dominant paradigm.** Pure minimalism is losing ground. Linear uses super-contrast font weights, crisp dense data layouts, and keyboard-first workflows. Discord proves younger audiences navigate rich, dense interfaces without issue. The winning formula is **structured density**: bento grid layouts, clear visual hierarchy, and progressive disclosure. MANDATE's Night Sky + Moon White system naturally creates high contrast; MegaETH pastel accents provide colour coding without visual noise.

**The Cmd+K command palette is now standard in professional tools.** Superhuman's principles: available everywhere, central, omnipotent, flexible (fuzzy matching), context-aware, and educational (showing shortcuts next to commands). The `cmdk` React library by Pacocoursey is the most popular implementation. For MANDATE, combine Bloomberg-style mnemonics with Cmd+K — rendered in Wudoo Mono against a slightly elevated Night Sky panel.

**Real-time data patterns have matured.** TanStack Query is the standard for server state management with WebSocket integration. For important operations, a deliberate 500ms "Processing…" state increases user confidence. Skeleton screens within 300ms. `prefers-reduced-motion` respected.

**Dark UI is correct for MANDATE, and Night Sky (#19191A) is the right foundation.** Dark UIs improve scanning performance, reduce eye strain, make data colours pop, and signal seriousness. Implementation: Night Sky (#19191A) not pure black; Moon White (#ECE8E8) not pure white; surface elevation via subtly lighter Night Sky variants; MegaETH pastel accents desaturated ~10-15% when used as status indicators.

---

## 8. Seven patterns that reliably kill complex game interfaces

**1. Informative but not actionable UI** — Victoria 3's defining sin. Information fragmented across screens with no link to available actions. **Every screen showing a problem must link directly to the screen where you fix it.**

**2. Blockchain jargon in gaming interfaces** — "Gas fees," "approve token allowance," "mint." Translate everything into game language or hide it entirely.

**3. AI jargon in gaming interfaces** — "Prompt," "token," "context window," "temperature," "non-deterministic." None of these should appear in player-facing UI. "Prompt" → "mandate." "Token limit" → "instruction length." "Non-deterministic" → "your agent interprets your strategy freshly each round." The Wudoo Mono / Helvetica Neue split helps: technical terms can appear in the machine layer (Wudoo Mono); everything in the dashboard layer (Helvetica Neue) should be in game language.

**4. Scaling failure in late-game interfaces** — Stellaris outliner, Civ VI vanilla UI. Design for peak complexity from the start. Stress-test at maximum scale.

**5. Front-loaded complexity** — Primodium's 15 empty resource trackers on first screen. Aurora 4X's database tables. Start with 2-3 visible systems.

**6. Notification spam** — PagerDuty's principle: "when everything is important, nothing is important." Batch, tier, auto-dismiss, user-configurable.

**7. Assuming baseline AI literacy** — Products that expect effective natural-language instructions without scaffolding lose half their audience at the input field. The blank mandate editor is MANDATE's most dangerous screen — it must never be the first thing a new player sees.

---

## 9. Conclusion: the design playbook crystallised

**Core architecture**: Tiling panel system with Bloomberg-style instant navigation. Cmd+K command palette in Wudoo Mono. 2-4 configurable panels with presets and custom layouts. Keyboard shortcuts for every action. Night Sky (#19191A) throughout, Moon White (#ECE8E8) for primary text, MegaETH pastels for resource colour coding. Helvetica Neue for the dashboard layer. Wudoo Mono for the machine layer.

**Three patterns carry more weight than all others combined:**

1. **CK3's nested tooltips** — every number, concept, and status indicator hoverable with chained explanations. Solves progressive disclosure for all three knowledge axes simultaneously.
2. **Factorio's "world as visualization"** — the hex map encodes information visually so players read game state from the map itself.
3. **Bloomberg's temporal density** — prioritise instant switching between views over cramming everything onto one screen.

**The blockchain must be completely invisible to start.** Embedded wallets, session keys, game-language translations. Crypto-natives get an opt-in advanced panel.

**The AI must be taught through demonstration, not documentation.** Round Zero shows the agent acting without a mandate (chaos) then with one (competence). Template-first editing lowers the articulation barrier. Structured builders scaffold free-form writing. Intent preview catches misalignment. Inspectable action logs connect outcomes to mandate clauses. The autonomy dial lets players choose their delegation comfort level. Delegation framed as strategic authority.

**The unifying principle**: every piece of information displayed must connect directly to an action the player can take from that same context. Information without action is noise. Action without information is confusion. MANDATE's interface should ensure that no player ever sees a problem without being one click from its solution.
