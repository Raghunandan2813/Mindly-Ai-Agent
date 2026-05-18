# Contributing to Mindly AI 🧠✨

First off, thank you for showing interest in contributing to **Mindly AI**! Contributions from the open-source community are what make software such an amazing environment to build and learn in.

This guide outlines our standards, coding styles, and workflows to ensure your contributions can be merged as smoothly as possible.

---

## 🤝 Code of Conduct

By participating in this project, you agree to uphold our community values:
*   Use welcoming, respectful, and inclusive language.
*   Be collaborative and open to feedback.
*   Focus on what is best for the project and community.
*   Be constructive when reviewing or discussing others' code.

---

## 🛠️ Getting Started

1.  **Fork** the repository on GitHub.
2.  **Clone** your fork to your local machine:
    ```bash
    git clone https://github.com/YOUR_USERNAME/Mindly-Ai-Agent.git
    cd Mindly-Ai-Agent
    ```
3.  Set up your local environment file:
    ```bash
    cp .env.example .env.local
    ```
4.  Install dependencies and start developing:
    ```bash
    npm install
    npm run dev
    ```

For detailed instructions on local database setups (Supabase & Ollama), please refer to our **[Local Setup Guide](docs/setup.md)**.

---

## 🌿 Branching Strategy

When creating new features, fixing bugs, or updating documentation, please create a descriptive topic branch off the `main` branch:

*   **Feature Branches**: `feature/your-feature-name` (e.g. `feature/google-oauth`)
*   **Bug Fixes**: `fix/bug-description` (e.g. `fix/canvas-nan-explosion`)
*   **Documentation**: `docs/doc-updates` (e.g. `docs/setup-instructions`)

---

## 🎨 Coding Standards & Conventions

To maintain premium, clean, and high-fidelity code, we adhere to the following rules:

### 1. Structure and Typing (TypeScript)
*   Enforce absolute type safety. Avoid using `any` unless absolutely necessary (e.g., dynamic third-party response parsing).
*   Group UI files inside `components/` and server-side utilities under `lib/`.

### 2. Styling (CSS & Design System)
*   We use vanilla high-fidelity CSS and standard tailwind classes for smooth animations and transitions.
*   Maintain the monochrome, cybernetic dark theme aesthetic (slate, zinc, and pure black accents).
*   Avoid adding inline styles. Always utilize predefined design tokens.

### 3. Git Commits
Write clean, clear, and descriptive commit messages following the **Conventional Commits** specification:
*   `feat: add dynamic canvas touch dragging support`
*   `fix: resolve Vercel serverless ONNX runtime startup crash`
*   `docs: update architectural diagram in README`

---

## 📬 Pull Request (PR) Checklist

Before submitting a Pull Request, please ensure:
1.  Your code builds successfully locally with `npm run build` without any compilation errors or warnings.
2.  Your changes are verified on both desktop and mobile layouts.
3.  Any new database requirements are documented in `db/schema.sql`.
4.  Your commit history is clean and descriptive.

Once submitted, a maintainer will review your Pull Request, provide feedback, and merge it! Thank you again for building the future of AI Memory with **Mindly AI**! 🚀🔥
