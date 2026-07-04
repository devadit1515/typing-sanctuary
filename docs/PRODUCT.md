# Product

## Register

product

## Users

**Primary: research- and credibility-driven visitors** — people (including assessors of the
keystroke-biometric work) for whom the headline is the science: *can how you type verify who you
are?* They arrive curious or skeptical and need to come away trusting that the numbers are real and
honestly reported.

**Secondary: players** — competitive typists chasing WPM, races, leaderboards and friends. The game
is genuine and fun, but strategically it is also the **vehicle that produces the keystroke data**
the research depends on. Players must feel first-class; credibility must never come at the cost of a
worse game.

Context of use: web, multi-page app served by Express. Sessions range from a quick race to enrolling
a biometric profile to reading a results/verification dashboard.

## Product Purpose

Typing Sanctuary is a real-time multiplayer typing game with a **keystroke-biometric verification
layer** layered on top: it learns the rhythm of *how* a person types and uses it as a behavioural
biometric — both as a login gate and a continuous session guard.

Why it exists: a password proves knowledge, not identity. The project's thesis is that typing rhythm
can close part of that gap, and it backs the claim with an **honestly measured** open-set result
(EER ≈ 0.10–0.14 on the CMU benchmark, reported with its variance, not a flattering closed-set
number). Success = a visitor leaves believing both that the game is good *and* that the security
claim is real and not overstated.

## Brand Personality

> **Provisional — the user deferred final wording ("build it later").** Treat this as a working
> hypothesis to confirm before serious visual work, not a settled brand voice.

Working direction: **rigorous, precise, earned-trust** — the feel of a credible scientific
instrument that still has the kinetic sharpness of a speed product. Confidence comes from clarity and
honest numbers, not from spectacle. It is allowed to feel alive (it *is* a typing game), but never at
the expense of looking trustworthy.

Open question for later: how much "alive / kinetic" vs "calm / instrument-like" the balance should
land on (the deferred Round-2 personality choice).

## Anti-references

The interface should **not** read as any of these (all four were explicitly rejected — the design
must avoid every obvious lane, not just one):

- **The current neon-glass cyberpunk look** — glow effects, animated gradient blobs, frosted-glass
  cards. This is what the app looks like today; it is being moved away from.
- **Generic dark SaaS** — navy/purple gradient dashboards, glowing stat cards, the templated
  AI-dashboard aesthetic.
- **Flashy esports / gamer** — RGB, aggressive angular shapes, hype energy, Twitch-overlay styling.
- **Sterile corporate security** — cold enterprise trust-theater: stock padlock imagery, lifeless
  blue-gray, compliance-brochure feel.

The challenge this sets: credibility *without* the corporate-security cliché, and energy *without*
the gamer/neon cliché.

## Design Principles

1. **Earn trust, don't decorate it.** Credibility is communicated through clarity, honestly-reported
   numbers, and precision — never through security-theater imagery or decorative effects.
2. **The data is the hero.** Typing rhythm, WPM, accuracy, EER and verification verdicts are the
   substance; the interface's job is to surface them legibly and let them carry the weight.
3. **Be honest by default.** Never imply accuracy or security the system hasn't actually measured
   (this mirrors the project's core research-honesty rule: no fabricated metrics, open-set results
   stated with their variance).
4. **Speed is both the subject and the standard.** It's a typing app — the interface should feel as
   precise and responsive as the thing it measures. Latency and jank are off-brand.
5. **Avoid the obvious lane.** Reject the four saturated aesthetics above by name; reach for a
   distinctive direction that suits a fast, credible, research-grounded typing product.

## Accessibility & Inclusion

Best-effort defaults (no formal WCAG commitment requested), applied as good practice:

- Body-text contrast ≥ 4.5:1; honor `prefers-reduced-motion` with non-motion alternatives.
- Full keyboard operability — non-negotiable for an app whose entire point is typing.
- Extra care that the **typing / test surface itself stays maximally legible** under speed, since
  that is where users spend the most attention.
