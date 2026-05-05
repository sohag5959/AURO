# Auro Security Specification

## Data Invariants
1. Students can only access their own notes and to-do lists.
2. Focus mode sessions must have a valid duration and subject.
3. Vocabulary words must belong to a user profile.

## The "Dirty Dozen" Payloads
1. Unauthorized Note Edit: Attempting to update a note document with a different `userId`.
2. Negative Timer: Setting a Pomodoro timer to -25 minutes.
3. Massive Payload: Sending 1MB of text into a simple "Word" field in Vocabulary.
4. ID Poisoning: Injected special characters into the `subjectId` field.
5. Orphaned Task: Creating a task without a parent `subjectId`.
6. State Bypass: Forcing a Pomodoro session to "completed" without actual time elapsing.
7. Role Escalation: Attempting to set `isAdmin: true` on a user object.
8. PII Leak: Querying all user emails.
9. Citation Spoof: Mocking a source URL that doesn't exist.
10. Shadow Field: Adding `premium: true` to a session document.
11. Rapid Fire: Creating 1000 notes in 1 second.
12. Cross-User Query: Trying to list tabs from another user's subject group.

## Test Runner (Mock Logic for now, to be implemented as Rules)
// This file will guide the Firestore implementation if requested.
