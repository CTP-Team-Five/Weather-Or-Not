Perform a safe pre-refactor audit and cleanup pass on this codebase.

Do NOT change layout, business logic, or core UX. This is a hygiene pass.

Steps:

1. **Dead code scan**
   - Find all components/files that are not imported anywhere
   - Report each with evidence (grep results)
   - Delete only files confirmed to have zero imports outside themselves
   - Report any uncertain cases without deleting

2. **Dependency hygiene**
   - Check if any runtime dependencies should be devDependencies
   - Check for unused packages (installed but never imported)
   - Do not remove packages without confirming zero usage

3. **Broken references**
   - Find nav links to nonexistent routes
   - Find imports of deleted/moved files
   - Find relative imports that should use the @/ alias

4. **Styling audit**
   - Check for CSS files not imported by any component
   - Check for declared-but-missing CSS frameworks (e.g. Tailwind directives without config)
   - Report duplicate/conflicting style definitions

5. **Scoring system audit**
   - Find every place the old 0-10 scoring is still referenced
   - Find every place the new 0-100 scoring is used
   - Report the migration path but do NOT rewrite scoring in this pass

6. **Build verification**
   - Run `npm run build` before and after changes
   - Confirm all routes still compile
   - Start dev server briefly to confirm it boots

Output:
- List every file changed with a one-line reason
- List every file deleted with evidence it was unused
- List files deliberately NOT touched and why
- List any remaining issues found but not fixed
- Confirm build/run status
