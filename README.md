# RepoSage: AI-Powered GitHub Repository Assistant

RepoSage is an AI assistant designed to help you understand and interact with GitHub repositories. It analyzes code structure, commit history, and file content, allowing you to ask questions and get insights about the project using AI models like Google Gemini.

https://github.com/user-attachments/assets/63ccd75f-cedd-4d5f-b14a-554f5a4bd0ab

## Overview

- **Repository Analysis**: Clones a target GitHub repository locally for analysis.
- **Code Understanding**: Parses file structure and content.
- **Commit History**: Reads and provides access to commit history.
- **AI Chat Interface**: Allows you to ask questions about the repository's code, history, and structure.
- **Local First**: Designed to run locally, interacting with a backend server that manages repository cloning and AI communication.

## Prerequisites

Before you begin, ensure you have the following installed:

1.  **Git**: Required for cloning repositories. [Download Git](https://git-scm.com/downloads)
2.  **Conda**: Required for managing the Python environment. We recommend installing Miniconda.

## Installing Conda

If you don't have Conda installed, follow these steps:

1.  **Download Miniconda**: Go to the [Miniconda documentation](https://docs.conda.io/projects/miniconda/en/latest/) and download the installer appropriate for your operating system (Linux, macOS, or Windows). Choose the Python 3.x version.
2.  **Run the Installer**: Follow the instructions provided by the installer. It's recommended to allow the installer to initialize Conda, which adds the necessary configuration to your shell startup script (`.bashrc`, `.zshrc`, etc.).
3.  **Verify Installation**: Open a *new* terminal window and run:
    ```bash
    conda --version
    ```
    You should see the installed Conda version number. If the command is not found, you might need to manually initialize Conda for your shell (consult the Miniconda documentation for specific instructions like `conda init bash`).

## Setup Steps

1.  **Clone the RepoSage Repository**:
    Open your terminal and clone this project:
    ```bash
    git clone https://github.com/Kaztic/RepoSage.git
    cd RepoSage # Or your repository's directory name
    ```

2.  **Create Conda Environment**:
    Create a dedicated Conda environment for RepoSage using Python 3.9:
    ```bash
    conda create -n reposage_env python=3.9 -y
    ```

3.  **Activate Conda Environment**:
    Activate the newly created environment. You'll need to do this every time you work on the project in a new terminal session.
    ```bash
    conda activate reposage_env
    ```
    Your terminal prompt should now show `(reposage_env)` at the beginning.

4.  **Install Backend Dependencies**:
    Install the required Python packages for the backend server:
    ```bash
    pip install -r backend/requirements.txt
    ```

5.  **Install Frontend Dependencies**:
    Navigate to the frontend directory and install the necessary Node.js packages:
    ```bash
    cd frontend
    npm install
    cd .. # Go back to the project root directory
    ```

6.  **Configure Environment Variables**:
    RepoSage requires API keys to communicate with AI models.

    *   **Backend (`.env` file):**
        - Navigate to the `backend` directory.
        - Create a `.env` file by copying the example: `cp .env.template .env` (if a template exists) or create a new file named `.env`.
        - Add your API keys to this file. Minimally, you need a Google Gemini API key:
          ```dotenv
          # backend/.env
          GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE 
          
          # Optional: Add other keys if needed for specific features (e.g., Claude)
          # ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY_HERE
          
          # Optional: Database URL (defaults to SQLite)
          # DATABASE_URL=sqlite:///./reposage.db 
          
          # Optional: Redis URL (needed for caching/background tasks if used)
          # REDIS_URL=redis://localhost:6379/0
          
          # Security Keys (Generate strong random strings if not set)
          # SECRET_KEY=YOUR_FASTAPI_SECRET_KEY
          # ENCRYPTION_KEY=YOUR_FERNET_ENCRYPTION_KEY 
          ```
        - **Important**: Make sure the `backend/.env` file is listed in your `.gitignore` file to avoid committing secrets.
        - You can obtain a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

    *   **Frontend (`frontend/.env.local` file):**
        - Navigate to the `frontend` directory.
        - Create a `.env.local` file by copying the example: `cp .env.local.example .env.local` (if a template exists) or create a new file named `.env.local`.
        - Ensure it points to your locally running backend server:
          ```dotenv
          # frontend/.env.local
          NEXT_PUBLIC_API_URL=http://localhost:8000 
          ```
        - The frontend `.env.local` file typically does *not* need API keys directly, as it communicates with your backend, which uses the keys from its own `.env` file.

## Running the Application

You need to run the backend and frontend servers separately in two different terminal windows.

1.  **Run the Backend Server**:
    - Open a terminal.
    - Navigate to the project's root directory (`RepoSage`).
    - Activate the Conda environment: `conda activate reposage_env`
    - Start the FastAPI backend server:
      ```bash
      python backend/app.py 
      ```
      Alternatively, use `uvicorn` for more options (like auto-reload):
      ```bash
      uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
      ```
    - The backend should now be running, typically on `http://localhost:8000`.

2.  **Run the Frontend Server**:
    - Open a *second* terminal window.
    - Navigate to the project's root directory (`RepoSage`).
    - Activate the Conda environment (optional for frontend, but good practice): `conda activate reposage_env`
    - Change to the frontend directory: `cd frontend`
    - Start the Next.js development server:
      ```bash
      npm run dev
      ```
    - The frontend should now be running, typically on `http://localhost:3000`.

## Accessing RepoSage

Open your web browser and navigate to:

[http://localhost:3000](http://localhost:3000)

You should now be able to use the RepoSage interface. Enter a GitHub repository URL, click "Analyze", and start chatting with the AI about the code!

## Stopping the Application

- To stop the frontend server, go to its terminal window and press `Ctrl + C`.
- To stop the backend server, go to its terminal window and press `Ctrl + C`.
- To deactivate the Conda environment when you're done, run: `conda deactivate`

## Enterprise Features

- **AI-Driven Repository Intelligence**
  - **Advanced Code Understanding**: AST-based parsing for analyzing function dependencies, design patterns, and architectural insights
  - **Commit History Analysis**: Identify high-impact commits and understand repository evolution
  - **Documentation Quality Assessment**: Evaluate documentation against industry standards

- **Next-Level Semantic Search**
  - **Vector-Based Search**: Hybrid model combining BM25 + sentence transformer embeddings
  - **Contextual Query Understanding**: Intelligent expansion of user queries
  - **Multi-Modal Search Support**: Code-snippet and commit-message based searches

- **Enterprise-Grade Architecture**
  - **High Performance Backend**: FastAPI with async task queues (Celery/Redis)
  - **Robust Data Storage**: PostgreSQL for repository metadata with Redis caching
  - **Security & Compliance**: Role-based access control, encrypted API keys

- **Best-in-Class UI/UX**
  - **Enhanced Chat Interface**: Claude Sonnet chain-of-thought reasoning
  - **Code Analysis Views**: Complexity metrics, AI-powered recommendations
  - **Visual Repository Analytics**: Technical Debt Score based on code quality metrics

- **Flexible Deployment Options**
  - **Containerized Deployments**: Docker and Kubernetes ready
  - **API & Webhook Support**: GraphQL and REST API endpoints
  - **Third-Party Integrations**: Support for CI/CD pipelines

## AI Models

RepoSage Enterprise features dual AI model support:

- **Claude Sonnet 3.7**: Deep reasoning for precise code analysis, better at understanding complex repo structures and providing detailed explanations.
- **Gemini Pro**: Fast responses for common queries and lightweight repository exploration.

## Usage

1. **Clone a Repository**: Enter a GitHub repository URL and authenticate if needed
2. **Explore Code Structure**: Browse files and analyze code complexity
3. **Ask Questions**: Chat with the AI about any aspect of the repository
4. **View Metrics**: Examine code quality scores and technical debt analysis
5. **Get Recommendations**: Receive AI-powered suggestions for code improvements

## Architecture

RepoSage Enterprise is built with a modern, scalable architecture:

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Backend**: FastAPI with Celery async processing
- **AI**: Claude Sonnet 3.7 and Gemini Pro for intelligent responses
- **Database**: PostgreSQL with Redis caching
- **Analysis**: Advanced embeddings for semantic code search
- **Security**: JWT authentication with role-based access control
- **Deployment**: Docker Compose with separate services

## License

MIT 

