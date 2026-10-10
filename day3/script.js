let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

function searchNotes(word) {
  const searchTerm = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(searchTerm));
}

function longestNote() {
  if (notes.length === 0) {
    return null;
  }

  return notes.reduce((longest, note) =>
    note.text.length > longest.text.length ? note : longest
  );
}

function countByCategory() {
  const counts = { personal: 0, work: 0, study: 0 };

  for (const note of notes) {
    if (Object.hasOwn(counts, note.category)) {
      counts[note.category] += 1;
    }
  }

  return counts;
}

function getSummary() {
  const counts = countByCategory();
  const total = notes.length;
  const noteLabel = total === 1 ? "note" : "notes";

  return `${total} ${noteLabel}: ${counts.personal} personal, ${counts.work} work, ${counts.study} study.`;
}

function isDuplicate(text) {
  const normalizedText = text.trim().toLowerCase();
  return notes.some((note) => note.text.trim().toLowerCase() === normalizedText);
}

function addNote(text, category) {
  if (typeof text !== "string") {
    console.log("Note was not added: text must be a string.");
    return false;
  }

  const trimmedText = text.trim();

  if (trimmedText.length < 1 || trimmedText.length > 200) {
    console.log("Note was not added: text must be 1 to 200 characters.");
    return false;
  }

  if (isDuplicate(trimmedText)) {
    console.log("Note was not added: a note with that text already exists.");
    return false;
  }

  if (!["personal", "work", "study"].includes(category)) {
    console.log("Note was not added: category must be personal, work, or study.");
    return false;
  }

  const nextId = Math.max(0, ...notes.map((note) => note.id)) + 1;
  notes.push({ id: nextId, text: trimmedText, category });
  return true;
}

console.log(searchNotes("DAY 3").map((note) => note.text)); // Expected: ["Finish the Day 3 assignment"]
console.log(searchNotes("missing").map((note) => note.text)); // Expected: []

console.log(longestNote()); // Expected: { id: 3, text: "Email the project report to Grace", category: "work" }
const savedNotes = notes;
notes = [];
console.log(longestNote()); // Expected: null
notes = savedNotes;

console.log(countByCategory()); // Expected: { personal: 2, work: 1, study: 2 }
notes = [];
console.log(countByCategory()); // Expected: { personal: 0, work: 0, study: 0 }
notes = savedNotes;

console.log(getSummary()); // Expected: "5 notes: 2 personal, 1 work, 2 study."
notes = [{ id: 1, text: "One note", category: "personal" }];
console.log(getSummary()); // Expected: "1 note: 1 personal, 0 work, 0 study."
notes = savedNotes;

console.log(isDuplicate("  BUY MILK AND BREAD  ")); // Expected: true
console.log(isDuplicate("Something new")); // Expected: false

console.log(addNote("Plan the weekend", "personal")); // Expected: true
console.log(addNote("  plan THE weekend  ", "work")); // Expected: false (logs duplicate reason)
console.log(addNote("   ", "study")); // Expected: false (logs invalid length reason)
console.log(addNote("Read a book", "other")); // Expected: false (logs invalid category reason)
