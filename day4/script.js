const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearButton = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");
const draftKey = "quicknotes-draft";
const themeKey = "quicknotes-theme";

function updateCounts() {
  const characters = noteText.value.length;
  const words = noteText.value.trim() === "" ? 0 : noteText.value.trim().split(/\s+/).length;

  charCount.textContent = `${characters} / 200 characters`;
  wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;
  charCount.classList.toggle("warning", characters > 180 && characters <= 200);
  charCount.classList.toggle("over", characters > 200);
}

function clearNote() {
  noteText.value = "";
  localStorage.removeItem(draftKey);
  updateCounts();
  noteText.focus();
}

function updateThemeButton(isDark) {
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-pressed", String(isDark));
}

noteText.value = localStorage.getItem(draftKey) || "";
const savedTheme = localStorage.getItem(themeKey);
const isDark = savedTheme === "dark";
document.body.classList.toggle("dark", isDark);
updateThemeButton(isDark);
updateCounts();

noteText.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem(draftKey, noteText.value);
});

clearButton.addEventListener("click", clearNote);

noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearNote();
  }
});

themeToggle.addEventListener("click", () => {
  const nextIsDark = !document.body.classList.contains("dark");
  document.body.classList.toggle("dark", nextIsDark);
  localStorage.setItem(themeKey, nextIsDark ? "dark" : "light");
  updateThemeButton(nextIsDark);
});
