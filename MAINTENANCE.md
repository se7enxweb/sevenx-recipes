# sevenx-recipes — maintenance reference

## How Symfony Flex picks a recipe slot

When `composer require` installs or updates a package, Symfony Flex queries this
repo's `index.json`, looks up the package's registered recipe versions, and runs
the following resolution to decide which directory to serve:

1. **Branch-alias substitution** — if the installed version starts with `dev-` *and*
   the package's `composer.json` has a matching `extra.branch-alias` entry, the
   alias replaces the raw version string (e.g. `dev-5.x-LB` → `1.4.x-dev`).
2. **Normalisation** — the regex `/^dev-|^v|\.x-dev$|-dev$/` is stripped, then the
   result is collapsed to `MAJOR.MINOR` (e.g. `1.4.x-dev` → `1.4`).
3. **Slot selection** — registered recipe versions are iterated in **descending**
   order; the first one that is `<=` the normalised version wins.

---

## Package: `se7enxweb/exponential-platform-dxp`

### Branch-alias map (in `exponential-platform-dxp/composer.json` per branch)

| Package repo branch | Composer require version | branch-alias            | Flex normalises to | Recipe slot |
|---------------------|--------------------------|-------------------------|--------------------|-------------|
| `4.6`               | `dev-4.6`                | `1.0.x-dev`             | `1.0`              | **`1.0`**   |
| `4.6.x-LB`         | `dev-4.6.x-LB`           | `1.2.x-dev`             | `1.2`              | **`1.2`**   |
| `master`            | `dev-master`             | `1.3.x-dev`             | `1.3`              | **`1.3`**   |
| `5.x-LB`           | `dev-5.x-LB`             | `1.4.x-dev`             | `1.4`              | **`1.4`**   |

> The `4.6.x-dev` slot is what a project requiring `"se7enxweb/exponential-platform-dxp": "4.6.x-dev"`
> gets, which is how `exponential-platform-v4x-dxp-skeleton` installs: a numeric branch (`4.6`)
> has no `dev-` version, so its branch alias does not apply and Flex normalises `4.6.x-dev` to
> `4.6`, which selects this slot. It ships the **4.6** frontend build (the encore files and
> security configuration of the Ibexa 4.6 recipe, Encore 3, webpack pinned to 5.106.2 because
> later webpack 5 releases removed what Encore 3 copyFiles needs). The other slots ship the 5.0
> frontend build (`@ibexa/frontend-config` v5) with Encore 6, which works with current webpack 5.
>
> The `5.0` slot is present for historical reasons / fallback. Do not delete either slot.

### Recipe slot → what it contains

| Slot        | Stack variant                                      | Directory                                         |
|-------------|----------------------------------------------------|---------------------------------------------------|
| `1.0`       | Ibexa DXP 4.6 — pure (no Legacy Bridge)            | `se7enxweb/exponential-platform-dxp/1.0/`         |
| `1.2`       | Ibexa DXP 4.6 + eZ Publish Legacy Bridge           | `se7enxweb/exponential-platform-dxp/1.2/`         |
| `1.3`       | Ibexa DXP 5.x — pure (no Legacy Bridge)            | `se7enxweb/exponential-platform-dxp/1.3/`         |
| `1.4`       | Ibexa DXP 5.x + eZ Publish Legacy Bridge ← **you are here** | `se7enxweb/exponential-platform-dxp/1.4/` |
| `4.6.x-dev` | Ibexa DXP 4.6 (4.6 frontend build; v4x skeleton)    | `se7enxweb/exponential-platform-dxp/4.6.x-dev/`  |
| `5.0`       | Legacy / historical                                | `se7enxweb/exponential-platform-dxp/5.0/`         |

### Stale / unregistered directories (do not use)

The following directory exists on disk, with its compiled
`se7enxweb.exponential-platform-dxp.4.6.x-LB-dev.json`, but is **not registered**
in `index.json` and is therefore never served by Flex. It is superseded by `1.2`.
Changes that apply to every slot are still made in it, so it does not drift.

- `se7enxweb/exponential-platform-dxp/4.6.x-LB-dev/` — superseded by `1.2`

`5.x-LB-dev/`, `dev-5.x-LB/` and `dev-master/` were removed together with their
compiled JSON files.

---

## What Flex actually downloads

Flex never reads the slot directories. For a selected slot it downloads the
compiled file named by `recipe_template` in `index.json`, for example
`se7enxweb.exponential-platform-dxp.1.4.json` from the repository root on
`master`. That file holds, under `manifests.<package>`:

- `manifest` — the slot's `manifest.json`, parsed;
- `files` — every regular, non-empty file of the slot (plus `manifest.json`
  itself), base64-encoded in `contents`, with an `executable` flag. Symbolic
  links and `.gitkeep` placeholders are left out; links that a project needs are
  created by the slot's `bin/install-legacy-links`;
- `ref` — the commit the file was last rebuilt on. Flex records it in a
  project's `symfony.lock` and reports a recipe update when the served `ref`
  differs, so it changes on every rebuild that changes content.

**A change to a slot directory reaches nobody until it is compiled into that
JSON file.** Editing only the slot directory changes nothing for Flex clients.

Flex copies recipe files only when the recipe is installed (or when a project
runs `composer recipes:update`). Projects that already installed a recipe keep
their copies of its files and must apply a fix to their own files themselves.

## Workflow: updating a recipe file

1. Identify which **stack variant** the change belongs to (see table above).
   A fix that applies to every stack is made in every slot directory.
2. Edit the file inside the corresponding **slot directory**.
3. Compile the slot into its served JSON file, from the repository root. Do this
   for every change, not only when files were added or removed:
   ```bash
   bin/build-recipe-manifest se7enxweb/exponential-platform-dxp 1.4
   ```
   The tool (Python 3) re-encodes the slot's files and manifest, sets `ref` to
   the current `HEAD` commit (the commit the rebuild is made on; pass
   `--ref <sha>` to choose another), and only rewrites the file when its
   content changed. It refuses to touch a compiled file it cannot re-serialise
   byte for byte, so the diff of a rebuild shows only real changes: the changed
   files' `contents` lines and the `ref` line.
4. Check that every slot matches its compiled file (writes nothing, exits 1 on a
   difference):
   ```bash
   for s in 1.0 1.2 1.3 1.4 4.6.x-dev 4.6.x-LB-dev 5.0; do
       bin/build-recipe-manifest se7enxweb/exponential-platform-dxp $s --check
   done
   ```
5. Commit the slot change and the rebuilt JSON together, push to `master`.
   A release is tagged `v1.3.N` (the next number after
   `git tag -l --sort=version:refname | tail -1`; never re-use or move a tag) and
   gets a GitHub release. Flex itself reads `master`, not the tags.

### Example: updating a translation for v5 + Legacy Bridge

The live site is `/var/www/vhosts/alpha.se7enx.com/doc/site.v5.platform.alpha.se7enx.com`
and its `composer.json` requires `"se7enxweb/exponential-platform-dxp": "dev-5.x-LB"`.

→ Edit `se7enxweb/exponential-platform-dxp/1.4/translations/<file>.xlf`

---

## Adding a new recipe slot

1. Create the directory, e.g. `se7enxweb/exponential-platform-dxp/1.5/`.
2. Add the version string to the `recipes` array in `index.json`:
   ```json
   "se7enxweb/exponential-platform-dxp": ["1.0","1.2","1.3","1.4","1.5","4.6.x-dev","5.0"]
   ```
3. Add a matching `branch-alias` entry in the **package repo's** `composer.json`
   on the relevant branch so Flex normalises to the new slot number.
4. Generate the compiled JSON (`bin/build-recipe-manifest <package> <slot>`
   creates it when it does not exist yet) and commit everything together.

---

## Live sites → recipe slot quick-reference

| Site path                                                    | composer.json version | Recipe slot |
|--------------------------------------------------------------|-----------------------|-------------|
| `site.v5.platform.alpha.se7enx.com`                         | `dev-5.x-LB`          | `1.4`       |
