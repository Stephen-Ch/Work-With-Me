# Copilot Instructions — Work With Me

This branch is a repository separation for Work With Me. Old product docs
under docs/archive/, docs/forGPT/, docs/research/, and related historical
folders are legacy material unless explicitly reused.

Before changing a file:
- Read it, and anything it directly imports from, in full.
- Note what it currently does before changing it.

While working:
- Touch only files necessary for the current prompt's stated scope.
- Preserve unrelated code, tests, and content unless explicitly asked to
  remove it.
- Run the targeted tests for what you changed as you go, not only at the end.

Before reporting a prompt done:
- Run: npm run test and npm run build.
- Report actual command output, not a description of expected output.
- If either fails, stop, state the failure plainly, and propose the
  smallest fix rather than expanding scope.

Report format: what changed, what was tested, what passed or failed, what's
left.
