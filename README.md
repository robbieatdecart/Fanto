# Fanto Elefanto

An interactive web app featuring Fanto, a cheerful elephant who responds to your playful commands with AI-generated images. Built with React, Vite, and Together AI.

## Features

- Drag and drop action blocks to modify Fanto
- Create custom actions
- Real-time AI image generation
- Smooth animations and transitions
- Modern, responsive UI

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Together AI for image generation
- DND Kit for drag and drop

## Setup

1. Clone the repository:
```bash
git clone https://github.com/robbieatdecart/Fanto.git
cd Fanto
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your Together AI API key:
```
VITE_TOGETHER_API_KEY=your_together_api_key_here
```

4. Start the development server:
```bash
npm run dev
```

## Environment Variables

- `VITE_TOGETHER_API_KEY`: Your Together AI API key (required)

## Deployment

The app is deployed on Vercel. Any push to the main branch will trigger an automatic deployment.

## License

MIT 