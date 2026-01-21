# Arduino Simulator

A React-based Arduino Simulator with Wokwi integration, featuring drag-and-drop components, code editing, and simulation capabilities.

## Features

- **Component Sidebar**: Drag Arduino UNO, Red LED, and Push Button components
- **Interactive Canvas**: Place and move components using drag-and-drop
- **Wokwi Integration**: Uses `<wokwi-*>` web components for interactive components
- **View Toggle**: Switch between Component View and Code View
- **Syntax Highlighting**: Code editor with C++ syntax highlighting
- **Simulation Controls**: Start/Stop simulation button

## Installation

1. Install dependencies:
```bash
npm install
```

## Development

Run the development server:
```bash
npm run dev
```

The application will open at `http://localhost:3000`

## Build

Build for production:
```bash
npm run build
```

## Usage

1. **Component View**: 
   - Drag components from the left sidebar onto the canvas
   - Move components on the canvas by dragging them
   - View code in the right panel
   - Click "Start Simulation" to begin simulation

2. **Code View**:
   - Switch to Code View using the toolbar toggle
   - View and edit Arduino code with syntax highlighting

## Project Structure

```
src/
  ├── ArduinoSimulator.jsx  # Main simulator component
  ├── App.jsx               # App wrapper
  ├── App.css               # Styles
  └── main.jsx              # Entry point
```

## Technologies

- React 18
- react-draggable
- @wokwi/elements
- react-syntax-highlighter
- Vite
