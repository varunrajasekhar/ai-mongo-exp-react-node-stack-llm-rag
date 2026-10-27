# Presentation walkthrough

This is a repeatable live demonstration script, not a claim of a recorded live-model run. Start MongoDB, Ollama, the API and Vite as described in the README.

## 1. Learner experience

1. Open a private browser window at http://localhost:5173/study. It redirects to Login.
2. Register `learner@example.com` with your own password of at least eight characters.
3. Show that only AI Study and Logout appear in navigation.
4. Ask “What is photosynthesis?” with practice questions selected. Show the explanation and three questions. The result says no saved notes were supplied.
5. Try opening `/notes` directly. The learner returns to AI Study. The API independently rejects learner note requests with 403.

## 2. Admin A

1. Register `admin-a@example.com`; promote it with the README command and log in again.
2. Add a note titled “Photosynthesis Basics”, subject “Biology”, content: “In our class experiment, the plant is named Emerald. Its leaves use chlorophyll to absorb light. Photosynthesis uses light energy to convert carbon dioxide and water into sugars and releases oxygen.”
3. My Notes should show only this account's notes.
4. Ask “What is our class plant named and how does photosynthesis work?” Show the retrieved title beneath the answer. Evaluate the response against the saved content.
5. Use Generate 3 Quiz Questions on the same topic.

## 3. Admin B and privacy

1. Use a separate browser profile/private session, register `admin-b@example.com`, promote and log in.
2. My Notes must be empty; Admin A's note must never appear.
3. Ask “What is our class plant named?” No source should be returned. The LLM may express uncertainty or hallucinate; the privacy check is that Admin A's note is absent from the supplied context and sources.
4. Add a different Biology note for Admin B and ask about it. Only Admin B's note title should appear as context.
5. Return to Admin A: My Notes must still show only A's notes.

## 4. Errors and session handling

- Submit an invalid email or short password; registration should reject it.
- Attempt registration with an existing email; show the duplicate account message.
- Stop Ollama and try saving a note: show a useful error and verify the note was not saved. Restart Ollama afterward.
- Log out and open `/notes/new` directly: Login should appear.

## Acceptance mapping

| Case study requirement | Where to demonstrate / verify |
| --- | --- |
| Hashed passwords and validated registration | Integration tests; public registration form |
| JWT login and protected APIs | Login; logged-out redirects; missing/expired-token tests |
| Two roles and protected pages | Learner vs admin navigation; server middleware tests |
| Save title, subject, content with owner | Add Note and My Notes |
| Private RAG | Admin A/B walkthrough and HTTP integration isolation tests |
| General study answer | Learner AI Study with live Ollama |
| Three practice questions | Checkbox or quiz button |
| Loading and error feedback | AI request progress; failed model call |

Automated tests exercise MongoDB and the full Express HTTP stack with an Ollama HTTP stand-in. Live Ollama inference and browser interactions should be checked using this script before the presentation.
