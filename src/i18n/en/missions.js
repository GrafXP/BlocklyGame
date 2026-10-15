// The missions' words in English, the source language (PLAN.md §8, §9): each
// mission's title, its goal in one short sentence, how far along it is, its
// three hints and its reward, keyed by mission id (src/content/missions/).
// Every other language has these keys, with the same {name} placeholders.
//
// The hints go from looking, to thinking, to trying (docs/campaign-plan.md,
// “A consistent hint ladder”). Block words in quotes are the blocks' own, as
// the editor shows them (blocks.js).
export default {
  // The bridge slice: mission 15 of the campaign. Robo 1 brings wood to the
  // sawmill, which makes planks; Robo 2 carries planks on, to the depot until
  // the player sends them to the construction site, which builds the bridge
  // from four.
  "slice.title": "Across the Stream",
  "slice.goal": "Work together to build our bridge.",
  // For screen readers, beside pictures of the four planks the bridge needs.
  "slice.progress": "Planks at the construction site: {have} of {need}",
  "slice.hint.look": "Look at the construction site. What does it need, and who brings it?",
  "slice.hint.think": "Follow one piece of wood all the way to the bridge. Where does Robo 2 take the planks?",
  "slice.hint.try": "Change Robo 2's “go to” after the pickups to the construction site, and apply. Then put “build bridge” under the construction site's start block, and apply that too.",
  "slice.reward": "The bridge is open! Robo 3 is crossing the stream to fetch stone.",
};
