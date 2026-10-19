// @ts-check
// Data Coach — smoke test della pagina mobile: caricamento, compressione della foto e rendering.
// Non tocca Firebase né la rete: image.js e ui.js sono moduli puri importati nella pagina.
const { test, expect } = require("@playwright/test");

const BASE = "http://localhost:5001/data-coach/";

test.describe("Data Coach", () => {
  test("la pagina carica con login, noindex e manifest", async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle(/Data Coach/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/data-coach/manifest.json");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#032D60");

    const manifest = await page.request.get(BASE + "manifest.json");
    expect(manifest.ok()).toBeTruthy();
    const m = await manifest.json();
    expect(m.start_url).toBe("/data-coach/");
    expect(m.display).toBe("standalone");
    expect(m.icons.map((i) => i.src)).toContain("/data-coach/icon-512.png");

    await expect(page.locator("#splash")).toBeHidden({ timeout: 10000 }); // app.js o, senza rete, il fallback CSS
    await expect(page.locator("#login-form")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entra" })).toBeVisible();
  });

  test("image.js riduce una foto 3000×2000 a 1568 px di lato lungo, JPEG in base64 senza prefisso", async ({ page }) => {
    await page.goto(BASE);
    const out = await page.evaluate(async () => {
      const { compressImage } = await import("/data-coach/image.js");
      const c = document.createElement("canvas");
      c.width = 3000;
      c.height = 2000;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#f4f4f4";
      ctx.fillRect(0, 0, 3000, 2000);
      ctx.fillStyle = "#032D60";
      ctx.font = "120px sans-serif";
      ctx.fillText("Prova", 200, 400);
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
      const file = new File([blob], "foto.jpg", { type: "image/jpeg" });
      const r = await compressImage(file, { maxSide: 1568, quality: 0.8 });
      return { width: r.width, height: r.height, mediaType: r.mediaType, bytes: r.bytes, head: r.base64.slice(0, 12), len: r.base64.length };
    });
    expect(out.width).toBe(1568);
    expect(out.height).toBe(1045);
    expect(out.mediaType).toBe("image/jpeg");
    expect(out.head).not.toMatch(/^data:/);
    expect(out.head.startsWith("/9j/")).toBe(true); // FF D8 FF: inizio di un JPEG, in base64
    expect(out.bytes).toBeGreaterThan(1000);
    expect(out.len).toBeGreaterThan(out.bytes);
  });

  test("ui.js rende la risposta rapida, l'approfondimento e gli errori in italiano", async ({ page }) => {
    await page.goto(BASE);
    const errors = await page.evaluate(async () => {
      const ui = await import("/data-coach/ui.js");
      const root = document.createElement("div");
      root.id = "test-root";
      document.body.append(root);
      const fast = {
        logId: "test-1", answers: ["B", "D"], requiredCount: 2, reasoningIt: "Spiegazione di prova della via rapida.",
        confidence: "media", questionStem: "Testo di prova della domanda", registryExact: true, section: "harmonization",
        latencyMs: 4200, model: "claude-opus-5-5", fellBack: false, readIssue: "",
      };
      const card = ui.renderResult(fast);
      root.append(card);
      card.querySelector(".deep-slot").append(ui.renderDeep({
        answers: ["A", "C"], requiredCount: 2, explanationIt: "Spiegazione di prova dell'approfondimento.",
        confidence: "alta", citations: ["Manuale · cap. 4", "Glossario"], agreesWithFast: false, section: "harmonization",
      }, fast));
      return {
        exhausted: ui.errorMessage({ code: "functions/resource-exhausted" }),
        denied: ui.errorMessage({ code: "functions/permission-denied" }),
        unknown: ui.errorMessage(new Error("boom")),
        auth: ui.authErrorMessage({ code: "auth/invalid-credential" }),
      };
    });
    const root = page.locator("#test-root");
    await expect(root.locator(".result .letters")).toHaveText("B · D");
    await expect(root).toContainText("Scegli 2");
    await expect(root.locator(".result > .result-head .pill")).toHaveText(/media/);
    await expect(root.locator(".badge")).toHaveText("Nel registro");
    await expect(root.locator(".stem")).toHaveText("Testo di prova della domanda");
    await expect(root.locator(".result .chip").first()).toHaveText("Harmonization");
    for (const name of ["Approfondisci", "Dubbia", "Nuova domanda"]) {
      await expect(root.getByRole("button", { name })).toBeVisible();
    }
    await expect(root.locator(".deep-head")).toHaveText("Cambia in A · C");
    await expect(root.locator(".deep-head")).toHaveClass(/change/);
    await expect(root.locator(".citation")).toHaveText(["Manuale · cap. 4", "Glossario"]);
    expect(errors).toEqual({
      exhausted: "Troppe richieste, riprova tra poco",
      denied: "Account non autorizzato",
      unknown: "Errore, riprova",
      auth: "Email o password non corretti",
    });
  });

  test("ui.js rende la lista delle domande dubbie", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("#dubbie-open")).toHaveCount(1);
    await expect(page.locator("#dubbie")).toBeHidden();
    await page.evaluate(async () => {
      const ui = await import("/data-coach/ui.js");
      const root = document.createElement("div");
      root.id = "dubbie-test";
      document.body.append(root);
      root.append(ui.renderDubbieList([
        { id: "log-1", createdAt: "2026-10-19T13:10:20Z", questionStem: "Domanda dubbia di prova", answers: ["A"],
          confidence: "alta", reasoningIt: "Motivo rapido.", section: "ingestion", registryConflict: true,
          deep: { answers: ["C"], explanationIt: "Motivo dell'approfondimento.", confidence: "alta", citations: ["Help"] } },
        { id: "log-2", questionStem: "Seconda", answers: ["B", "D"], confidence: "bassa", deep: null },
      ]));
      const empty = document.createElement("div");
      empty.id = "dubbie-empty";
      document.body.append(empty);
      empty.append(ui.renderDubbieList([]));
    });
    const root = page.locator("#dubbie-test");
    await expect(root.locator(".dubbia-item")).toHaveCount(2);
    await expect(root).toContainText("2 domande dubbie");
    await expect(root.locator(".dubbia-item").first()).toContainText("Domanda dubbia di prova");
    await expect(root.locator(".dubbia-item").first().locator(".deep-head")).toHaveText("Cambia in C");
    await expect(root.locator(".dubbia-item").first().locator(".badge-warn")).toHaveText("Registro in disaccordo");
    await expect(root.locator(".dubbia-item").nth(1).locator(".letters")).toHaveText("B · D");
    await expect(root.getByRole("button", { name: "Mostra foto" })).toHaveCount(2);
    await expect(root.getByRole("button", { name: "Non più dubbia" })).toHaveCount(2);
    await expect(page.locator("#dubbie-empty")).toContainText("Nessuna domanda segnata come dubbia.");
  });
});
