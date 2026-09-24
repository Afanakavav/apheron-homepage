// @ts-check
// Wheel of Facts · FUN Friday — smoke test of the two windows on the DEMO data (no real facts involved).
const { test, expect } = require("@playwright/test");

const BASE = "http://localhost:5001/fun-friday/";

test.describe("Wheel of Facts", () => {
  test("launcher offers Control and Board", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wheel of Facts");
    await expect(page.getByRole("button", { name: "Open Control" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Board" })).toBeVisible();
  });

  test("phrases wrap without splitting words and the wheel lands on the drawn person", async ({ page }) => {
    await page.goto(BASE);
    const result = await page.evaluate(async () => {
      const E = await import("/fun-friday/engine.js");
      const phrase = "I once ate a scorpion in Thailand, really!";
      const l = E.layoutPhrase(phrase);
      const rebuilt = l.rows.map((r) => r.map((c) => c.ch).join("")).join(" ");
      let landed = 0;
      for (let i = 0; i < 200; i++) {
        const pool = ["a", "b", "c", "d", "e", "f", "g", "h"].slice(0, 1 + (i % 8));
        const target = pool[i % pool.length];
        const { toDeg } = E.planSpin(pool, target, i * 13.7);
        if (pool[E.sliceUnderPointer(toDeg, pool.length)] === target) landed++;
      }
      return { rebuilt, expected: E.normalizePhrase(phrase).toUpperCase(), errors: l.errors, landed };
    });
    expect(result.errors).toEqual([]);
    expect(result.rebuilt).toBe(result.expected);
    expect(result.landed).toBe(200);
  });

  test("a full turn on Control drives the Board", async ({ context }) => {
    test.setTimeout(60000);
    const board = await context.newPage();
    await board.setViewportSize({ width: 1920, height: 1080 });
    await board.goto(BASE + "#demo-board");
    await board.mouse.click(960, 540); // the one-time "Click anywhere to start the board"

    const control = await context.newPage();
    await control.goto(BASE + "#demo-control");
    await expect(control.getByText("CONTROL — do not share this window")).toBeVisible();
    await expect(control.getByText("Board connected")).toBeVisible({ timeout: 5000 });

    const state = () => control.evaluate(() => JSON.parse(localStorage.getItem("funfriday-demo:state") || "null"));

    await control.keyboard.press("s");
    await control.waitForTimeout(6500); // the spin lasts 6 s
    const drawn = (await state()).turn.pid;
    await expect(board.locator(".board")).toContainText((await state()).players.find((p) => p.id === drawn).name);

    await control.keyboard.press("1");
    await control.keyboard.press("Enter");
    const turn = (await state()).turn;
    expect(turn.phase).toBe("running");

    await expect(board.locator(".bd-tile-letter.bd-on")).toHaveCount(1, { timeout: turn.intervalMs + 2000 });
    // The Board never holds a letter that is still hidden: tiles carry only the revealed ones,
    // and no word of the phrase appears anywhere else on the page.
    const tileLetters = await board.locator(".bd-tile-letter").evaluateAll((els) => els.map((e) => e.textContent).join(""));
    expect(tileLetters).toHaveLength(1);
    const text = (await board.locator(".board").textContent()).toUpperCase();
    const words = turn.text.toUpperCase().split(" ").filter((w) => w.length > 3).map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""));
    for (const w of words) expect(text).not.toMatch(new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, "u"));

    await control.keyboard.press("a"); // before time's up, A asks first…
    await expect(control.getByRole("dialog")).toContainText("Reveal the whole phrase now?");
    await control.keyboard.press("Enter"); // …and Enter confirms
    await expect(board.locator(".bd-tile-letter.bd-on")).toHaveCount(turn.letters);
    await control.keyboard.press("Enter");
    const after = await state();
    expect(after.turn).toBeNull();
    expect(after.session.turns).toHaveLength(1);
    expect(after.cycle.drawn).toContain(drawn);
  });
});
