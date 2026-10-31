# Clipnote Design Guide

How Clipnote should look, feel and behave across the web app and the Chrome extension. This is the reference for every UI change.

Clipnote is a **tool people use while watching something else**. Every screen should be quiet, fast and out of the way. The video and the user's words are the content; the interface is the frame.

> Research notes: the principles below draw on Linear's own write-ups ([how we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui), [behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh)) and on public catalogues of AI-generated design tells ([925 Studios](https://www.925studios.co/blog/ai-slop-design-tells), [Fountain Institute](https://pages.thefountaininstitute.com/posts/7-tells-that-a-ui-is-ai-generated), [Capital & Compute](https://capitalandcompute.net/blog/fix-ai-slop-design/), [impeccable.style](https://impeccable.style/slop)). Several of those sources are opinion pieces and vendor blogs, so treat them as heuristics, not proof.

---

## 1. Principles

1. **Content earns the weight.** Not every element carries equal visual weight. The note text and the video are loud; navigation, icons and chrome recede. (Linear: "Don't compete for attention you haven't earned.")
2. **One place for each thing.** If the same information is on screen twice, delete one. (We shipped a "Jump to a moment" list that duplicated the notes list; it was removed.)
3. **Speed is a feature.** Optimistic updates, keyboard shortcuts, no spinners where a skeleton or instant state works. Saving a note should feel instantaneous.
4. **Opinionated defaults, few settings.** Choose the right behaviour instead of adding a toggle.
5. **Density with air.** Tight, scannable rows for lists; generous space only around the single thing the user is doing.
6. **Real content over decoration.** Empty states, onboarding and marketing show real product behaviour and specific copy, not abstract shapes.
7. **Consistent across surfaces.** The extension popup, the web app and the iOS share flow use the same tokens, type and tone.

## 2. Reference products and what to borrow

| Product | Borrow | Do not borrow |
|---|---|---|
| **Linear** | Muted hierarchy, softened borders that only clarify relationships, fewer icons, near-zero latency, keyboard-first | Its dark-purple marketing look (it is the origin of the generic "SaaS dark" aesthetic) |
| **Raycast** | Command palette as primary navigation, dense lists with a clear selected state, keyboard hints inline | Heavy gradients on chrome |
| **Notion** | Text-first pages, calm neutrals, content as the hero, a light theme that is genuinely good | Block-menu complexity |
| **Superhuman** | Shortcut hints taught in context, one clear primary action per screen | Dense power-user onboarding |
| **Arc** | Personality in small moments (empty states, transitions), sidebar as the home of navigation | Novel navigation that needs learning |
| **Readwise Reader / Matter** | Highlights and notes anchored to the source, reading-first layouts | Feed-style discovery |

## 3. Visual language

### Colour
- Neutral surfaces carry ~90% of the UI. Dark is default; light must be equally polished.
- **One accent: coral** for the single primary action per view (Save, Add video).
- **Violet is reserved for AI** (Mark & let AI write, summaries, Clipchat). Never decorative.
- Semantic colours (success, danger, warning) are used only for state.
- Tokens live in `web/src/styles/index.css`; the extension mirrors them in `extension/style.css`. Never introduce a hex value outside the tokens.

### Typography
- Inter for UI, JetBrains Mono for timestamps and kbd hints only.
- Max three sizes per screen: page title, body, caption. Weight 500/600 for emphasis; avoid 700+.
- Note text is the largest body text on the page.

### Shape, borders, shadow
- Borders at low contrast define regions; shadows only on floating layers (menus, dialogs, palette).
- Radius scale by role: controls 10px, cards 14px, dialogs 18px. Not everything is "as round as possible".
- No coloured accent stripes on cards.

### Icons
- Line icons at one stroke weight. An icon appears only when it speeds recognition; do not put an icon beside every label.
- Never emoji as icons.

### Motion
- 120–200 ms, ease-out, for state changes. Motion confirms an action (note saved, item removed); it does not entertain.
- No looping ambient animation behind content. Respect `prefers-reduced-motion`.

## 4. Layout patterns

- **App shell:** left sidebar (Library, Clipchat, Settings), top bar with search/palette and the one primary action.
- **Video page:** player and video actions on the left; notes on the right. The notes list is the timeline, so no second timeline.
- **Lists:** one row style, hover reveals secondary actions, selected row is obvious, keyboard-navigable.
- **Empty states:** one sentence on what goes here, one action to fill it, optionally a real example.
- **Extension popup:** 360 px wide; video title, timestamp, a text area, Save. Nothing else.

## 5. Copy

- Say what happens: "Save note", "Remove video", not "Get started" or "Unlock".
- Specific numbers or none. Never invented stats or testimonials.
- Sentence case everywhere. No exclamation marks, no "supercharge", "seamless", "revolutionize", "next-generation".

---

## 6. DO NOT: tells of AI-generated design

If a visitor can guess "an LLM built this" in five seconds, we failed. Each item below is a pattern commonly cited as a giveaway. Avoid them, or use them deliberately and sparingly.

**Colour and effects**
- Do not use the purple-to-blue (or purple-to-pink) gradient as brand identity, especially on a white or near-black background. It is the most-cited tell.
- Do not add aurora or radial "glow" blobs behind hero sections or page headers.
- Do not use glassmorphism (blurred translucent panels) as the default card style.
- Do not use gradient text on headings as decoration.
- Do not use glowing borders or neon shadows on dark mode.
- Do not add decorative grid or dot patterns behind the hero.

**Typography**
- Do not rely on Inter/Geist at default weights with no typographic decisions beyond that. If using Inter, make hierarchy, size contrast and spacing do real work.
- Do not centre-align long text or headings plus subheading plus two buttons as the only hero.
- Do not set every heading in the same bold weight and size ratio.

**Layout and components**
- Do not build the "hero, three feature cards, testimonial row, pricing, CTA" template.
- Do not make every card the same size, radius and padding. Hierarchy means some things are bigger.
- Do not use a coloured left border stripe on cards or alerts.
- Do not put a pill-shaped badge with a sparkle above the hero headline ("✨ New").
- Do not scatter floating decorative mockups, orbiting icons or fake dashboards that show no real data.
- Do not add a visible scroll-triggered fade-up on every section.
- Do not use identical icon-in-rounded-square tiles for every list of features.

**Content**
- Do not write copy that could sit on any product's website ("Supercharge your workflow", "Built for modern teams").
- Do not invent metrics, logos, testimonials or user counts.
- Do not use emoji as bullets or icons.
- Do not use em-dash-heavy, rule-of-three marketing sentences ("Fast. Simple. Powerful.").

**Behaviour and polish**
- Do not ship generic empty states ("No data found") or placeholder lorem text.
- Do not leave default browser focus rings or default form controls unstyled; do not remove focus rings either.
- Do not animate everything on load.
- Do not make dark mode a mechanical inversion; check contrast and elevation separately.

## 7. Self-audit of the current build

Honest read of what we have today against section 6. Status after the first cleanup pass: gradient text, aurora/glow blobs, grid pattern, glass panels, the "New" pill and 3xl radii are removed (marked done). The rest are still open.

| Tell | Where it appears | Action |
|---|---|---|
| Gradient text and violet-to-coral gradient identity | Landing headline, logo mark, `text-gradient` utility | Keep the logo mark; drop gradient text from headings; use solid fg with one coral word at most or none |
| Aurora glow backgrounds | App shell top bar/page background, landing, login, 404 (`bg-aurora`) | Remove from the app shell entirely; flat `--bg` inside the product; at most one subtle accent on the landing page |
| Grid pattern behind hero | `bg-grid` on landing | Remove |
| Glassmorphism | Top bar and palette (`glass`) | Solid `--bg-elev` with a border; blur only if content scrolls underneath and it helps |
| Floating animated mockups | `HeroMock`, `PhoneMock`, `animate-float` | Replace with a static screenshot of the real video page; no float animation |
| Same-radius rounded-2xl everywhere | 40+ uses | Apply the radius scale in section 3; cards 14px, controls 10px |
| Hero + feature-cards template | Landing page | Rewrite around one real demo (video + notes), then a short list of three concrete behaviours with real screenshots |
| Icon on every row/label | Sidebar, buttons, note meta | Remove icons that do not aid recognition; keep type icons on notes only if the label is dropped, not both |
| Generic copy | Landing and empty states | Rewrite in the voice of section 5 |
| Duplicate information | Removed: "Jump to a moment" repeated the notes | Rule 2 above; review the video page for anything else shown twice (e.g. repeated type badges and filter counts) |

## 8. Definition of done for a UI change

- [ ] Uses tokens only; no new hex values.
- [ ] Checked in dark and light.
- [ ] One primary action per view.
- [ ] No information shown twice.
- [ ] Keyboard reachable with a visible focus ring.
- [ ] Reduced-motion respected.
- [ ] Copy follows section 5.
- [ ] None of the section 6 tells introduced.
- [ ] Extension popup updated if the change affects shared tokens.
