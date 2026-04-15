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

> The `4.6.x-dev` and `5.0` slots registered in `index.json` are present for
> historical reasons / fallback and are not the primary target of any currently
> active branch.  Do not delete them — older projects may pin to them.

### Recipe slot → what it contains

| Slot        | Stack variant                                      | Directory                                         |
|-------------|----------------------------------------------------|---------------------------------------------------|
| `1.0`       | Ibexa DXP 4.6 — pure (no Legacy Bridge)            | `se7enxweb/exponential-platform-dxp/1.0/`         |
| `1.2`       | Ibexa DXP 4.6 + eZ Publish Legacy Bridge           | `se7enxweb/exponential-platform-dxp/1.2/`         |
| `1.3`       | Ibexa DXP 5.x — pure (no Legacy Bridge)            | `se7enxweb/exponential-platform-dxp/1.3/`         |
| `1.4`       | Ibexa DXP 5.x + eZ Publish Legacy Bridge ← **you are here** | `se7enxweb/exponential-platform-dxp/1.4/` |
| `4.6.x-dev` | Legacy / historical                                | `se7enxweb/exponential-platform-dxp/4.6.x-dev/`  |
| `5.0`       | Legacy / historical                                | `se7enxweb/exponential-platform-dxp/5.0/`         |

### Stale / unregistered directories (do not use)

The following directories exist on disk but are **not registered** in `index.json`
and are therefore never served by Flex.  They are superseded by the 1.x slots above.

- `se7enxweb/exponential-platform-dxp/5.x-LB-dev/`  — superseded by `1.4`
- `se7enxweb/exponential-platform-dxp/dev-5.x-LB/`  — superseded by `1.4`
- `se7enxweb/exponential-platform-dxp/dev-master/`   — superseded by `1.3`

---

## Workflow: updating a recipe file

1. Identify which **stack variant** the change belongs to (see table above).
2. Edit the file inside the corresponding **slot directory**.
3. Rebuild the `.json` manifest if files were added/removed:
   ```bash
   # from repo root
   php bin/build-recipe-manifest se7enxweb/exponential-platform-dxp 1.4
   ```
4. Commit, tag (`vX.Y.Z`), push, create GitHub release.

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
4. Generate the `.json` manifest and commit everything together.

---

## Live sites → recipe slot quick-reference

| Site path                                                    | composer.json version | Recipe slot |
|--------------------------------------------------------------|-----------------------|-------------|
| `site.v5.platform.alpha.se7enx.com`                         | `dev-5.x-LB`          | `1.4`       |
