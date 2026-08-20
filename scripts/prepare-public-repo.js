import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const srcDir = 'd:/MindCare2';
const targetDir = 'd:/MindCare-Public';

// 1. Files and directories strictly excluded from public repository
const excludeList = [
  '.git',
  '.env',
  '.env.local',
  '.env.production',
  '.env.test',
  '.agents',
  '.claude',
  '.gemini',
  '.tempmediaStorage',
  'node_modules',
  'dist',
  'scratch',
  '.system_generated',
  'incident-runbook.md',
  'clone_voice.js'
];

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  const items = fs.readdirSync(from);
  for (const item of items) {
    if (excludeList.includes(item)) continue;
    const srcPath = path.join(from, item);
    const destPath = path.join(to, item);
    try {
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        copyFolderSync(srcPath, destPath);
      } else if (stat.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    } catch (e) {
      // skip
    }
  }
}

console.log('1. Sanitizing files and packaging public showcase into:', targetDir);
if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
copyFolderSync(srcDir, targetDir);

// 2. Write clean, professional public README.md
const publicReadme = `# MindCare — Compassionate Clinical AI Companion 🌿

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://mind-care2-tau.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

> **MindCare** is a human-centered, clinical psychological AI companion engineered for evidence-based emotional regulation, grounded active listening, and bilingual dialect support (Egyptian Arabic & English). Built with strict deterministic safety guardrails, verified clinical citations (WHO mhGAP v2.0 & Beck CBT), and real-time 3D living presence.

---

## ✨ Key Features

- 🧠 **Clinical Grounding & RAG**: Cites verified medical literature (*WHO mhGAP v2.0*, *Judith Beck CBT*, *Steven Hayes ACT*) with page numbers.
- 🛡️ **Zero-Bypass Safety Firewall**: Multi-layered deterministic and LLM-assisted crisis detection protocol with instant hotline handoff (988 / 08008880700).
- 🎙️ **Real-Time Voice Engine**: Ultra-low latency speech pipeline with deep understanding of Egyptian Arabic (\`ar-EG\`) and English (\`en-US\`).
- 🌐 **Living 3D Presence**: Fluid WebGL volumetric presence responsive to conversational emotional states (*LISTENING*, *THINKING*, *SPEAKING*).
- 🔒 **Privacy & Data Minimization**: Non-diagnostic guarantee, consent-first data boundaries, and ephemeral session isolation.
- 🧘 **Wellness & Regulation Spaces**: 4-7-8 Parasympathetic Breathing Pacer, 5-4-3-2-1 Sensory Grounding, Private Journal, and Emotion Trajectory tracking.

---

## 🏛️ System Architecture

\`\`\`
                          ┌───────────────────────────┐
                          │   Client Web App (React)  │
                          │   • 3D Living Presence    │
                          │   • Two-Way Audio Engine  │
                          │   • Bidi RTL/LTR Layout   │
                          └─────────────┬─────────────┘
                                        │
                         WebSocket / HTTPS / Serverless
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │  Deterministic Safety     │
                          │  • Layer 1 Regex Guard    │
                          │  • Crisis Intercept Gate  │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │ Orchestrator & Multi-LLM │
                          │ • Groq Llama 3.3 (Primary)│
                          │ • Google Gemini 3.6 Flash │
                          │ • Clinical Skill Router   │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │ Clinical Knowledge (RAG)  │
                          │ • Qdrant Vector Store     │
                          │ • WHO mhGAP Corpus        │
                          │ • Judith Beck CBT Guides  │
                          └───────────────────────────┘
\`\`\`

---

## 🚀 Quickstart & Local Setup

### 1. Clone the repository
\`\`\`bash
git clone https://github.com/mohamedatia21/MindCare.git
cd MindCare
\`\`\`

### 2. Install dependencies
\`\`\`bash
npm install
cd src/client && npm install && cd ../..
\`\`\`

### 3. Configure environment variables
Copy the template \`.env.example\` file:
\`\`\`bash
cp .env.example .env
\`\`\`
Fill in your own API keys (Groq, Gemini, Deepgram, or Qdrant).

### 4. Run development servers
\`\`\`bash
# Start backend server
npm run start

# Start frontend dev server (in another terminal)
cd src/client && npm run dev
\`\`\`

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🛡️ Ethical & Clinical Notice

MindCare is designed as an empathetic self-reflection and emotional support tool. It does not provide medical diagnoses, prescribe physical medications, or substitute for licensed psychiatric healthcare. In emergencies, users are immediately directed to certified regional crisis helplines.

---

## 📄 License

Distributed under the MIT License. See \`LICENSE\` for details.
`;

fs.writeFileSync(path.join(targetDir, 'README.md'), publicReadme, 'utf-8');

// 3. Write clean .gitignore in public repo
const publicGitignore = `# Dependencies
node_modules/
.pnp
.pnp.js

# Production build
dist/
build/
.next/
out/

# Environment and sensitive keys
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
*.pem
*.key

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Editor and OS
.DS_Store
Thumbs.db
.vscode/
.idea/
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Testing & Coverage
coverage/
.system_generated/
`;

fs.writeFileSync(path.join(targetDir, '.gitignore'), publicGitignore, 'utf-8');

// 4. Write MIT License
const licenseContent = `MIT License

Copyright (c) 2026 MindCare

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

fs.writeFileSync(path.join(targetDir, 'LICENSE'), licenseContent, 'utf-8');

console.log('✅ Public repository files, sanitized README, .gitignore, and LICENSE created successfully!');
