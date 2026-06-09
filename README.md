# fred cooks

A lightweight personal cookbook. Recipes are Markdown files; a small build script generates a static site with client-side search.

## Getting started

```bash
npm install        # one-time
npm run build      # generate dist/
npm run dev        # build + serve at http://localhost:8000
```

Requires Node 18+ and Python 3 (used by `npm run serve` for the static server).

## Adding a recipe

Drop a Markdown file under `recipes/<Category>/<Name>.md`. The folder name becomes a tag automatically (so `recipes/Bread/Sourdough.md` is tagged `bread`).

```markdown
---
title: Pasta Carbonara
tags: [italian, quick]
ingredients:
  - { name: spaghetti, amount: 400g }
  - { name: guanciale, amount: 150g }
  - { name: eggs, amount: 4 }
  - { name: pecorino romano, amount: 50g }
  - { name: black pepper, amount: to taste }
servings: 4
prep_time: 10m
total_time: 25m
---

1. Bring a large pot of salted water to a boil.
2. …
```

Frontmatter fields:

| field        | required | notes                                              |
|--------------|----------|----------------------------------------------------|
| `title`      | no       | defaults to the filename                           |
| `tags`       | no       | merged with the folder name(s)                     |
| `ingredients`| no       | list of `{ name, amount }`; amounts are display-only |
| `servings`   | no       | string or number                                   |
| `prep_time`  | no       | freeform, e.g. `10m`                               |
| `total_time` | no       | freeform, e.g. `25m`                               |

Everything below the frontmatter is rendered as the recipe instructions (standard Markdown).

Rebuild with `npm run build` and the new recipe appears in the index.

## Project layout

```
build.js          Node build script
src/
  index.html      home / search page
  assets/
    search.js     client-side filter
    style.css
recipes/          your content (edit these)
dist/             generated output (deploy this)
```

## How search works

`build.js` writes `dist/search-index.json` containing every recipe's title, tags, and ingredient names. The home page fetches that JSON once and filters in the browser — no backend, no server-side search. Substring match on title + tags + ingredients, plus toggleable tag chips.

## Deploy

### GitHub Pages

Add `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push: { branches: [main] }
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

Then enable Pages in repo settings → "GitHub Actions" as the source.

### Firebase Hosting

```bash
firebase init hosting   # set public dir to "dist", single-page app: no
npm run build
firebase deploy
```
