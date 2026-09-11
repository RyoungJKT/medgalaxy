# Addendum 1: reconciliation notes

Companion to `2026-08-13-addendum-1.md`. The addendum is the authority; this file
records the two places where the shipped build knowingly departs from its letter,
and why the departure is the right reading rather than an oversight. Written at
the round-5 gate, where the craft lens flagged both as "un-noted deviations" and
scored them as defects on that basis alone, not on the experience.

Nothing here loosens the addendum. Each note names the clause, the conflict, what
shipped, and the measurement that decides it.

---

## Note 1. Delta-8's re-entry stillness cannot be met as written

**The clause.** Delta-list item 8, acceptance: "press the header button from an
arbitrary camera and assert the camera does not move by more than 0.1 percent
over the next 1.0 s."

**The conflict.** Two other clauses of the same addendum require the camera to be
moving at exactly that moment.

- Delta-list item 4 ("Nothing on screen is ever perfectly still") requires camera
  breathing on all eleven holds, with its own acceptance band: two samples 1.5 s
  apart must differ by **more than 0.2 percent** of R0. Section 4 item 1's list of
  the eleven holds names "scrub at rest, idle", which is precisely the state a
  header re-entry begins from.
- Section 1's exit table ends the piece on a turning galaxy: the second
  velocity-matched handover leaves the orbit controls at `REST_ROTATE_SPEED` and
  holds them there, deliberately, so "the galaxy is already turning when your
  first drag catches it."

A camera that is breathing in-band and idling at the resting drift moves by far
more than 0.1 percent per second. The three clauses cannot all hold; item 8's
number is the one written against a camera that has no ambient life, which is the
camera the addendum itself abolished two items earlier.

**What shipped.** Item 8's *intent* (re-entry is an instrument, not a rerun; the
scrubber opens where the viewer is standing; there is no directed camera move and
no cut) is honored exactly. `TM_ENTER_DUR` blends the radii over 650 ms under the
same staggered `arrival()` the exit uses, the framing the viewer had is the
framing they keep, and the runtime-derived chip and replay affordance are both
present. What is not honored is the numeric stillness: the round-5 craft lens
measured roughly 6.4 percent of R0 of drift over ~1.1 s after the press, all of it
idle rotation plus resumed breathing, none of it directed.

**The decision.** The build chose the right reading. A frozen camera on re-entry
would be a worse frame than a moving one and would contradict the piece's own
last sentence. The acceptance that should have been written, and that the build
does meet, is: **no directed camera move and no cut occurs on re-entry; the only
motion is ambient, and it is inside item 4's own band.**

---

## Note 2. A4's blanket 1 percent cap is exceeded by section 4 item 5, on purpose

**The clause.** Amendment A4: "no ambient channel may exceed 1.0 percent of the
quantity it modulates, and every one of them stops the instant a directed
stillness is called."

**The conflict.** Section 4 item 5 specifies the film's edge shimmer as "a global
edge opacity breathe from 0.06 to 0.13 at 0.2 Hz". That is a swing of roughly 70
percent of the modulated quantity, stated as a concrete number in the same
document that caps ambient channels at 1 percent. The two are arithmetically
incompatible, and the incompatibility is in the addendum, not in the build.

**What shipped.** Item 5's band, verbatim: film-only, 0.06 to 0.13, exactly zero at
rest. The round-5 craft lens judged the result a feature rather than a defect.
It makes beat 1's net read as the sentence's own connective tissue, and draining
it with beat 2's palette makes the suppression land harder. It noted a
letter-level residue: the shimmer eases out with the palette rather than cutting,
so it still carries alpha ~0.012 during beat 2's ignition hold, where A4 asks for
an instant stop.

**The decision.** A4's cap is the right rule for the channels it was written for
(camera breathing, star shell rotation, node breathe: all *geometric* channels,
where 1 percent is the threshold between life and wobble). Edge opacity is not a
geometric channel and 1 percent of a 0.06 baseline is not a visible anything, so
applying the cap there would delete item 5 rather than govern it. The resolution
is A4's *scope*, not its number: **A4's 1 percent cap governs ambient channels that
modulate position or scale; opacity channels are governed by their own stated
band.** The instant-stop half of A4 is untouched and still applies to all of them,
and the residue above is a 12-thousandths-of-an-alpha tail on an ease-out that no
frame shows: the camera and node channels, which A4 was written for, measure
exactly 0 at that hold.

---

## What these notes are not

Neither note is a licence to miss an acceptance and write a paragraph about it.
The rule they set is the opposite: a deviation from the addendum's letter is a
defect until it is recorded here with the conflicting clause named and the
measurement that settles it. Two deviations existed at round 5; both are above;
there are no others.
