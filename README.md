# Arduino Simulator - Web-Based Electronics Simulation Platform

<div align="center">

![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-5.0.0-646CFF?logo=vite)
![AVR8js](https://img.shields.io/badge/AVR8js-0.20.1-FF6B6B?logo=javascript)
![License](https://img.shields.io/badge/License-MIT-green)

**A professional web-based Arduino simulator with real-time hardware simulation and code generation**

*FOSSEE OSHW Winter Internship – 2025 Screening Task*

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Architecture](#-architecture) • [Technology Stack](#-technology-stack)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [Engineering Implementation](#-engineering-implementation)
- [Development](#-development)
- [Contributing](#-contributing)

---

## 🎯 Overview

This project is a **professional-grade web-based Arduino simulator** that enables users to build, configure, and simulate Arduino circuits entirely in the browser. Built as part of the FOSSEE OSHW Winter Internship screening process, it demonstrates advanced web engineering techniques combined with embedded systems simulation.

### Key Capabilities

- **Visual Circuit Design**: Drag-and-drop interface for building Arduino circuits
- **Real-Time Code Generation**: Automatic Arduino code generation based on circuit configuration
- **Hardware Simulation**: Logic-level simulation using avr8js CPU emulation
- **Pin Configuration**: Dynamic pin assignment with mutual exclusion validation
- **Live Visualization**: Real-time hardware component rendering using Wokwi elements

---

## ✨ Features

### 🎨 User Interface
- **Component Palette**: Drag-and-drop component library (Arduino UNO, LED, Push Button)
- **Interactive Canvas**: Repositionable components with visual pin labels
- **Dual View Modes**: Switch between Component View and Code View seamlessly
- **Properties Panel**: Configure component pins with validation and mutual exclusion
- **Syntax Highlighting**: Professional C++/Arduino code display with syntax highlighting

### ⚙️ Simulation Engine
- **CPU-Level Simulation**: Uses avr8js for instruction-level AVR CPU emulation
- **Register Manipulation**: Direct DDR and PORT register control for GPIO simulation
- **Real-Time Execution**: requestAnimationFrame-based simulation loop (~16MHz equivalent)
- **Port Mapping**: Direct mapping between Wokwi components and AVR I/O ports
- **Dynamic Re-binding**: Instant pin reconfiguration without simulation restart

### 🔧 Code Generation
- **Auto-Generated Arduino Code**: Real-time code generation based on circuit configuration
- **Pin-Aware Generation**: Code automatically updates when pins are reconfigured
- **Arduino Standard**: Generates standard Arduino `setup()` and `loop()` structure
- **INPUT_PULLUP Support**: Proper pull-up resistor configuration for buttons

---

## 🛠 Technology Stack

### Frontend Framework
- **React 18.2.0** - Modern UI library with hooks and functional components
- **Vite 5.0.0** - Next-generation build tool for fast development and optimized production builds

### Hardware Simulation
- **avr8js 0.20.1** - JavaScript implementation of AVR 8-bit microcontroller
  - `CPU` - AVR CPU core emulation
  - `AVRIOPort` - GPIO port modeling (Port B, C, D)
  - `avrInstruction()` - Instruction-level execution
  - `portBConfig`, `portCConfig`, `portDConfig` - Port configuration

### Hardware Visualization
- **@wokwi/elements 1.9.1** - Web Components for hardware visualization
  - `<wokwi-arduino-uno>` - Arduino UNO board visualization
  - `<wokwi-led>` - LED component with color and state control
  - `<wokwi-pushbutton>` - Interactive push button component

### UI Libraries
- **react-draggable 4.5.0** - Drag-and-drop functionality for components
- **react-syntax-highlighter 15.5.0** - Code syntax highlighting (VS Code Dark+ theme)

### Development Tools
- **@vitejs/plugin-react 4.2.0** - Vite plugin for React support
- **@types/react 18.2.0** - TypeScript definitions for React
- **@types/react-dom 18.2.0** - TypeScript definitions for React DOM

### Additional Libraries
- **intel-hex 0.2.0** - Intel HEX file format parser (for future HEX loading support)

### Architecture Pattern
- **Component-Based Architecture**: Modular React components
- **State Management**: React hooks (useState, useRef, useCallback, useEffect)
- **Event-Driven Simulation**: requestAnimationFrame for real-time updates

---

## 🏗 Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Component    │  │ Code View    │  │ Properties    │     │
│  │ Canvas       │  │ Panel        │  │ Panel         │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Application Logic Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Component    │  │ Pin          │  │ Code         │     │
│  │ Manager      │  │ Configurator │  │ Generator    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Simulation Engine Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ AVR8js CPU   │  │ I/O Port     │  │ Simulation   │     │
│  │ Emulator     │  │ Manager      │  │ Loop         │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Hardware Visualization Layer                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Wokwi        │  │ Wokwi LED    │  │ Wokwi        │     │
│  │ Arduino UNO  │  │ Component    │  │ Push Button  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Component Flow

1. **User Interaction** → Component drag/drop, pin configuration
2. **State Update** → React state management updates component/pin configuration
3. **Code Generation** → Arduino code generated based on current state
4. **Simulation Start** → AVR8js CPU initialized with port configuration
5. **Simulation Loop** → CPU executes instructions, I/O ports updated
6. **Visual Update** → Wokwi components reflect CPU port states

### Data Flow

```
User Action (Button Press)
    ↓
handleButtonPress()
    ↓
AVRIOPort.setPin() → Updates CPU PIN register
    ↓
Simulation Loop reads PIN register
    ↓
Calculates LED state (inverted button state)
    ↓
AVRIOPort.setPort() → Updates CPU PORT register
    ↓
Port Listener detects PORT register change
    ↓
setLedStates() → Updates React state
    ↓
<wokwi-led> value prop updates
    ↓
Visual LED turns ON/OFF
```

---

## 📦 Installation

### Prerequisites

- **Node.js** 16.x or higher
- **npm** 7.x or higher (or **yarn** / **pnpm**)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd FOSSEE-OSHW
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   - The application will automatically open at `http://localhost:3000`
   - Or manually navigate to the URL shown in the terminal

### Build for Production

```bash
npm run build
```

The production build will be created in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

---

## 🚀 Usage

### Basic Workflow

1. **Add Components**
   - Drag **Arduino UNO** from the sidebar to the canvas
   - Drag **LED (Red)** to the canvas
   - Drag **Push Button** to the canvas

2. **Configure Pins**
   - Click on the **LED** component
   - Open the **PROPERTIES** tab
   - Select a pin from the dropdown (default: D10)
   - Click on the **Push Button** component
   - Select a pin from the dropdown (default: D2)

3. **View Generated Code**
   - Switch to **Code View** or open the **CODE (ino)** tab
   - Observe the auto-generated Arduino code with your pin configuration

4. **Run Simulation**
   - Click **Start Simulation** button
   - Press and hold the push button
   - Observe the LED turning ON when button is pressed
   - Release the button to turn the LED OFF

5. **Reconfigure Pins**
   - While simulation is running, change pin assignments in Properties
   - Simulation automatically rebinds to new pins without restart

### Pin Configuration Rules

- **Available Pins**: Digital pins D2 through D13
- **Mutual Exclusion**: Each pin can only be assigned to one component
- **Dynamic Updates**: Pin changes reflect immediately in code and simulation

---

## 📁 Project Structure

```
FOSSEE-OSHW/
│
├── src/
│   ├── App.jsx                 # Main application component
│   ├── App.css                  # Global application styles
│   ├── ArduinoSimulator.jsx     # Core simulator component
│   └── main.jsx                # Application entry point
│
├── index.html                  # HTML template
├── vite.config.js             # Vite configuration
├── package.json               # Project dependencies and scripts
└── README.md                  # Project documentation

```

### Key Files

- **`ArduinoSimulator.jsx`** - Main simulator component containing:
  - Component management logic
  - Pin configuration system
  - Code generation engine
  - Simulation loop with avr8js integration
  - Port mapping and I/O handling

- **`App.jsx`** - Root component wrapper

- **`main.jsx`** - React application entry point

---

## 🔬 Engineering Implementation

### Register-Level GPIO Control

The simulator uses **avr8js** to directly manipulate AVR microcontroller registers:

```javascript
// LED Pin Configuration (OUTPUT)
ledPort.setDDR(ledBit, true);  // Set Data Direction Register

// Button Pin Configuration (INPUT_PULLUP)
buttonPort.setDDR(buttonBit, false);  // Input mode
buttonPort.setPort(buttonBit, true);   // Enable pull-up resistor
```

### CPU Instruction Execution

The simulation loop executes AVR instructions at logic-level speed:

```javascript
// Execute ~16,000 instructions per frame (simulating 16MHz AVR)
for (let i = 0; i < instructionsPerFrame; i++) {
  avrInstruction(cpu);
}
```

### Port State Monitoring

LED state is derived from CPU PORT register, not React state:

```javascript
// Read CPU PORT register (source of truth)
const portValue = ledPort.port;
const isHigh = !!(portValue & (1 << ledBit));

// Update UI based on CPU state
setLedStates(prev => ({ ...prev, [ledId]: isHigh }));
```

### Dynamic Pin Re-binding

Pin changes update CPU registers instantly:

```javascript
// Reconfigure CPU registers with new pin assignments
setupCPURegistersDirectly(cpu, newLedPin, newButtonPin, portB, portC, portD);

// Update port listeners for new pins
ledPinListenerRef.current = () => {
  const portValue = ledPort.port;
  // Monitor new pin's PORT register
};
```

### Simulation Loop Architecture

- **Frame Rate**: 60 FPS (requestAnimationFrame)
- **Instruction Rate**: ~16,000 instructions per frame
- **CPU Speed**: Simulates ~16MHz AVR microcontroller
- **Update Frequency**: Port listeners check CPU state every frame

---

## 💻 Development

### Development Server

```bash
npm run dev
```

- Hot Module Replacement (HMR) enabled
- Fast refresh for React components
- Automatic browser refresh on file changes

### Code Style

- **JavaScript**: ES6+ syntax
- **React**: Functional components with hooks
- **Naming**: camelCase for variables, PascalCase for components

### Key Development Concepts

1. **State Management**: React hooks (useState, useRef, useCallback)
2. **Component Lifecycle**: useEffect for simulation start/stop
3. **Performance**: useCallback for expensive operations
4. **Refs**: useRef for DOM elements and simulation engine references

---

## 🤝 Contributing

This project was developed as part of the FOSSEE OSHW Winter Internship screening process. Contributions and improvements are welcome!

### Areas for Enhancement

- [ ] Full HEX program loading and execution
- [ ] Additional components (sensors, displays, motors)
- [ ] Serial monitor integration
- [ ] Save/load circuit configurations
- [ ] Multi-board support
- [ ] Analog pin simulation
- [ ] Interrupt handling simulation

---

## 📝 License

This project is developed for educational purposes as part of the FOSSEE OSHW Winter Internship program.

---

## 🙏 Acknowledgments

- **FOSSEE** - For the internship opportunity and screening task
- **Wokwi** - For the excellent hardware visualization components
- **avr8js** - For the powerful AVR CPU emulation library
- **React Team** - For the amazing frontend framework

---

