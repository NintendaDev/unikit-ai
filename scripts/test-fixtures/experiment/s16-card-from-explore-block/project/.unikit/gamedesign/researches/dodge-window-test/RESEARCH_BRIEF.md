# Research Brief: A short slow-motion window after a perfect dodge

- **Question**: whether a short slow-motion window after a perfect dodge makes fights feel skillful and not confusing.
- **Key findings**:
  - A slow motion after a precise move makes a timing success visible, but it is an assumption that it works here.
  - A tint is the usual way to tell a special state from a fault.
  - The first three enemy types attack in readable patterns, so a perfect dodge is possible against each.
- **Implications for our design**: the pillar of readable combat is tested by whether testers can say when the window opened; the pillar of earned mastery is tested by whether they call the dodge their own skill.
- **Recommended follow-up**: build an experiment card from the block below.

## Experiment Plan

- **Hypothesis**: if a perfect dodge opens a half-second slow-motion window, then testers will describe their fights as skillful, because the window turns a timing success into something they can see and feel.
- **Judged on**:
  - Skillful — success: testers say the dodge was their own doing; failure: testers say it happened by itself.
  - Clear — success: testers can say when the window opened; failure: testers call it lag.
- **Design essentials**:
  - Only a perfect dodge opens the window, because a reward for any dodge stops rewarding precision.
  - The window lasts about half a second — an assumption: long enough to see, short enough not to stall the fight.
  - A screen tint shows that the window is open, so that a tester can tell it from lag.
- **Rejected alternatives**:
  - Any dodge opens the window — it would no longer reward precision.
  - A longer window with a counter-attack bonus — set aside for a later experiment, because it changes two things at once.
- **Protocol options**:
  - Two arenas, one with the window and one without, the same testers in both — strengthens Clear, weakens Skillful because testers compare and talk about it.
  - One arena with the window, testers asked afterwards in their own words — strengthens Skillful, weakens the comparison. Recommended, because the question is whether the dodge feels like skill, and a comparison would answer a different one.
- **How the test could mislead**: a stutter of the picture on the tester's device makes the window look like lag (the observer notes the device and asks before the session); veterans who wait for the window change how they play (the observer notes early dodges); testers who were told the purpose answer to please (the purpose is not announced).
- **What each outcome decides**:
  - If the hypothesis is supported on both qualities, the window goes into the next build as it is.
  - If it is supported on Skillful and not on Clear, the tint is reworked and the test is repeated.
  - If it is not supported, the window is dropped and the dodge keeps its present feedback.
  - If the result is inconclusive, the test is repeated with more fights per tester.
- **Open questions**: OQ-1 — how many fights a tester needs before the window feels normal; OQ-2 — whether the tint should fade in.
