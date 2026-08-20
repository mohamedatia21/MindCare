# MindCare — Compassionate Clinical AI Companion 🌿

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://mind-care2-tau.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

> **MindCare** is a human-centered, clinical psychological AI companion engineered for evidence-based emotional regulation, grounded active listening, and bilingual dialect support (Egyptian Arabic & English). Built with strict deterministic safety guardrails, verified clinical citations (WHO mhGAP v2.0 & Beck CBT), and real-time 3D living presence.

---

## ✨ Key Features

- 🧠 **Clinical Grounding & RAG**: Cites verified medical literature (*WHO mhGAP v2.0*, *Judith Beck CBT*, *Steven Hayes ACT*) with page numbers.
- 🛡️ **Zero-Bypass Safety Firewall**: Multi-layered deterministic and LLM-assisted crisis detection protocol with instant hotline handoff (988 / 08008880700).
- 🎙️ **Real-Time Voice Engine**: Ultra-low latency speech pipeline with deep understanding of Egyptian Arabic (`ar-EG`) and English (`en-US`).
- 🌐 **Living 3D Presence**: Fluid WebGL volumetric presence responsive to conversational emotional states (*LISTENING*, *THINKING*, *SPEAKING*).
- 🔒 **Privacy & Data Minimization**: Non-diagnostic guarantee, consent-first data boundaries, and ephemeral session isolation.
- 🧘 **Wellness & Regulation Spaces**: 4-7-8 Parasympathetic Breathing Pacer, 5-4-3-2-1 Sensory Grounding, Private Journal, and Emotion Trajectory tracking.

---

## 🏛️ System Architecture

```
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
```

---

## 🚀 Quickstart & Local Setup

### 1. Clone the repository
```bash
git clone https://github.com/mohamedatia21/MindCare.git
cd MindCare
```

### 2. Install dependencies
```bash
npm install
cd src/client && npm install && cd ../..
```

### 3. Configure environment variables
Copy the template `.env.example` file:
```bash
cp .env.example .env
```
Fill in your own API keys (Groq, Gemini, Deepgram, or Qdrant).

### 4. Run development servers
```bash
# Start backend server
npm run start

# Start frontend dev server (in another terminal)
cd src/client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🛡️ Ethical & Clinical Notice

MindCare is designed as an empathetic self-reflection and emotional support tool. It does not provide medical diagnoses, prescribe physical medications, or substitute for licensed psychiatric healthcare. In emergencies, users are immediately directed to certified regional crisis helplines.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
