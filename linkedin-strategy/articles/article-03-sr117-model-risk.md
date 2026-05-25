# Article 3 — The Model Risk Reality
## "What SR 11-7 Actually Looks Like From the Inside — If You're the Vendor"

**Publish:** Week 7  
**Length:** ~2,000 words  
**Why this works:** Almost nobody writes about SR 11-7 from the vendor's perspective. Everyone writes from the bank's perspective. This positions you as someone who has actually been through it, not someone who read the guidance document.

---

## FULL ARTICLE TEXT

---

SR 11-7 is twelve years old. Most AI vendors building for financial services have read about it. Very few have been through what it actually means to have their model reviewed against it.

I have. And the gap between reading the guidance and being on the receiving end of a model risk review is large enough that I think it's worth describing honestly.

This is not a compliance tutorial. There are plenty of those. This is what it looks like in practice — the questions you don't expect, the documentation gaps you only discover when someone else is looking for them, and the things that make a model risk team say yes versus the things that make them say "we need more time."

---

### What SR 11-7 Is Actually Asking For

The guidance is organized around conceptual soundness and ongoing monitoring. These sound like abstract requirements until you're in a room where someone is specifically asking you to demonstrate them.

Conceptual soundness, in practice, means: can you explain why the model works the way it does, in terms that someone without a machine learning background can evaluate? Not explain the math. Explain the logic. Why are these features predictive of this outcome? What is the economic intuition? What would have to be true about the world for this model to stop working — and have you thought about when those conditions might occur?

Most ML vendors are prepared to explain the math and the metrics. Very few are prepared for the economic intuition conversation. Examiners and model validators are not asking whether your AUC is 0.85. They are asking whether the model makes sense — whether there's a reason, grounded in how the world works, why these inputs produce these outputs.

The first time I sat through a model review where this distinction became clear, it was with a feature our model used that performed well statistically but was difficult to explain intuitively. The validator's question was simple: "Why would this variable be predictive of default risk?" We could show that it was. We had a much harder time explaining why it should be. That distinction — between demonstrating performance and explaining logic — is central to SR 11-7 and is not always obvious from reading the document.

---

### The Documentation Gap

Model documentation under SR 11-7 is supposed to be comprehensive enough that someone with appropriate technical skills — but without access to the model developer — could evaluate the model. This is a high bar.

The specific documentation failures I've seen most often:

**Sparse assumption documentation.** Every model makes assumptions about the world. The guidance requires you to document them. The failure mode is documenting assumptions at too high a level — "the training data is representative of the target population" rather than "the training data covers originations from 2015–2022, during which time [specific market conditions] prevailed, and the model may underperform during conditions materially different from this period." Specificity is the difference between documentation that satisfies a reviewer and documentation that creates more questions.

**Missing limitations sections.** SR 11-7 expects explicit documentation of what the model does not do well. This is counterintuitive for product teams whose instinct is to lead with strengths. Validators are specifically looking for evidence that you understand your model's weaknesses — because a developer who can't articulate limitations is a developer who hasn't tested for them.

**Validation by the people who built it.** The guidance requires model validation to be conducted by people who are independent of model development. For smaller AI vendors, this is often a genuine structural problem — the team is small, everyone is involved in building, and independent validation isn't operationally feasible in-house. This comes up in reviews. Having a credible answer about how you've addressed the independence requirement — whether through a third-party validator, a formal internal separation, or a transparent acknowledgment of the limitation with compensating controls — matters.

**No sensitivity analysis.** What happens to model outputs when key assumptions change? What happens to performance if the input data quality degrades? These stress tests are expected documentation and are frequently missing from vendor-provided model packages.

---

### What Actually Gets Models Rejected in MRC Review

Model risk committees are diverse. They include risk, compliance, legal, business, and often IT security. Each stakeholder has a different definition of "not ready."

The model risk team's objections are usually technical. Not enough validation data. Independence concerns. Documentation gaps I described above.

Compliance objections are usually about fair lending — specifically, whether the model creates or perpetuates disparate impact, and whether there's an adequate framework for generating adverse action notices when the model declines an application. (More on this in the fair lending article — it deserves its own treatment.)

Legal objections are often about data provenance. Where did the training data come from? Who has rights to it? What's in the licensing agreement with the data provider? These questions sound administrative but have killed deals.

IT security objections are about the hosting environment, data handling, and what happens to customer data that touches your system. If you can't clearly answer "where does customer data go, who has access to it, and how is it protected," the IT security stakeholder will recommend not approving until those questions are answered. This is not unreasonable. But it's also not the conversation most AI vendors prepare for.

The deals that move through MRC review cleanly are the ones where the vendor has anticipated each stakeholder's specific concerns and prepared answers in advance. The deals that stall are the ones that show up prepared for the model risk questions and then get surprised by the compliance or legal or IT questions they weren't expecting.

---

### The Timeline Reality

Model approval timelines at banks are not primarily a function of how ready the model is. They're a function of when the MRC meets, how full their agenda is, and how many other models are in queue.

MRC committees meet monthly at most institutions. Some quarterly. Getting on the agenda requires completing the documentation package in advance — often 4–6 weeks before the meeting — and passing an initial review by the model risk team before the full committee sees it. If your documentation package generates questions that require additional work, you've missed the meeting and you're waiting for the next one.

This means the practical timeline for model approval is not "how long does the review take" but "how many committee cycles does it take to get through." One cycle is optimistic. Two is common. Three or more happens when documentation is incomplete or objections surface that require substantive changes.

The implication for product timelines is significant. If you're planning a bank deployment and assuming model approval takes a few weeks, you are planning wrong. If you haven't asked the bank specifically about their MRC cadence and queue, you don't have enough information to give your own leadership an honest timeline.

---

### What I Would Do Differently

The things I'd change if I were starting over with what I know now:

Build model documentation as a first-class product artifact, not as something you produce at the end of development. The documentation requirement should shape what you build and how you build it — not be an afterthought that describes something you've already shipped.

Find a third-party validator before you need one. The independence requirement is real and takes time to address. Having a relationship with a firm that can provide independent validation means you're not scrambling when a bank asks for it.

Ask for a model risk pre-review before submitting formally. Many banks will do an informal review of your documentation package to flag gaps before the formal MRC process. This is worth requesting explicitly. The informal feedback you get from the model risk team before the official submission is more valuable than anything you'll get after, because it lets you address issues without consuming a full committee cycle.

And — the thing that took me longest to internalize — don't treat model risk management as a compliance hurdle. It's actually doing a useful thing. The validators who pushed hardest on our models were the ones who found the limitations that would have created problems in production. The rigor isn't the obstacle. Learning to work with it rather than around it is the difference between a vendor that builds durable relationships with banks and one that burns through introductions.

---

*This is the kind of thing I talk through in detail with founders who are building AI products for regulated financial institutions. If you're navigating this, I'm happy to share what we learned. DM me.*

*What's the model risk or compliance question that has surprised you most in a bank deployment? I'd like to hear what's showing up right now.*

---

**[POSTING NOTES]**
- Teaser 2 days before: "SR 11-7 is twelve years old and most AI vendors building for banks have read about it. Very few have been through what it actually means to have their model reviewed against it. There's a large gap between the two. Writing this up Thursday."
- First comment within 1 hour: "The thing that surprised me most the first time: the question wasn't 'does the model perform well.' It was 'why should this variable predict this outcome.' Demonstrating performance and explaining economic logic are completely different conversations."
