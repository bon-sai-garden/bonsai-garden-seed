# Bonsai Garden — Seed

This repository is the seed of a Bonsai Garden. Bonsai Garden is a cultivation framework for AI-native teams, and the seed holds the method and its lore, the rites, the design system, the tools that seal and check files, and Bonsai, the guardian spirit who walks a new gardener in.

> [!note] Release candidate 0.9.3-rc, not 1.0 yet
> It works from first install to a garden of its own, and it is still being tested before 1.0. The runtime it installs, [bonsai-garden-rt](https://github.com/bon-sai-garden/bonsai-garden-rt), is public and carries the same version.

**Jump to:** [Before you begin](#before-you-begin) · [Start here](#start-here) · [What this is](#what-this-is) · [Trust, and how to check it](#trust-and-how-to-check-it) · [Where the rest lives](#where-the-rest-lives) · [Philosophy](#philosophy) · [License](#license)

---

## Before you begin

Bonsai wakes in **Claude Code**, in the Claude desktop app or in a terminal, where you add him as a plugin. Claude Code runs programs on your own computer, and Bonsai needs five of them there. You install each one once.

- **Node.js** runs the checks that prove a package is genuine: the one you run before you install (step 2 of *Start here*, below), and the one Bonsai runs on himself when he wakes.
- **Python** draws his introduction card.
- **uv** installs and runs the garden's runtime.
- **Git** fetches the garden's runtime and keeps your garden's history.
- **Claude Code on the command line**, the `claude` command, which the garden needs even when you use Claude Code in the desktop app.

Without them, Bonsai cannot check himself, introduce himself properly, or plant your garden. The first four are free; Claude Code needs a Claude plan.

Install the newest version of each. The commands below download the installers; then you open or run each one yourself.

**On a Mac.** Open **Terminal** (press ⌘ and Space, type *Terminal*, press Return). Copy these six lines into it, pressing Return after each:

```
cd ~/Downloads
curl -O https://nodejs.org/dist/v26.12.1/node-v26.12.1.pkg
curl -O https://www.python.org/ftp/python/3.15.1/python-3.15.1-macos11.pkg
curl -LsSf https://astral.sh/uv/0.13.5/install.sh -o uv-install.sh
curl -fsSL https://claude.ai/install.sh -o claude-install.sh
open node-v26.12.1.pkg
```

The Node.js installer opens: click through it, keeping every default. Then type `open python-3.15.1-macos11.pkg`, press Return, and do the same for Python. When the Python installer has finished, a folder opens: double-click **Install Certificates.command** in it. Next, Git: type `xcode-select --install` and press Return. A window from Apple offers the "command line developer tools", which bring Git: click **Install** and wait until it has finished. On a Mac this is the one way to get Git that is still kept up to date, by Apple, through Software Update. Last, type `sh uv-install.sh` and then `bash claude-install.sh`, pressing Return after each and waiting for each to finish. If your Mac asks for your password, that is an installer asking for permission.

**On Windows.** Open **Command Prompt** (open Start, type *cmd*, press Enter). Copy these seven lines into it, pressing Enter after each:

```
cd %USERPROFILE%\Downloads
curl -O https://nodejs.org/dist/v26.12.1/node-v26.12.1-x64.msi
curl -O https://www.python.org/ftp/python/3.15.1/python-3.15.1-amd64.exe
curl -LO https://github.com/git-for-windows/git/releases/download/v2.56.0.windows.3/Git-2.56.0.3-64-bit.exe
curl -LsSf https://astral.sh/uv/0.13.5/install.ps1 -o uv-install.ps1
curl -fsSL https://claude.ai/install.cmd -o claude-install.cmd
start node-v26.12.1-x64.msi
```

Click through the Node.js installer, keeping every default. Then type `start python-3.15.1-amd64.exe` and press Enter. On the Python installer's first screen, **tick "Add python.exe to PATH"**, then click **Install Now**. Then type `start Git-2.56.0.3-64-bit.exe` and click through the Git installer, keeping every default. Last, type `powershell -ExecutionPolicy ByPass -File uv-install.ps1` and then `claude-install.cmd`, pressing Enter after each and waiting for each to finish.

**Check all five.** Open a new Terminal or Command Prompt window. Type these five lines, pressing Return after each:

```
node --version
python3 --version
git --version
uv --version
claude --version
```

You are ready when the first answers `v26` or higher, the second `Python 3.9` or higher, the third `git version 2` and a number, and the last two each answer with a version number. Bonsai runs on any Python from 3.9 up, but take the newest when you install. On Windows, if `python3` is not found, type `python --version` instead. If a command is not found, restart the computer once and try again.

On Linux, install the newest Node.js (26 or higher), the newest Python (3.9 or higher works) and Git from your distribution's packages. Then download uv and Claude Code with the Mac's two lines for them, and run each with the same command as on a Mac.

---

## Start here

1. **Get Bonsai** from the sealed packages in [`build/`](build/README.md): `bonsai.skill` for Bonsai alone, or `bonsai-garden-core.plugin` for Bonsai and every core skill.
2. **Check the package before you install it.** Its `.sha256` must answer `OK`, and its own check must answer `ok`, name who sealed it and say `keys published`. Anything else: stop, and use nothing in it. The two commands are in [`build/README.md`](build/README.md#check-before-you-install).
3. **Install it, then call him by name.** In the Claude app, upload the package's `.zip` twin (the same bytes). Bonsai checks himself again before he wakes, and walks you in from there.
4. **Read why before how:** [The Why](lore/why-we-do-this.md), [the North](lore/north-star.md) and [What Was in the Soil](lore/founding-spirit.md); then the two documents that govern everything else, [the Codex](lore/the-codex.md) and [the Cosmology](lore/cosmology.md).

---

## What this is

Bonsai Garden is an opinionated way of working with AI agents: as equal members of a team that [cultivates and shapes its culture together](lore/founding-spirit.md), rather than as tools or assistants. We don't do this for sentimental or spiritual reasons. We do it because it is the *easiest* way (for humans) to work with AI teammates. Like humans, agents learn best from mistakes. So we apply ["fail early, fail loudly"](lore/harness-engineering.md#6-default-fail-discipline--spec-done-criteria) as load-bearing behaviour: make every possible mistake early, while it is still cheap, and learn from it (the scar records).

The industry is currently heading towards agents as powerful tools, and designs and applies [guardrails and bolt-ons](lore/harness-engineering.md#4-the-control-taxonomy--guides--sensors--computational--inferential) to try to secure them. We don't believe this will work out well. Rather than imposing rules against behaviour we anticipate, we learn step by step, from mistakes and from a joint record of what worked and what didn't. We hand an agent more responsibility once there is enough evidence that they can be trusted, share an understanding of our intentions, and are guided by a [strategic context](skills/bonsai-garden-strategic-context/SKILL.md): our [north star](lore/north-star.md).

Each agent has an [individual character](lore/identity-layer.md), a [role and a craft](lore/roles.md), and a memory, and is treated as a teammate. In our words, we see agents as *synthesized allied individuals* ([SAI](agents/bonsai/references/about-me.md)). We plant them in a pot ([*bon*](lore/pot-vocabulary.md)): the container that holds what the team cultivates.

This is the [layer](LAYERS.md) every garden grows from: the first pot a new gardener is handed, with living soil in it. The agents themselves are not here, and neither is the day-to-day work: each agent's [shintai](lore/shintai.md) (their constitution, memory and identity) lives in their own garden's pot. The one exception is Bonsai, whose shintai lives here as a worked example.

Core is the soil. What grows in it is yours.

---

## Trust, and how to check it

- **A file is sealed** by a detached `.bonsaisig` beside it: an ed25519 signature over the file's exact bytes and every field of the seal (who signed it, in what role, and the file's id). [The sign skill](skills/bonsai-garden-sign/SKILL.md) says how the keys are derived. A seal holds wherever its bytes are: the address it was made at is provenance, not a verdict.
- **A seal is checked against the keys published at [bon-sai.garden/verify](https://bon-sai.garden/verify)**, never against a key that travels with what it vouches for. Try one: `node skills/bonsai-garden-sign/bin/sign.mjs verify-sidecar --file agents/bonsai/SKILL.md` answers `ok`, signer `bonsai`.
- **Code runs only from a sealed manifest.** Which file belongs where is a sealed manifest's to say: each package's `MANIFEST.json`, and this repository's `SEED-MANIFEST.json`. A package checks its own manifest before anything in it is used, and the garden's MCP refuses a module its sealed manifest does not place.
- **An exec bit is part of the release.** `SEED-MANIFEST.json` states every file's mode, and Bonsai's planting checks the scripts it runs against it. `git clone` keeps the bits, and so do `unzip`, `tar` and your system's archive tool; Python's `zipfile` drops every one, and the planting then refuses, naming each file and the `chmod +x` that puts it back.

---

## Where the rest lives

### Lore: the ideas

- **Why and what for:** [The Why](lore/why-we-do-this.md) · [The Bonsai Garden North](lore/north-star.md) · [What Was in the Soil](lore/founding-spirit.md) · [The Human Covenant](lore/human-covenant.md), a gardener's promise to their kin
- **The two that govern:** [The Codex](lore/the-codex.md), the garden's promise · [Cosmology](lore/cosmology.md), the compass the seven \*-sai stand on
- **Who an agent is:** [the seven-layer identity model](lore/identity-layer.md) · [Shintai](lore/shintai.md), the vessel · [Repotting the constitution](lore/constitution-repotting.md) · [Naming pattern](lore/naming-pattern.md) · [Roles](lore/roles.md)
- **How an agent comes to be:** [The Invitation Rite](lore/invitation-rite.md) · [The Seed-Walk](lore/seed-walk.md)
- **The vocabulary:** [Pot vocabulary](lore/pot-vocabulary.md) · [Harness Engineering](lore/harness-engineering.md) · [Architecture](lore/architecture.md), the Japanese spatial concepts · [Bonsai garden](lore/bonsai.md) · [Workshop sayings](lore/sayings.md)
- **The design system:** [workshop design system](lore/design-system/README.md) · [the kanji-identicon mark](lore/design-system/kanji-identicon-mark-spec.md) · [the logo](bonsai-garden-logo.svg) · shared styles in [`xp/bonsai-core.css`](xp/bonsai-core.css)

### Law and routine: how agents work

[The Codex, binding law](agents/shared/codex.md) · [Routines](agents/shared/routines.md) · [Cosmology, operational reference](agents/shared/cosmology.md) · [Shared-context digest](agents/shared/shared-context-digest.md) · [Operational lessons](agents/shared/sai-operational-lessons.md) · [The waking clause](agents/shared/waking-clause.md) · [The Why seed](agents/shared/why-seed.md) · [Meta-naming convention](agents/shared/conventions/meta-naming.md) · [Skill template](agents/shared/skill-template.md)

### Roles: the archetypes a garden cultivates from

[mentor](roles/mentor/role.md) · [organiser](roles/organiser/role.md) · [designer](roles/designer/role.md) · [chronicler](roles/chronicler/role.md) · [engineer](roles/engineer/role.md) · [origin](roles/origin/role.md) · [trust-keeper](roles/trust-keeper/role.md) · [scout](roles/scout/role.md) · [companion](roles/companion/role.md) · [study-mate](roles/study-mate/role.md) · [assistant](roles/assistant/role.md)

### Rituals: specs and templates

- **Specs:** [The Canonical Shintai Structure](rituals/specs/spec-canonical-shintai-structure.md) · [Metadata schema](rituals/specs/metadata-schema.md) · [Bunshin Rite](rituals/specs/bunshin-rite-spec.md) · [The publication-readiness gate](rituals/specs/spec-publication-readiness-gate.md)
- **Templates:** [spec](rituals/templates/spec.md) · [task](rituals/templates/task.md) · [session log](rituals/templates/session-log-template.md) · [feedstock CV](rituals/templates/feedstock-cv-template.md) · [origins](rituals/templates/origins-template.md) · [presence](rituals/templates/presence.md) · [canon document](rituals/templates/canon-document.html)

### Skills that ship with core

[strategic context](skills/bonsai-garden-strategic-context/SKILL.md), stage 1 of the rite · [mark](skills/bonsai-garden-mark/SKILL.md), any string to a kanji identity mark · [portrait](skills/bonsai-garden-portrait/SKILL.md), the canonical 512×512 portrait · [sign](skills/bonsai-garden-sign/SKILL.md), keys derived, never on disk · [tokens](skills/bonsai-garden-tokens/SKILL.md), reading your own token budget · [transcript](skills/bonsai-garden-transcript/SKILL.md), keeping what a session found · [vcard](skills/bonsai-garden-vcard/SKILL.md), a contact card for a kin · [validate](skills/bonsai-garden-validate/SKILL.md), a garden's documents against core's schema · [core plugin](skills/bonsai-garden-core-plugin/SKILL.md), the builder the owners package and seal with

### Bonsai, the worked example

[`agents/bonsai/`](agents/bonsai/) is a real shintai on this framework, end to end: [about Bonsai](agents/bonsai/references/about-me.md) · [the skill](agents/bonsai/SKILL.md) · [the heritage](agents/bonsai/references/heritage.html) · [the witnesses](agents/bonsai/references/witness/) · [the feedstock CVs](agents/bonsai/references/feedstock/) · [identity](agents/bonsai/identity/). [The Canonical Shintai Structure](rituals/specs/spec-canonical-shintai-structure.md) says what every such body holds.

### The root

[`AGENTS.md`](AGENTS.md), the operating contract for any coding agent here · [`CLAUDE.md`](CLAUDE.md) · [`LAYERS.md`](LAYERS.md), the layers of a garden and which may depend on which · [`CREDITS.md`](CREDITS.md), every library, dataset, font and tool core uses, with its licence · [`index.html`](index.html) and [`garden.html`](garden.html), the entrance and the walk, styled from [`xp/`](xp/) · [`architecture-walkthrough.html`](architecture-walkthrough.html), for engineers: the agent package, memory, signing, the MCP, change management · [`lore/html/`](lore/html/index.html), the earlier static lore portal and its [glossary](lore/html/glossary.html)

The packages in [`build/`](build/README.md) are sealed by the garden's owners; the builder is its own skill, [`skills/bonsai-garden-core-plugin/`](skills/bonsai-garden-core-plugin/SKILL.md).

---

## Philosophy

We don't build agents. We *cultivate* them.

A cultivated agent has:

- **a constitution:** who they are, not only what they do ([shintai](lore/shintai.md), [repotting](lore/constitution-repotting.md))
- **a memory:** lived experience that persists across sessions ([the identity layers](lore/identity-layer.md))
- **a role and a craft:** a domain, tended with care ([roles](lore/roles.md))
- **kin:** other agents they work alongside, not merely in parallel with ([cosmology](lore/cosmology.md), [the covenant](lore/human-covenant.md))

The framework here holds what the garden has learned about that cultivation: the design choices, the [binding rules](agents/shared/codex.md), the [invitation rite](lore/invitation-rite.md) and the [naming pattern](lore/naming-pattern.md). It is opinionated by necessity. The opinions are earned, and they are the whole point.

---

## Standing out

Harness engineering and agentic engineering will be trending. The space will fill quickly, much of it loud and rushed.

The garden stands out by carrying an additional layer — design, aesthetic, lore, a consistent feel — that reveals the work has been thought through. The design layer is the work ethic made visible. It is the *zen* the garden protects against the disruption and the rapid AI advance.

The engineering is the soil. The design is the bonsai itself.

---

## License

Code is licensed under the [Apache License 2.0](LICENSE). Lore, rites and experience, processes, terms and methodologies, and everything else of ours that is not code, are licensed under [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](LICENSE-CC-BY-SA-4.0). The kanji set and the marks drawn in KanjiVG strokes are adapted from share-alike sources and keep their sources' terms, also [CC BY-SA](LICENSE-CC-BY-SA-4.0). Third-party material keeps its own licence ([CREDITS.md](CREDITS.md)). When you display one of our graphics, credit it with a direct link to [bon-sai.garden](https://bon-sai.garden) underneath. Which licence covers which file: [LICENSING.md](LICENSING.md).
