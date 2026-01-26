## Arduino LED + Push Button Web Simulator  
**FOSSEE OSHW Winter Internship – 2025 Screening Task**

### 1. Objective & Area of Interest

- **Project Area**: Open Source Electronics Simulation & Educational Tools  
- **Skills demonstrated**:
  - Web-based engineering tool development (React + Wokwi + avr8js)
  - Electronics abstraction and modeling (Arduino Uno, LED, Push Button)
  - Embedded systems fundamentals (pin mapping, GPIO logic)
  - Software-driven hardware simulation (logic-level behavior)

The app is a **minimal web-based Arduino simulator** that lets the user:

- **Drag** an Arduino Uno, LED, and Push Button onto a canvas  
- **Auto‑wire** the LED and Button to default pins  
- **Configure pins** within valid ranges with mutual exclusion  
- **See auto-generated Arduino code** for the current wiring  
- **Run a logic‑level simulation** where pressing the button controls the LED  

---

### 2. Technology Stack

- **Frontend**: React 18, Vite  
- **UI & Drag/Drop**: `react-draggable`, custom CSS (dark theme)  
- **Hardware Components**: `@wokwi/elements` (`<wokwi-arduino-uno>`, `<wokwi-led>`, `<wokwi-pushbutton>`)  
- **Simulation Core**: `avr8js` (CPU + GPIO modeling, logic-level)  
- **Code View**: `react-syntax-highlighter` (C++/Arduino syntax)  

---

### 3. How to Run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser.

---

### 4. Task 1 – Web-Based Interface & Component Handling

**Status: Implemented and functionally correct**

- **Component Palette (Left Sidebar)**  
  - Contains three components:
    - `Arduino UNO`
    - `LED (Red)`
    - `Push Button`
  - Each entry has a custom icon and can be **dragged from the sidebar**.

- **Central Canvas (Working Area)**  
  - Components dropped from the sidebar are added to the canvas and can be repositioned using `react-draggable`.  
  - Positions are persisted in an `activeComponents` state array:  
    - Each object: `{ id, type, x, y }`  
  - Switching views (Component ↔ Code) does **not** reset or move components.

- **Right Panel (Code / Properties)**  
  - Top tabs:
    - **CODE (ino)** – shows generated Arduino code with syntax highlighting.  
    - **PROPERTIES** – shows per-component configuration (for LED / Button pins).

- **View Toggle (Toolbar)**  
  - A toolbar at the top has a switch:
    - **Component View** – shows canvas, components, and right panel.  
    - **Code View** – shows a full-width code viewer while preserving circuit state.

- **Simulation Controls**  
  - A large **“Start Simulation / Stop Simulation”** button is rendered below the canvas.  
  - Toggles an internal `isSimulating` boolean (per screening checklist).

- **Wokwi Integration**  
  - Uses real Wokwi web components (no images):
    - `<wokwi-arduino-uno>`  
    - `<wokwi-led color="red">`  
    - `<wokwi-pushbutton>`  
  - `import '@wokwi/elements';` is included at the top of the main component.

---

### 5. Task 2 – Auto-Wiring Logic with Configurable Pins

**Status: Implemented and functionally correct**

#### 5.1 Default Pin Mapping (Mandatory Initial State)

- Pin configuration state:

```js
const [pinConfig, setPinConfig] = useState({ ledPin: 10, buttonPin: 2 });
```

- Whenever an LED or Push Button is first added:
  - They are **logically associated** with these defaults:
    - **LED → Digital Pin 10**
    - **Push Button → Digital Pin 2**
  - Pin labels appear next to the components on the canvas:
    - LED shows `D10`, Button shows `D2`.
  - The generated code uses these pins by default.

#### 5.2 Pin Reconfiguration Rules

- **Allowed range**: Only digital pins **D2–D13** are available for selection.
- **Mutual Exclusion (One pin per component)**:
  - Implemented via `getAvailablePins(componentType)`:
    - For LED: dropdown excludes `buttonPin`
    - For Button: dropdown excludes `ledPin`
  - This ensures:
    - If LED uses a pin (e.g., `D10`), that pin does **not** appear for the Button.
    - If Button uses a pin, that pin does **not** appear for the LED.

#### 5.3 Properties UI

- Clicking on a **LED or Push Button**:
  - Selects that component and opens the **PROPERTIES** tab.

- **Properties Panel** shows:
  - Component name (`LED (Red)` or `Push Button`)  
  - **Pin Selection** dropdown (`D2–D13` with filtered options)  
  - Text hint explaining that the pin is reserved and not available to the other component.  
  - A badge showing the current assignment (e.g., `D10`).

#### 5.4 Visual Connection

- For every LED / Button on the canvas:
  - A small **pin label** (badge) is rendered as an overlay:
    - Format: `D<currentPin>`  
    - Tooltip: `Connected to Pin D<currentPin>`  
  - Labels update immediately when pin assignments are changed in the Properties panel.
  - Selected components are outlined to provide clear visual feedback.

---

### 6. Task 3 – Auto Code Generation & Logic‑Level Simulation

**Status: Implemented (logic-level simulation with auto code generation)**

#### 6.1 Auto Code Generation

- Code is generated by `generateArduinoCode()` using:
  - `pinConfig.ledPin`
  - `pinConfig.buttonPin`
  - Presence of LED / Button in `activeComponents`.

- Generated C++ code includes:
  - `pinMode()` calls for LED and Button (with `INPUT_PULLUP` for Button)  
  - `digitalWrite()` and `digitalRead()` logic in `loop()`  

- Example shape (pins and wiring update automatically):

```cpp
void setup() {
  pinMode(<ledPin>, OUTPUT);
  pinMode(<buttonPin>, INPUT_PULLUP);
}

void loop() {
  digitalWrite(<ledPin>, digitalRead(<buttonPin>));
}
```

- **Automatic updates**:
  - Whenever pin assignments change in the Properties panel:
    - `pinConfig` state is updated.  
    - `generateArduinoCode()` is re-run.  
    - Both the right-panel **CODE (ino)** tab and the main **Code View** are re-rendered immediately with the new pin numbers.  
  - No “Save” / “Refresh” button is required.

#### 6.2 Logic-Level Simulation

- **Scope**: Logic-level only, matching the screening document:
  - Button pressed → treated as logical input change.  
  - LED on/off decisions happen at the logic level (no analog behavior).

- **Internal model**:
  - Uses `avr8js` (`CPU`, `AVRIOPort`, `portBConfig`, `portDConfig`) to model GPIO state.  
  - Instruction execution (`avrInstruction`) is intentionally **not** used with a loaded HEX program; instead, the simulator **directly drives GPIO logic** based on:
    - `pinConfig`
    - `buttonPressed` state
    - Presence of LED / Button components

- **Input Logic (Button)**:
  - `wokwi-pushbutton` has event handlers:
    - `onMouseDown` / `onTouchStart` → `buttonPressed = true`  
    - `onMouseUp` / `onTouchEnd` → `buttonPressed = false`
  - In the simulation loop:
    - When a Button is present:
      - Its mapped Arduino pin (`buttonPin`) is treated as:
        - **Pressed** → logical LOW (`INPUT_PULLUP` semantics)  
        - **Released** → logical HIGH  
      - This logical state is propagated to the internal GPIO model.

- **Output Logic (LED)**:
  - For every simulation iteration:
    - If LED and Button are both present:
      - Button considered **pressed** → LED pin state set to HIGH → LED ON.  
      - Button **not pressed** → LED pin state set to LOW → LED OFF.  
    - If only LED is present:
      - LED is driven HIGH (always ON) to indicate connectivity.
  - The `wokwi-led` element:
    - Has its `value` attribute updated (`'true'` / `'false'`) to switch the LED graphic ON/OFF.

- **Start / Stop Simulation**:
  - **Start Simulation**:
    - Sets `isSimulating = true`.  
    - Initializes CPU + ports (if not already initialized).  
    - Starts a periodic simulation loop (~60 FPS) that:
      - Reads `buttonPressed`  
      - Updates internal GPIO state (LED pin)  
      - Updates Wokwi elements visually  
  - **Stop Simulation**:
    - Sets `isSimulating = false`.  
    - Clears the simulation interval.  
    - **Reset logic**:
      - Clears CPU data/program memory.  
      - Resets GPIO port registers.  
      - Turns off the LED (`value = 'false'`).  
      - Sets all push buttons to unpressed.

---

### 7. Mandatory End-to-End Flow (Checklist)

This implementation supports the full workflow required by the screening document:

1. **Select Arduino Uno**  
   - `Arduino UNO` available in the **Components** sidebar and can be dragged to the canvas.
2. **Drag LED**  
   - Drag **LED (Red)** from sidebar to canvas.
3. **Drag Push Button**  
   - Drag **Push Button** from sidebar to canvas.
4. **Auto-wire**  
   - Default pin mapping enforced:
     - **LED → D10**  
     - **Button → D2**  
   - Pin labels (`D10`, `D2`) appear next to the components.  
   - Code uses these exact pins.
5. **Auto-generate Arduino code**  
   - Right-panel **CODE (ino)** tab and main **Code View** display the generated code.  
   - Includes `pinMode`, `digitalRead`, and `digitalWrite` for the configured pins.
6. **Change pin numbers**  
   - Click LED or Button → **PROPERTIES** tab opens.  
   - Use the **Pin Selection** dropdown (`D2–D13`) to change pins.  
   - Mutual exclusion ensures one pin cannot be shared.
7. **Code updates automatically**  
   - The code view reflects the changed pin numbers instantly.  
   - No manual editing or save button is required.
8. **Run simulation**  
   - Click **“Start Simulation”**:
     - Logic-level simulation loop begins.  
     - LED and Button are linked logically based on current pin mapping.
9. **Button controls LED**  
   - Press (click/touch) the Button:
     - LED turns **ON** (logic HIGH at LED pin).  
   - Release the Button:
     - LED turns **OFF** (logic LOW at LED pin).

---

### 8. Notes & Limitations

- **Simulation is logic-level only**:
  - Focuses on digital pin behavior (HIGH/LOW), not timing, interrupts, or analog effects.
- **Code generation is template-based**:
  - C++/Arduino code is generated from the current configuration rather than being compiled and executed on the CPU.
- **Extensibility**:
  - The architecture is designed to be extendable:
    - Additional components and boards
    - Deeper integration with `avr8js` (HEX loading, full instruction simulation)

---

### 9. Summary

This project demonstrates an **end-to-end engineering system** for:

- Interactive, web-based **Arduino circuit construction**  
- **Automatic wiring** with configurable and mutually exclusive digital pins  
- **Auto-generated Arduino code** that always matches the current wiring  
- **Logic-level GPIO simulation** where a virtual push button controls an LED  

It fulfills the functional requirements specified in the **FOSSEE OSHW Winter Internship – 2025** screening document for Tasks **1, 2, and 3**.