# Article 1 — The Core Contrarian Piece
## "Every AI Sales Deck I've Seen in Financial Services Is Pitching the Wrong Thing"

**Publish:** Week 1  
**Length:** ~1,800 words  
**Why first:** This is the insight that positions you immediately as someone who has been inside enterprise deals, not just read about them. It will resonate hard with founders who are stuck in slow sales cycles and don't understand why.

---

## FULL ARTICLE TEXT

---

I have sat in a lot of AI sales pitches. I have given a lot of them. And I have watched the same thing happen repeatedly — the vendor presents a compelling ROI story, the room nods along, and then nothing moves for six months.

For a long time I thought this was a procurement problem. Then I thought it was a champion problem. Then I thought it was an education problem — banks just didn't understand the technology well enough to move quickly.

I was wrong on all of them.

The actual problem is simpler and harder to fix: vendors are pitching value creation into organizations that are structurally optimized to manage risk. These are different conversations. They require different framing, different stakeholders, and different definitions of success. When you show up pitching one and the buyer is evaluating the other, you get a lot of polite interest and very slow pipelines.

---

### What Banks Are Actually Optimizing For

Ask most enterprise AI vendors what drives a buying decision at a bank and they'll tell you: ROI, efficiency gains, cost reduction. They'll point to cost-per-loan metrics, processing time reduction, headcount avoided.

This is not wrong exactly. But it's not the primary driver.

The primary driver in a regulated financial institution is defensibility. Not "does this generate value" but "can I stand behind this in front of an examiner." Not "does this reduce cost" but "if this goes wrong, can I explain why I chose it." The lens is not P&L optimization. It is risk management — and the risk being managed is regulatory, reputational, and operational, in that order.

This matters because the decision-makers who care about ROI and the decision-makers who care about defensibility are often different people. The business line leader cares about ROI. The chief risk officer cares about model risk. The chief compliance officer cares about whether this creates fair lending exposure. Legal cares about the audit trail. And none of these people have the same calendar, the same budget authority, or the same definition of a successful outcome.

When a vendor pitches ROI, they typically get the business line leader excited. The business line leader then tries to move it through the organization. And that's where it slows down — not because people aren't interested, but because every other stakeholder is being asked to evaluate something using a framework that doesn't match how they think about their job.

---

### The Framing That Actually Works

When we repositioned how we talked about our product — not "here is the value you'll create" but "here is the risk you'll be able to manage, and here is how you'll be able to defend this to an examiner" — the conversations changed.

Compliance teams started engaging earlier instead of waiting to veto at the end. Model risk teams started asking questions about what we could show them rather than preparing to say no. Legal started looking for reasons to proceed rather than reasons to object. None of this happened because the product changed. It happened because the framing matched how these stakeholders actually thought about their work.

There are a few specific shifts that matter.

**Lead with the regulatory narrative, not the performance story.** A bank's model risk team needs to be able to defend to OCC or Fed examiners that they understood what they were approving. Start there. What documentation can you provide? What does your model card say? What does model performance look like across demographic segments? If you can answer these questions before you're asked, you've immediately differentiated yourself from every other vendor who shows up with an accuracy metric and a demo.

**Define success in their terms before defining it in yours.** Ask early: "What would your model risk committee need to see to approve this?" and "What would compliance need to be comfortable with?" Then structure your POC to answer those questions explicitly. Most vendors structure POCs around demonstrating model performance. The vendors who convert structure POCs around eliminating the objections that will surface in approval committees.

**Find the risk officer, not just the business owner.** The business line owner is motivated to move. The risk officer is motivated to be careful. But the risk officer is often the one who can actually unblock things once they're convinced — because the risk officer's job is to say no to the things that create exposure, not to say no to everything. When you can show a risk officer that your system reduces their exposure rather than creating new exposure, you have a genuine ally rather than an obstacle.

---

### What This Looks Like in Practice

We were in a deal with a mid-size bank's consumer lending division. The business line was genuinely enthusiastic — we had done a proof of concept that showed meaningful improvement in underwriting accuracy and processing speed. By the traditional sales logic, this should have moved forward.

Instead it stalled for four months. Every time we asked about next steps, the answer was "we're still working through internal alignment."

What we eventually learned — after getting more direct access to the conversations happening behind the scenes — was that the model risk team had concerns they hadn't fully articulated to the business line. They weren't sure they could defend the model's feature set under fair lending scrutiny. They weren't sure how they'd document adverse action reasons for declines. And they weren't confident that what we called "explainability" was what their examiners would accept as explainability.

None of these were fatal objections. All of them were solvable. But they had been invisible to us because we had structured the entire engagement around the business line's priorities, not the risk team's.

When we got in front of the model risk team directly and led with their concerns rather than our capabilities, the deal moved in six weeks.

---

### The Harder Implication

If enterprises in regulated industries buy to manage risk rather than create value, then the AI products that will win in this market are not necessarily the ones with the best performance metrics. They are the ones that are easiest to approve.

This is counterintuitive for technical founders. A lot of energy goes into making models more accurate, faster, cheaper. Far less goes into making models more auditable, more documentable, more defensible under regulatory scrutiny. But in this market, the second set of properties often matters more than the first.

"Easy to approve" means something specific: your model documentation follows SR 11-7 structure and your team knows what that means. Your validation framework is legible to someone who isn't your engineer. You have run the demographic analysis and can show the results honestly, even when they're complicated. Your adverse action framework can generate documentation that satisfies Regulation B requirements. These aren't features in the product sense. They are the conditions under which the product can be used.

The vendors who build these properties in from the beginning spend less time in model risk review, fewer cycles explaining things that should have been documented upfront, and fewer deals lost at the approval stage to objections that were always coming and always fixable.

---

### What I'd Tell Founders Building in This Space

Stop pitching what you built. Start pitching what the buyer needs to be comfortable approving.

Those are not the same conversation, and the difference between them is where most financial services AI deals live or die. Not in the demo. Not in the POC performance. In the gap between what a vendor thinks is the decision and what the institution actually has to go through to make it.

Go find the risk officer before you've optimized for the business owner's approval. Understand what their model risk committee reviews look like. Ask to see a previous model they approved and understand what made them comfortable. Build your pitch around those specifics rather than around your benchmark results.

The vendors who understand that regulated enterprises aren't optimizing for value — they're optimizing for defensibility — are the ones who stop wondering why their pipelines are slow and start building the organizational infrastructure to move through them.

---

*I've worked on both sides of this — building AI products for regulated financial institutions and navigating the organizational dynamics of getting them through approval. If you're in the middle of this, I'm happy to compare notes. DM me.*

*What's the objection that killed your last financial services AI deal? Curious what's showing up in the comments.*

---

**[POSTING NOTES]**
- Teaser 2 days before: "We had a great POC result. The business line loved it. It then sat in internal review for four months. That's not a procurement problem. It's a framing problem — and it's the same framing problem I see in almost every AI deal in financial services. Writing this up Thursday."
- First comment within 1 hour: "The moment this clicked for us: we stopped asking 'what do we need to prove' and started asking 'what does the model risk committee need to feel comfortable approving.' Completely different question."
- Tag 2-3 fintech founders you know who are in enterprise sales cycles
