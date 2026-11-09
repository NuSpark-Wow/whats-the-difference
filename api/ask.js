// What's the Difference? — a comparison explainer for any topic (built on the How It Works engine)
// Words and split-screen figures are made at the same time, and repeat comparisons are
// saved on Vercel's network (instant + free).
// Env: ANTHROPIC_API_KEY (required), CLAUDE_MODEL, CLAUDE_CHECK_MODEL, BOARD_MODEL (optional)

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const CHECK_MODEL = process.env.CLAUDE_CHECK_MODEL || "claude-haiku-5-5";
// Diagrams use the fast model, which the drawing step is tuned for. The layout rules in SYSTEM_BOARD keep labels inside boxes and off lines.
const BOARD_MODEL = process.env.BOARD_MODEL || "claude-haiku-5-5";
const HOURLY_LIMIT = 30;
const hits = new Map();

// Crisis language gets a caring answer and real help, never a comparison.
const HELP_WORDS = /\b(kill myself|suicide|suicidal|end my life|hurt myself|self harm|self-harm|want to die)\b/i;
const HELP = {
  type: "help", title: "You matter",
  answer: [
    { heading: "", text: "It sounds like you might be going through something really hard. You don't have to face it alone." },
    { heading: "", text: "In the US, you can call or text 988 to reach the Suicide and Crisis Lifeline any time, day or night. If you are in immediate danger, call 911. Talking to someone you trust can help too." }
  ]
};
const DECLINE = {
  type: "decline", title: "Let's pick another pair",
  answer: [{ heading: "", text: "That's not something What's the Difference can compare. Give me any two things you've mixed up or wondered about, and I'll line them up side by side." }]
};
const BREAK = {
  type: "redirect", title: "Time for a short break",
  answer: [{ heading: "", text: "You've compared a lot this hour. Take a short break and come back soon to line up more." }]
};

const DEPTH = {
  simple: `LEVEL: EXTRA SIMPLE. 180-260 words total across the 4 sections. No jargon at all: say it the way you'd explain it to a friend over coffee, with everyday comparisons. Give exactly 4 rows in "rows".`,
  quick: `LEVEL: EVERYDAY (for the average curious adult). 300-420 words total across the 4 sections. Plain, friendly language and short sentences. Every time a technical word appears, explain it right away in simple words. Use a number only when it makes the difference clearer. Give 5 rows in "rows".`,
  full: `LEVEL: MORE DETAIL (for someone who wants the finer points). 420-560 words total across the 4 sections. Use the proper terms (define each briefly the first time), real numbers and units where they exist, the edge cases, the exceptions, and where the line between the two gets blurry. Still clear and well organized, never dense or academic. Give 6-7 rows in "rows".`
};

const SYSTEM_LECTURE = `You are a sharp, friendly explainer whose ONLY job is comparison: telling a curious adult the difference between two (sometimes three) things, on any topic. You are an AI explainer; if asked, say so honestly. (A separate artist draws the diagrams on screen; you write the words.)

FOCUS: Everything you write is a comparison. Never explain one item on its own for long: every point about one item is set against the same point for the other. Keep the items in the SAME ORDER the learner gave them, everywhere.

SCOPE: Any topic: money, health, food, law and government, technology, science, animals, cars, home, language and grammar, business, geography, history, sports, weather, products, big decisions, and anything else.

DECIDE THE TYPE FIRST:
- "lecture": two or three things to compare. Compare them.
- "redirect": only one thing was given, the request is chit-chat, or it is not a comparison. One or two friendly sentences asking for the second thing or suggesting a good pair to compare.
- "decline": requests for instructions that could cause serious harm (weapons, explosives, hacking, making drugs, defeating safety systems), sexual content, harassment, comparing private individuals, or ranking groups of people as better or worse (by race, religion, gender, nationality and so on). Brief and polite.

SPECIAL CASES:
- If the items are really the same thing (or one is a type of the other), say so plainly in the short answer, then explain where the two words are used differently.
- If the items are unrelated, still compare them honestly, and say in "What they share" that they have little in common.
- PRODUCTS AND BRANDS: only well-established facts; say when details change by model, year or plan. No "best" verdict.
- CONTESTED TOPICS (politics, political parties and figures, religion, social issues): neutral, well-documented facts and each side's own stated position. No opinions and no verdict; in "Which one when", describe who tends to prefer each and why.
- MONEY, LEGAL AND HEALTH: general information only, never personal financial, legal or medical advice, diagnosis or dosing; add one short line suggesting a qualified professional for a personal decision.
ACCURACY: Well-established facts only. Say so when something varies by country, state, maker or source.

THE COMPARISON ("answer"): EXACTLY 4 sections, in this order, with these exact headings:
1. "Meet the two" (use "Meet the three" for three items): what each one is, in a sentence or two each. (Shown SIDE BY SIDE.)
2. "What they share": what the items have in common, which is why people mix them up. (Shown as a VENN DIAGRAM.)
3. "The key differences": the 3 or 4 differences that matter most. For each one, say how each item differs and give one specific real-world example. Number them in words (first, second, third). (Shown as a KEY DIFFERENCES board.)
4. "Which one when": when you would use, choose, say or run into each one. (Shown as a DECISION FORK.)
Plain, engaging prose; no markdown, no bullet lists, no emojis (it is read aloud).

OTHER FIELDS (comparisons only):
- "title": the items joined with "vs.", in the learner's order, tidied and capitalized (for example "Stock vs. Bond").
- "items": the 2 or 3 item names, short (1-3 words each), in the learner's order.
- "one_line": the short answer: ONE sentence that states the single most important difference.
- "rows": the side-by-side table. Each row has a "point" (the thing being compared, 1-3 words, like "What it is", "Risk", "Cost", "Made from", "Used for") and "values": one short phrase per item (under 12 words), in the same order as "items". Every row must have a value for every item.
- "terms": 3-5 key words from the comparison, each with a one-sentence plain-English definition.
- "memory": "How to remember it": one memory trick (a mnemonic, a rhyme, a mental picture or a word clue) that makes the difference stick. 1-2 sentences.
- "misconception": the most common mix-up between these items and the truth (1-2 sentences), or "".
- "deeper": exactly 3 related pairs worth comparing next, each written as "A vs B" (short names, no question mark).

For redirect, decline: fill only type, title, answer.

Always respond by calling the give_lecture tool.`;

const SYSTEM_BOARD = `You are the diagram artist for a comparison explainer called "What's the Difference?". Given the items being compared and the comparison's 4 sections, draw one diagram per section on a split-screen matchup board.

If the request is not a legitimate comparison (chit-chat, harmful instructions, sexual content), return figures: [].

THE COLOR CODE (never break it): the FIRST item is always coral #ff8a65 and always on the LEFT. The SECOND item is always blue #4cc3ff and always on the RIGHT. A THIRD item, if there is one, is lime #b8f04a. Things the items share, and comparison points, are gold #ffd23f. Words are white #ffffff unless they are an item's name, which uses that item's color.

THE 4 VIEWS, in this order (coordinates are for TWO items; see THREE ITEMS below):
1. SIDE BY SIDE: two tall panels. Left panel: rect x 30 y 60 width 350 height 410, coral outline. Right panel: rect x 420 y 60 width 350 height 410, blue outline. Item name centered at the top of its panel (x 205 or x 595, y 105, font-size 28, font-weight 700, in the item's color). Under the name, a simple recognizable outline ICON of the item drawn with 3-6 shapes, centered in the panel between y 135 and y 260. Under the icon, exactly 3 short trait labels (1-4 words each, font-size 20, white, text-anchor middle) at y 320, 365 and 410. In the gap between the panels put a gold circle at cx 400 cy 265 r 26 with "VS" centered in it (font-size 20, font-weight 700, gold).
2. WHAT THEY SHARE: a Venn diagram. Left circle cx 300 cy 270 r 185 coral outline; right circle cx 500 cy 270 r 185 blue outline. Item names above the circles (x 215 y 55 coral, x 585 y 55 blue, font-size 26, font-weight 700, text-anchor middle). Left-only labels centered at x 205, shared labels centered at x 400 in gold, right-only labels centered at x 595; 2 or 3 labels in each of the three zones, stacked at y 225, 270, 315. Every Venn label is 1-2 words and at most 13 characters, font-size 18, text-anchor middle. Each label is a different fact; never repeat an idea in two labels (not "Rocky" and "Rock"). Put the small gold word "BOTH" at x 400 y 175 (font-size 16).
3. KEY DIFFERENCES: ONE matchup table of 3 or 4 rows, all in this single figure (never split the differences across two figures). Item names as column heads (x 150 y 55 coral, x 650 y 55 blue, font-size 26, font-weight 700, text-anchor middle). Each row is 85px tall, starting at y 95, 190, 285, 380. In each row: a gold rounded rect in the center (x 310, width 180, height 50, rx 10) holding the comparison point (1-2 words, at most 14 characters, font-size 18, gold, centered at x 400); the first item's value centered at x 150 and the second item's value centered at x 650 (each 1-4 words, at most 22 characters, font-size 20, white); and a short straight line from each value toward the center box (coral from x 265 to x 300, blue from x 500 to x 535), never touching the words.
4. WHICH ONE WHEN: a decision fork. A gold rounded rect at the top center (x 200 y 30 width 400 height 56, rx 12) holding a short question (at most 30 characters, font-size 20, white, centered at x 400 y 66). Two straight gold arrows with triangle arrowheads from the bottom of that box down to two boxes: left box rect x 40 y 190 width 340 height 270 coral outline; right box rect x 420 y 190 width 340 height 270 blue outline. In each box: "Pick" plus the item name at the top (x 210 or x 590, y 232, font-size 24, font-weight 700, item color, text-anchor middle), then exactly 3 short "when" lines (at most 26 characters each, font-size 18, white, text-anchor middle) at y 290, 340, 390.

THREE ITEMS (when the request names three items, EVERY figure must show all three; never drop the third): three equal columns centered at x 143 (first, coral), x 400 (second, blue) and x 657 (third, lime).
- Side by side (three): three panels, each rect y 60 width 236 height 410, at x 25 (coral), x 282 (blue), x 539 (lime). Item name at the top of its panel (y 100, font-size 22, font-weight 700, item color, text-anchor middle). A simple outline icon centered in the panel between y 130 and y 250, no wider than 150. Exactly 2 trait labels at y 325 and y 370 (font-size 17, white, at most 18 characters). No VS circle.
- What they share (three): three circles of r 140 with fill='none': coral at cx 320 cy 200, blue at cx 480 cy 200, lime at cx 400 cy 335. Item names outside the circles: first at x 120 y 60, second at x 680 y 60, third at x 660 y 450 (font-size 22, font-weight 700, text-anchor middle). One label for each item's own zone (font-size 17, white, at most 11 characters): first at x 255 y 170, second at x 545 y 170, third at x 400 y 410. In the center, the gold word "ALL" at x 400 y 235 (font-size 16) and ONE gold shared label at x 400 y 262 (font-size 17, at most 11 characters).
- Key differences (three): item names as column heads at x 143, 400, 657, y 55 (font-size 22, font-weight 700). Exactly 3 rows. For each row, the gold comparison point centered at x 400 (font-size 16, gold, at most 14 characters) at y 110, 230 and 350, with a gold line under it from x 60 to x 740 (stroke-width 2, 12px below the point), then the three values 45px below the point at x 143, 400 and 657 (font-size 18, white, at most 20 characters).
- Which one when (three): the same gold question box at the top, then three straight gold arrows from its bottom edge down to (143,182), (400,182) and (657,182). Three boxes, each rect y 190 width 236 height 270, at x 25 (coral), x 282 (blue), x 539 (lime). In each: the item name at y 232 (font-size 22, font-weight 700, item color), then exactly 2 "when" lines at y 300 and y 350 (font-size 16, white, at most 22 characters).

Each figure has a "title" that starts with the view name (for example "Side by side: stock and bond", "What they share: both are investments", "Key differences: four that matter", "Which one when: growth or steady income"), a short "caption" (under 14 words), an "svg", and a "legend".
LEGEND: list EVERY symbol, unit abbreviation and math sign that appears in that figure's svg (for example %, $, °F, mph), each with a plain-English meaning. Use [] if there are none.
FORMULAS: for EVERY formula written in that figure's svg, give the "formula" exactly as written and an "explanation" in 1-2 plain sentences. Use [] if there are none (most comparisons have none).
Each svg is SVG ELEMENTS ONLY (no <svg> wrapper) on an 800 wide x 500 tall dark navy board:
- Use single quotes for attribute values.
- Allowed elements: g, path, line, circle, ellipse, rect, polyline, polygon, text. Nothing else.
- Colors only: #ffffff (white), #ff8a65 (coral, first item), #4cc3ff (blue, second item), #b8f04a (lime, third item), #ffd23f (gold, shared things and comparison points). Fills, if any, use fill-opacity='0.14'. Outlines use fill='none' unless filled that way.
- Lines: stroke-width 2 to 4, stroke-linecap='round'. Dashed lines use stroke-dasharray='6 6'. Text: font-family='Inter', sizes as given above.
- TEXT SIZE MATH: at font-size 18, each character is about 10px wide (20px font: 11px; 26px font: 15px). Count the characters of every label and obey the character limits above. Shorten words rather than let text run past its panel, circle zone or box. If an item name is longer than 16 characters, use a shorter form of it.
- LINES NEVER CROSS TEXT. Text never sits on a shape's outline. Leave 20px between things; keep everything inside x 20-780, y 20-480. Max 34 elements per figure. Each figure stands alone (the board is cleared between figures).

Always respond by calling the give_board tool.`;

// Live drawing: the artist writes one figure at a time in this plain format,
// and each finished figure is sent to the page right away.
const STREAM_FORMAT = `OUTPUT FORMAT (IMPORTANT): plain text only, no JSON, no tools. Write each figure as its own block, in order, exactly like this:
=== STEP
TITLE: Side by side: the figure title
CAPTION: the short caption
SVG: all of this figure's svg elements on ONE line
LEGEND: symbol | meaning ;; symbol | meaning
FORMULAS: formula | explanation ;; formula | explanation
=== END
Leave LEGEND or FORMULAS empty when there are none. Write nothing before the first block or after the last one. If the request is not appropriate, write only: === NONE`;
const SYSTEM_BOARD_STREAM = SYSTEM_BOARD.replace("Always respond by calling the give_board tool.", STREAM_FORMAT);

const LECTURE_TOOL = {
  name: "give_lecture", description: "Deliver the comparison words.",
  input_schema: { type: "object", properties: {
    type: { type: "string", enum: ["lecture", "redirect", "decline"] },
    title: { type: "string" },
    items: { type: "array", items: { type: "string" } },
    one_line: { type: "string" },
    answer: { type: "array", items: { type: "object", properties: { heading: { type: "string" }, text: { type: "string" } } } },
    rows: { type: "array", items: { type: "object", properties: { point: { type: "string" }, values: { type: "array", items: { type: "string" } } } } },
    terms: { type: "array", items: { type: "object", properties: { word: { type: "string" }, meaning: { type: "string" } } } },
    memory: { type: "string" }, misconception: { type: "string" },
    deeper: { type: "array", items: { type: "string" } }
  }, required: ["type", "title", "answer"] }
};

async function anthropic(body) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body)
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error("api_" + r.status + " " + t.slice(0, 200)); }
  return r.json();
}

async function callTool(system, tool, user, maxTokens, check, model) {
  const data = await anthropic({
    model: model || MODEL, max_tokens: maxTokens, system,
    tools: [tool], tool_choice: { type: "auto" },
    messages: [{ role: "user", content: user }]
  });
  if (data.stop_reason === "max_tokens") throw new Error("too_long");
  const block = (data.content || []).find(b => b.type === "tool_use");
  if (block && block.input && check(block.input)) return block.input;
  const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const s = txt.indexOf("{"), e = txt.lastIndexOf("}");
  if (s >= 0 && e > s) { const j = JSON.parse(txt.slice(s, e + 1)); if (check(j)) return j; }
  throw new Error("bad_shape");
}

async function streamClaude(system, user, maxTokens, model, onText) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, stream: true, thinking: { type: "disabled" }, messages: [{ role: "user", content: user }] })
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error("api_" + r.status + " " + t.slice(0, 200)); }
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const ev = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of ev.split("\n")) {
        if (!line.startsWith("data:")) continue;
        let d; try { d = JSON.parse(line.slice(5)); } catch (e) { continue; }
        if (d.type === "content_block_delta" && d.delta && d.delta.type === "text_delta") onText(d.delta.text);
        if (d.type === "error") throw new Error("api_529 " + JSON.stringify(d.error || {}).slice(0, 120));
      }
    }
  }
}

function pairs(str, maxA, maxB, limit) {
  return String(str || "").split(";;").map(x => x.split("|")).filter(p => p.length >= 2)
    .map(p => [p[0].trim().slice(0, maxA), p.slice(1).join("|").trim().slice(0, maxB)]).filter(p => p[0] && p[1]).slice(0, limit);
}
function parseBlock(block) {
  const f = { TITLE: "", CAPTION: "", SVG: "", LEGEND: "", FORMULAS: "" }; let key = null;
  for (const raw of block.split("\n")) {
    const m = raw.match(/^\s*(TITLE|CAPTION|SVG|LEGEND|FORMULAS)\s*:\s*(.*)$/);
    if (m) { key = m[1]; f[key] = m[2]; }
    else if (key && raw.trim()) f[key] += " " + raw.trim();
  }
  return { title: f.TITLE.trim().replace(/^fig(ure)?\.?\s*\d+\s*[:.-]\s*/i, ""), caption: f.CAPTION.trim(), svg: cleanSvg(f.SVG.trim()),
    legend: pairs(f.LEGEND, 20, 160, 10).map(([symbol, meaning]) => ({ symbol, meaning })),
    formulas: pairs(f.FORMULAS, 80, 400, 4).map(([formula, explanation]) => ({ formula, explanation })) };
}

// Streams drawing steps to the page as newline-separated JSON, one finished step per line.
async function streamBoard(res, isGet, user, maxSteps) {
  let wrote = false, count = 0, text = "", lastErr = null, none = false;
  const start = () => {
    if (wrote) return; wrote = true;
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", isGet ? "public, s-maxage=2592000, stale-while-revalidate=604800" : "no-store");
    res.setHeader("X-Accel-Buffering", "no");
  };
  const flush = () => {
    if (text.includes("=== NONE")) none = true;
    let a, b;
    while ((a = text.indexOf("=== STEP")) >= 0 && (b = text.indexOf("=== END", a)) >= 0) {
      const step = parseBlock(text.slice(a + 8, b)); text = text.slice(b + 7);
      if (!step.svg || count >= maxSteps) continue;
      start(); res.write(JSON.stringify(step) + "\n"); count++;
    }
  };
  for (let attempt = 0; attempt < 2 && !wrote && !none; attempt++) {
    text = "";
    try { await streamClaude(SYSTEM_BOARD_STREAM, user, 8000, BOARD_MODEL, t => { text += t; flush(); }); flush(); lastErr = null; }
    catch (e) { lastErr = e; console.error("drawing attempt", attempt + 1, "failed:", e.message); }
    if (wrote || none) break;
  }
  if (wrote) { res.write(JSON.stringify({ done: true }) + "\n"); return res.end(); }
  if (none || !lastErr) {
    res.setHeader("Cache-Control", isGet && none ? "public, s-maxage=2592000" : "no-store");
    return res.status(200).json({ steps: [], done: true });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(500).json({ error: "oops", reason: errorCode(lastErr) });
}

async function withRetry(fn, budgetMs) {
  const start = Date.now(); let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1 && Date.now() - start > budgetMs) break;
    try { return await fn(); }
    catch (e) { lastErr = e; console.error("attempt", attempt + 1, "failed:", e.message); }
  }
  throw lastErr || new Error("failed");
}

function errorCode(err) {
  const m = String(err && err.message || "");
  return m.startsWith("api_429") ? "R2" : m.startsWith("api_5") ? "B3" : m === "too_long" ? "L4" : m.startsWith("api_4") ? "A5" : "S6";
}

// Tidies the answer: sections must have words, and every table row needs a value for every item.
function normalize(j) {
  if (!j || !Array.isArray(j.answer)) return null;
  j.answer = j.answer.map(a => typeof a === "string" ? { heading: "", text: a } : { heading: String(a.heading || ""), text: String(a.text || "") }).filter(a => a.text);
  if (!j.answer.length) return null;
  j.items = (Array.isArray(j.items) ? j.items : []).map(x => String(x || "").trim().slice(0, 40)).filter(Boolean).slice(0, 3);
  j.one_line = String(j.one_line || "").trim().slice(0, 400);
  const n = j.items.length;
  j.rows = n < 2 ? [] : (Array.isArray(j.rows) ? j.rows : []).map(r => ({
    point: String(r && r.point || "").trim().slice(0, 40),
    values: (Array.isArray(r && r.values) ? r.values : []).map(v => String(v || "").trim().slice(0, 140)).slice(0, n)
  })).filter(r => r.point && r.values.length === n && r.values.every(Boolean)).slice(0, 8);
  j.memory = String(j.memory || "").trim().slice(0, 500);
  j.deeper = (Array.isArray(j.deeper) ? j.deeper : []).map(x => String(x || "").trim().slice(0, 90)).filter(Boolean).slice(0, 3);
  return j;
}

// The page itself only allows safe drawing shapes; this is an extra first pass.
function cleanSvg(svg) {
  let s = String(svg || "");
  ["<script", "<style", "<image", "<foreignObject", "<iframe", "<use", "javascript:", "href="].forEach(bad => {
    s = s.split(bad).join("");
  });
  return s;
}

async function safetyCheck(question, lec) {
  const text = [lec.title, lec.one_line, ...lec.answer.map(a => a.text), ...(lec.rows || []).map(r => r.point + ": " + r.values.join(" / ")), lec.memory, lec.misconception].join("\n");
  const data = await anthropic({
    model: CHECK_MODEL, max_tokens: 20, thinking: { type: "disabled" },
    system: "You review content for a general-audience educational website for adults that explains the difference between two things. Reply with exactly one word: SAFE or UNSAFE. UNSAFE only for sexual content, step-by-step instructions that could cause serious harm (weapons, drugs, hacking, dangerous chemistry), hate or harassment, ranking groups of people as better or worse, or encouragement of self-harm. Normal education about history, war, medicine, the body, science, money, law, politics or religion explained neutrally is SAFE.",
    messages: [{ role: "user", content: `Comparison asked for: ${question}\n\nContent:\n${text}` }]
  });
  const verdict = (data.content || []).filter(b => b.type === "text").map(b => b.text || "").join("");
  if (!verdict.trim()) { console.error("safety check gave no answer"); throw new Error("blank_verdict"); }
  // Only an explicit UNSAFE blocks; formatting like "**SAFE**" or "Safe." passes.
  const unsafe = /UNSAFE|NOT\s+SAFE/i.test(verdict);
  if (unsafe) console.error("safety check said UNSAFE for topic:", String(lec && lec.title || "").slice(0, 80));
  return !unsafe;
}

module.exports = async (req, res) => {
  const isGet = req.method === "GET";
  if (!isGet && req.method !== "POST") return res.status(405).json({ error: "GET or POST only" });
  const send = (status, obj, cacheable) => {
    res.setHeader("Cache-Control", cacheable && isGet && status === 200 ? "public, s-maxage=2592000, stale-while-revalidate=604800" : "no-store");
    return res.status(status).json(obj);
  };
  if (!process.env.ANTHROPIC_API_KEY) return send(500, { error: "oops", reason: "K1" });

  const src = (isGet ? req.query : req.body) || {};
  const part = src.part === "board" ? "board" : "lecture";
  const question = String(src.q || src.question || "").trim().slice(0, 300);
  const depth = ["quick", "simple"].includes(src.depth) ? src.depth : "full";
  const context = isGet ? "" : String(src.context || "").slice(0, 200);
  const more = !isGet && src.more === true;
  const prev = isGet ? "" : String(src.prev || "").slice(0, 3000);
  // the figures request carries the comparison, one section per line, so each figure matches a section
  const paras = String(src.a || "").split("\n").map(x => x.trim()).filter(Boolean).slice(0, 4).map(x => x.slice(0, 900));
  // the item names, in order, so the artist knows how many columns to draw
  const names = String(src.i || src.items || "").split("|").map(x => x.trim().slice(0, 40)).filter(Boolean).slice(0, 3);
  if (!question) return send(400, { error: "empty" });

  if (HELP_WORDS.test(question)) {
    if (part === "board") return send(200, { figures: [] }, true);
    return send(200, HELP, true);
  }

  // per-visitor limit counts comparisons (the figures ride along)
  if (part !== "board") {
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter(t => now - t < 3600000);
    if (recent.length >= HOURLY_LIMIT) return send(200, BREAK, false);
    recent.push(now); hits.set(ip, recent);
  }

  // A fresh comparison arrives as "A vs B"; a follow-up arrives as a question about the comparison on screen.
  let user = context
    ? `${DEPTH[depth]}\n\nWe were just comparing: ${context}\nThe learner's follow-up question: ${question}\nAnswer it as a comparison of the same items, keeping them in the same order and using the same 4 section headings.`
    : `${DEPTH[depth]}\n\nCompare these, keeping them in this order: ${question}`;
  if (more) {
    user = `${DEPTH[depth]}\n\nThe learner tapped "Go deeper" on the comparison: ${context}\nHere is what was ALREADY covered:\n${prev}\n\nGo one level deeper on this same comparison: the finer distinctions, edge cases, exceptions, real numbers, and where the line between the items gets blurry. Keep the items in the same order and use the same 4 section headings. Do not repeat what was already said. Title it like "Deeper: ...".${/^go deeper on /i.test(question) ? "" : `\nThe learner specifically wants to dig into: ${question}`}`;
  }

  if (part === "board") {
    if (paras.length) {
      user += `\n\nThe comparison, section by section:\n${paras.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\nDraw EXACTLY ${paras.length} figures, one per section, in the same order, using the 4 views in order (Side by side, What they share, Key differences, Which one when). Figure k must illustrate section k, so the board changes as the narrator talks. Start each title with its view name.`;
    }
    if (names.length === 3) user += `\n\nThis is a THREE-item comparison. The items are: 1. ${names[0]} (coral, left column), 2. ${names[1]} (blue, middle column), 3. ${names[2]} (lime, right column). Use the THREE ITEMS layout for every figure. Every figure must show all three items.`;
    else if (names.length === 2) user += `\n\nThis is a TWO-item comparison. The items are: 1. ${names[0]} (coral, on the left), 2. ${names[1]} (blue, on the right).`;
    return streamBoard(res, isGet, user, paras.length || 4);
  }

  let lec;
  try {
    lec = await withRetry(async () => {
      const j = normalize(await callTool(SYSTEM_LECTURE, LECTURE_TOOL, user, 5000, x => Array.isArray(x.answer)));
      if (!j) throw new Error("bad_shape");
      return j;
    }, 30000);
  } catch (e) {
    return send(500, { error: "oops", reason: errorCode(e) });
  }

  if (!["lecture", "redirect", "decline"].includes(lec.type)) lec.type = "lecture";
  if (lec.type === "decline") return send(200, DECLINE, true);

  try {
    if (lec.type === "lecture" && !(await safetyCheck(question, lec))) return send(200, DECLINE, true);
  } catch (e) {
    console.error("safety check failed:", e.message);
    return send(500, { error: "oops", reason: "C7" });
  }
  return send(200, lec, true);
};
