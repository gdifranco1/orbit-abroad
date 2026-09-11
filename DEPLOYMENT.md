# Publish Orbit Abroad with Giulio's GitHub account

## Authorized target

- GitHub account: `gdifranco1`
- Public repository: `orbit-abroad`
- Expected URL: <https://gdifranco1.github.io/orbit-abroad/>
- License: All rights reserved

Do not perform these steps while signed in to Cameron's GitHub account. Before creating or pushing anything, verify that the GitHub avatar menu shows **gdifranco1**. A separate private/incognito browser window is the safest way to avoid using another signed-in account.

## 1. Run the final local checks

```bash
cd /home/caragon/giulio-workspace/orbit-abroad
python3 build-previews.py
python3 validate.py
node --test core.test.js smart-inbox.test.js
```

All commands must pass before publication.

## 2. Create the empty repository as Giulio

While signed in to GitHub as **gdifranco1**:

1. Open <https://github.com/new>.
2. Set **Repository name** to `orbit-abroad`.
3. Select **Public**.
4. Do not add a README, `.gitignore`, or license—those files already exist locally.
5. Select **Create repository**.

The resulting repository must be:

`https://github.com/gdifranco1/orbit-abroad`

Stop if GitHub shows a different owner.

## 3. Commit and push from this project folder

Run these commands yourself. GitHub may ask you to authenticate; do not share a password, token, recovery code, or browser session with an agent.

```bash
cd /home/caragon/giulio-workspace/orbit-abroad
git add .
git commit -m "Launch Orbit Abroad beta"
git remote add origin https://github.com/gdifranco1/orbit-abroad.git
git push -u origin main
```

Before pushing, confirm the remote is exact:

```bash
git remote -v
```

Both lines must name `github.com/gdifranco1/orbit-abroad.git`. If they name any Cameron-owned account or repository, stop and remove the remote with `git remote remove origin`.

## 4. Enable GitHub Pages

1. Open <https://github.com/gdifranco1/orbit-abroad/settings/pages>.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **main** and folder **/(root)**.
4. Select **Save**.
5. Wait for GitHub to show the published URL.

Expected URL:

<https://gdifranco1.github.io/orbit-abroad/>

## 5. Verify the live beta

Open the expected URL in a private/incognito window and check:

- The landing page is styled.
- **Try the free beta** opens `app.html`.
- Onboarding appears and requires the redaction acknowledgment.
- The utility example produces a reviewed task.
- Refreshing keeps the task.
- The privacy page opens.
- The browser offers installation where supported.
- After one online load, the app reopens offline.
- <https://gdifranco1.github.io/orbit-abroad/assets/og-card.png> displays the social image.
- <https://gdifranco1.github.io/orbit-abroad/sitemap.xml> displays the sitemap.

## GitHub Pages limitation

GitHub Pages does not apply the repository's `_headers` file. The production HTML therefore includes a Content Security Policy meta tag and referrer policy. Some response-level protections—particularly `frame-ancestors`—require a host that supports custom HTTP headers. This does not block the beta, but it is a known hosting limitation.

## Before inviting customers

- Obtain qualified review of the privacy notice and beta terms.
- Use only invented or carefully redacted examples and screenshots.
- Never ask testers to send unredacted documents.
- Confirm support email access at `gdifranco100@gmail.com`.
- Follow `CUSTOMER-LAUNCH-KIT.md` for interviews and recruitment.
