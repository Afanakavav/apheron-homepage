// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("Italian Lessons Dublin", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("home loads with title and hero", async ({ page }) => {
    await expect(page).toHaveTitle(/Ciao Dublin|Italian.*Francesco/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ciao Dublin");
    await expect(page.locator(".hero")).toBeVisible();
  });

  test("main sections are visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Why Choose Francesco/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Test Your Italian/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Get in Touch/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Special Offer/i })).toBeVisible();
  });

  test("booking modal opens and closes with Escape", async ({ page }) => {
    const modal = page.locator("#bookingModal");
    await expect(modal).toBeHidden();

    await page.getByRole("button", { name: /Book Your Lesson/i }).first().click();
    await expect(modal).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
  });

  test("video modal can be opened and closed", async ({ page }) => {
    const modal = page.locator("#videoModal");
    await expect(modal).toBeHidden();

    await page.evaluate(() => window.openVideoModal());
    await expect(modal).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
  });

  test("quiz shows result after correct answer", async ({ page }) => {
    const quizResult = page.locator("#quizResult");
    await expect(quizResult).toBeHidden();

    await page.getByRole("button", { name: "Hello/Goodbye" }).click();
    await page.waitForTimeout(1200);
    await expect(quizResult).toBeVisible();
    await expect(quizResult).toContainText("Bravo");
  });

  test("booking form has required fields and submit button", async ({ page }) => {
    await page.getByRole("button", { name: /Book Your Lesson/i }).first().click();
    await expect(page.locator("#bookingModal")).toBeVisible();

    await expect(page.locator("#customDate")).toBeVisible();
    await expect(page.locator("#customTime")).toBeVisible();
    await expect(page.locator("#customMessage")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send Request" })).toBeVisible();
  });

  test("WhatsApp link has correct href", async ({ page }) => {
    await expect(page.getByRole("button", { name: /WhatsApp Me/i })).toBeVisible();
    const link = page.locator('a[href*="wa.me"]').first();
    await expect(link).toHaveAttribute("href", /wa\.me\/\d+/);
  });

  test("countdown elements are present", async ({ page }) => {
    await expect(page.locator("#countdown")).toBeVisible();
    await expect(page.locator("#hours")).toBeVisible();
    await expect(page.locator("#minutes")).toBeVisible();
    await expect(page.locator("#seconds")).toBeVisible();
  });
});
