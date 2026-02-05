# ClawShield Deployment & Distribution Guide

To make ClawShield available to OpenClaw users, you have three primary distribution paths depending on the user type.

## 1. Distribution via NPM (Recommended for Developers)
Since ClawShield is a monorepo, you can publish the packages to the NPM registry.

### Steps:
1. **Login**: `npm login`
2. **Build**: `npm run build`
3. **Publish**: `npm publish --access public` (run in each package directory: `shared`, `backend`, `cli`, `frontend`)

Users can then install the CLI globally:
```bash
npm install -g @clawshield/cli
```

## 2. Docker Deployment (Recommended for Servers/Sandboxes)
Users can run ClawShield in a container to ensure the scanner environment is isolated.

### [NEW] [Dockerfile](file:///c:/Users/krishna/Documents/krish/clawshield/Dockerfile)
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3001 5173
CMD ["npm", "run", "dev"]
```

## 3. Desktop App (Electron) Bundle
To provide a "One-Click" experience for non-technical users, you can wrap the React frontend and Node backend into an Electron executable.

### Recommendation:
- Use **Electron Forge** or **Tauri** (for a smaller footprint).
- Package the backend as a "sidecar" process.

## 4. GitHub Releases
Publish pre-built binaries for Windows, macOS, and Linux.
- Use **GitHub Actions** to automate builds on every tag.
- Upload `.exe`, `.dmg`, and `.deb` files directly to the releases page.

---

## Technical Integration with OpenClaw

To ensure ClawShield is actually used by OpenClaw users, it should be promoted as the "Preflight Check" step.

### Recommended Workflow for Users:
1. **Discover**: User finds a skill on ClawHub.
2. **Preflight**: User runs `clawshield preflight <slug>`.
3. **Approve**: ClawShield verifies the risk score.
4. **Install**: User confirms installation into `~/.openclaw/skills`.

### Proposed Config Hook:
Add this to the user's `.openclaw/config.json`:
```json
{
  "hooks": {
    "preinstall": "clawshield preflight $SKILL_SLUG"
  }
}
```

Would you like me to create the **Dockerfile** or set up **GitHub Actions** for you?
