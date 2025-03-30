# RepoSage Frontend

This is the frontend for RepoSage, an AI-powered GitHub repository assistant.

## Project Structure

The frontend is structured as follows:

```
frontend/
├── components/         # Reusable UI components
│   ├── ChatInterface.tsx     # Chat UI with the AI
│   ├── CommitViewer.tsx      # Commit details and file changes viewer
│   ├── FileViewer.tsx        # File content viewer with syntax highlighting
│   ├── Layout.tsx            # Main layout wrapper
│   ├── Sidebar.tsx           # Sidebar with file structure and commits
│   └── WelcomeScreen.tsx     # Landing page with repo input
├── pages/              # Next.js pages
│   ├── _app.tsx              # Next.js app wrapper
│   └── index.tsx             # Main page that composes the components
├── services/           # API services
│   └── api.ts                # API client with endpoint methods
├── styles/             # Global styles
│   └── globals.css           # Tailwind imports and global styles
├── types/              # TypeScript type definitions
│   └── index.ts              # Shared type definitions
└── utils/              # Utility functions
    └── diffUtils.tsx         # Functions for parsing and rendering diffs
```

## Component Architecture

The application follows a modular component-based architecture:

1. **Layout**: Provides the basic page structure and metadata
2. **WelcomeScreen**: Landing page where users enter a GitHub repository URL
3. **Sidebar**: Shows file structure or commit history depending on the active tab
4. **FileViewer**: Displays file content with syntax highlighting
5. **CommitViewer**: Shows commit details and file changes
6. **ChatInterface**: The chat interface for interacting with the AI

## State Management

The application uses React's built-in state management with `useState` for local component state and `useEffect` for side effects. The main page (index.tsx) acts as the state container and passes state and callbacks to child components.

## API Communication

All API calls are encapsulated in the `api.ts` service, which provides methods for:

- Repository analysis
- File content retrieval
- Commit history fetching
- Chat message handling

## Development

To start the development server:

```bash
npm run dev
```

The application will be available at http://localhost:3000.

## Building for Production

To build the application for production:

```bash
npm run build
```

Then, to start the production server:

```bash
npm start
``` 