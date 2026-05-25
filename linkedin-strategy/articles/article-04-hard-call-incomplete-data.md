# Article 4 — The Hard Call
## "The Decision I Had to Make When There Was No Right Answer and No Time to Wait"

**Publish:** Week 13  
**Length:** ~1,700 words  
**Why this works:** Personal, specific, honest. Not a framework article — a story about navigating genuine uncertainty. This one builds trust and credibility in a way technical articles can't.

---

## FULL ARTICLE TEXT

---

There is a version of decision-making under uncertainty that gets written about a lot — the theoretical version, with frameworks and decision trees and probability-weighted outcomes. That version is useful, but it doesn't describe what it actually feels like to make a consequential call when you don't have the information you need, the clock is running, and there's no obvious right answer.

I've made that kind of decision. I've made it in the context of a product deployment where the regulatory environment was genuinely unclear, the timeline was fixed, and waiting for certainty would have cost us something we couldn't recover.

I'm going to describe what that was like, not because the specific situation is universal, but because the structure of the decision is — and I've never seen it described honestly from the inside.

---

### The Setup

We were deploying an AI model for a financial services client — a lending application that would make real decisions affecting real applicants. The regulatory question was specific: our model used a feature set that the client's compliance team believed was acceptable under fair lending guidelines, but for which there was no clear regulatory precedent in this specific application context.

The guidance that existed didn't directly address our use case. Different people read the same guidance differently. Our outside legal counsel said one thing. The client's internal compliance team said another, slightly different thing. The regulator hadn't issued a ruling on anything close enough to this to be directly applicable.

The options were:

**Option A:** Remove the feature and remodel. This would take three to four months, push the deployment timeline, and meaningfully degrade model performance — which had implications for the business case we'd committed to.

**Option B:** Deploy with the feature, document our analysis, and accept the regulatory risk that we might be required to modify later.

**Option C:** Request a formal regulatory opinion before deploying. This would take an unknown amount of time — potentially six months, potentially longer — and there was no guarantee we'd get a clear answer.

There was no option that was obviously correct. Each one had a genuine downside that I couldn't hand-wave away.

---

### What the Decision Actually Felt Like

I want to be specific about this because it's the part that doesn't get described accurately.

The frameworks I'd read suggested that good decisions under uncertainty involve defining your options clearly (done), estimating probabilities (not really possible in a novel regulatory situation), and weighing expected outcomes (also difficult when the key variable is regulatory interpretation that doesn't exist yet).

What I actually had was: a set of incomplete information, time pressure, and a set of people who were looking to me to call it. The legal counsel had given me her opinion. The compliance team had given me theirs. The client's business leader had been clear about what they needed from a timeline perspective. I had spent a week trying to find more information that would make the decision clearer and concluded that more information was not coming in the time I had.

The thing I kept coming back to was not "what is the probability that we're right" but "what is the consequence of being wrong, and can we manage it?" With Option B — deploying with the feature and documentation — the consequence of being wrong was a requirement to modify the model after deployment. That was a real cost. It was not existential. And the documentation we could produce — the analysis, the legal opinion, the compliance review, the rationale — was the kind of documentation that demonstrated good faith effort, which matters in regulatory contexts even when the underlying decision turns out to be wrong.

With Option C — waiting for a regulatory opinion — the consequence of being wrong was a destroyed business relationship and lost revenue that we would not recover. And the regulatory opinion might never come in a form that actually resolved the ambiguity.

I chose Option B. With the documentation standard set as high as we could make it, knowing we might be required to modify, and accepting the uncertainty as a known risk rather than pretending it wasn't there.

---

### What Made It Defensible

The decision wasn't defensible because it was clearly right. It was defensible because of how it was made and documented.

We documented the specific regulatory question that was ambiguous. We documented every source of guidance we'd consulted. We documented the specific interpretations each party had given us and the reasoning behind each interpretation. We documented our own analysis of which interpretation we found most persuasive and why. We documented what we would do if a regulatory development required us to revise.

This is different from making a decision and hoping it holds up. It is making a decision in a way that, if it later comes under scrutiny, there is a clear record of the process — that we identified the issue, sought appropriate guidance, made a reasonable judgment, and prepared for the possibility of being wrong.

In regulated environments, this distinction matters. Examiners and regulators are not only evaluating whether your decision was correct in hindsight. They are evaluating whether you operated with appropriate care, sought appropriate input, and were honest about the uncertainty you were navigating. A well-documented decision that turns out to be wrong is treated very differently from an undocumented decision that turns out to be wrong.

---

### What I Would Change

I would start the regulatory analysis earlier and be more aggressive about surfacing ambiguity when I first identified it.

The situation I described reached decision-point urgency partly because we hadn't pushed hard enough, early enough, on resolving the uncertainty. We had flagged it as a concern. We hadn't treated it as a blocking issue until it was close to blocking.

If I were doing it again: the moment there is a regulatory question that doesn't have a clear answer, that question becomes the top priority, not a background concern. Because the later in the process you identify the issue as unresolved, the fewer options you have and the more time pressure you're under. Urgency reduces optionality. And optionality is what you want when the decision is genuinely hard.

I also underestimated how much clarity I could get by being more direct with regulators earlier. Not requesting a formal opinion — that's a long, formal process. But having informal conversations with examiners or regulatory counsel to test our interpretation before we were deep into deployment. In my experience, regulators are more willing to provide informal directional feedback than most companies assume. You have to ask for it explicitly, and you have to do it early.

---

### The Part That Doesn't Fit in a Framework

The decision had to be mine. I had consultants and counsel and compliance team input. At the end of it, I was the person accountable for what we chose. And there was no information that was going to arrive in time to make the decision obvious.

What I've noticed, looking back, is that the quality of the decision wasn't primarily about the analysis. It was about being willing to make the call rather than indefinitely seeking more certainty, and then being deliberate about how the call was made and documented.

The people who are most effective in genuinely uncertain situations are not the ones with the best analytical frameworks. They're the ones who can hold real uncertainty — not pretend it doesn't exist, not get paralyzed by it — and make a defensible call anyway.

That's a capacity, not a framework. And it gets built the hard way, which is by having to make these decisions for real and then living with the outcomes.

---

*These are the decisions that advisory relationships are built for — the ones where you want someone in your corner who has been in a similar situation and can help you think through what matters. If you're navigating something like this, reach out.*

*What's the decision you've had to make with incomplete information in a regulatory or compliance context? I'd like to hear how others have handled it.*

---

**[POSTING NOTES]**
- Teaser 2 days before: "I've written about frameworks for decision-making under uncertainty. This week I'm writing about an actual decision — specific situation, genuine ambiguity, real consequences, no clear right answer. Dropping Thursday."
- First comment within 1 hour: "The thing I've come to believe: in genuinely novel regulatory situations, how you make and document the decision matters as much as what the decision is. Examiners are evaluating process, not just outcome."
