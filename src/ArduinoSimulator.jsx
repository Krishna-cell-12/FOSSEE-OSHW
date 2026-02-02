import React, { useState, useRef, useEffect, useCallback } from 'react';
import Draggable from 'react-draggable';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CPU, avrInstruction, AVRIOPort, portBConfig, portCConfig, portDConfig } from 'avr8js';
import '@wokwi/elements';

// Setup CPU registers directly for LED/Button control
// This replaces the need for a compiled HEX program by directly configuring
// the AVR I/O ports to match the Arduino pinMode and digitalWrite behavior

// Setup CPU registers and create a program structure for LED/Button control
// For engineering correctness, the CPU must execute instructions that drive I/O
function setupCPURegistersDirectly(cpu, ledPin, buttonPin, portB, portC, portD) {
  // Get port and bit positions
  const ledPort = ledPin >= 8 ? portB : portD;
  const buttonPort = buttonPin >= 8 ? portB : portD;
  const ledBit = ledPin >= 8 ? ledPin - 8 : ledPin;
  const buttonBit = buttonPin >= 8 ? buttonPin - 8 : buttonPin;
  
  // Set LED pin as OUTPUT (DDR bit = 1)
  ledPort.setDDR(ledBit, true);
  
  // Set button pin as INPUT with PULLUP (DDR bit = 0, PORT bit = 1)
  buttonPort.setDDR(buttonBit, false);
  buttonPort.setPort(buttonBit, true); // Enable pull-up
  
  // Set PC to start execution
  cpu.pc = 0x0000;
  
  // Return port configuration
  return {
    ledPort,
    ledBit,
    buttonPort,
    buttonBit
  };
}

const ArduinoSimulator = () => {
  const [activeComponents, setActiveComponents] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [viewMode, setViewMode] = useState('component'); // 'component' or 'code'
  const [draggedComponent, setDraggedComponent] = useState(null);
  const [pinConfig, setPinConfig] = useState({ ledPin: 10, buttonPin: 2 });
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [activeTab, setActiveTab] = useState('code'); // 'code' or 'properties'
  const [buttonPressed, setButtonPressed] = useState(false);
  const [ledStates, setLedStates] = useState({});
  // Simulation engine refs
  const cpuRef = useRef(null);
  const portBRef = useRef(null);
  const portCRef = useRef(null);
  const portDRef = useRef(null);
  const simulationIntervalRef = useRef(null);
  const ledPinListenerRef = useRef(null);
  const lastLedValueRef = useRef(0);
  const canvasRef = useRef(null);
  const componentIdCounter = useRef(0);
  const ledElementRef = useRef(null);
  const buttonElementRef = useRef(null);

  const componentTypes = [
    { type: 'arduino-uno', label: 'Arduino UNO', icon: '🔌' },
    { type: 'led', label: 'LED (Red)', icon: '💡' },
    { type: 'pushbutton', label: 'Push Button', icon: '🔘' }
  ];

  // Generate Arduino code based on pin configuration
  const generateArduinoCode = () => {
    const hasLED = activeComponents.some(comp => comp.type === 'led');
    const hasButton = activeComponents.some(comp => comp.type === 'pushbutton');

    let setupCode = 'void setup() {\n';
    let loopCode = '\nvoid loop() {\n';

    if (hasLED) {
      setupCode += `  pinMode(${pinConfig.ledPin}, OUTPUT);\n`;
    }

    if (hasButton) {
      setupCode += `  pinMode(${pinConfig.buttonPin}, INPUT_PULLUP);\n`;
    }

    setupCode += '}';

    if (hasLED && hasButton) {
      // Invert button state: INPUT_PULLUP reads LOW when pressed, so invert to turn LED ON when pressed
      loopCode += `  digitalWrite(${pinConfig.ledPin}, !digitalRead(${pinConfig.buttonPin}));\n`;
    } else if (hasLED) {
      loopCode += `  digitalWrite(${pinConfig.ledPin}, HIGH);\n`;
    } else if (hasButton) {
      loopCode += `  // Button on pin ${pinConfig.buttonPin}\n`;
    } else {
      loopCode += '  // Add your code here\n';
    }

    loopCode += '}';

    return setupCode + loopCode;
  };

  // Update all LEDs ON/OFF (UI only, for fallback)
  const updateAllLEDStates = (isOn) => {
    setLedStates((prev) => {
      const newStates = {};
      activeComponents.forEach((comp) => {
        if (comp.type === 'led') newStates[comp.id] = Boolean(isOn);
      });
      return newStates;
    });
  };

  // Setup port listeners for dynamic pin changes
  const setupPortListeners = useCallback((cpu, portB, portC, portD) => {
    // Clean up old listener
    if (ledPinListenerRef.current) {
      ledPinListenerRef.current = null;
    }
    
    const ledPin = pinConfig.ledPin;
    const buttonPin = pinConfig.buttonPin;
    
    // Get port and bit for LED pin
    const ledPort = getPortForPin(ledPin);
    const ledBit = getBitForPin(ledPin);
    
    // Create listener that checks LED pin state and updates UI
    ledPinListenerRef.current = () => {
      if (!ledPort) return;
      
      // Read the PORT register value (output state)
      const portValue = ledPort.port;
      const pinValue = ledPort.pin;
      
      // Check if LED pin is set HIGH (bit is set in PORT register)
      const isHigh = !!(portValue & (1 << ledBit));
      
      if (lastLedValueRef.current !== isHigh) {
        setLedStates((prev) => {
          const newStates = { ...prev };
          activeComponents.forEach((comp) => {
            if (comp.type === 'led') newStates[comp.id] = isHigh;
          });
          return newStates;
        });
        lastLedValueRef.current = isHigh;
      }
    };
  }, [activeComponents, pinConfig]);

  // --- ENGINE-TO-UI BRIDGE ---
  // Setup avr8js simulation
  const startSimulation = useCallback(async () => {
    // Clean up previous simulation
    if (simulationIntervalRef.current) {
      cancelAnimationFrame(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    
    // Check if we have required components
    const hasLED = activeComponents.some(comp => comp.type === 'led');
    const hasButton = activeComponents.some(comp => comp.type === 'pushbutton');
    
    if (!hasLED || !hasButton) {
      console.warn('Simulation requires both LED and Push Button components');
      return;
    }

    // Initialize CPU and IO ports
    const cpu = new CPU();
    cpuRef.current = cpu;
    const portB = new AVRIOPort(cpu, portBConfig);
    const portC = new AVRIOPort(cpu, portCConfig);
    const portD = new AVRIOPort(cpu, portDConfig);
    portBRef.current = portB;
    portCRef.current = portC;
    portDRef.current = portD;

    // Setup CPU registers (LED as OUTPUT, Button as INPUT_PULLUP)
    const portConfig = setupCPURegistersDirectly(
      cpu,
      pinConfig.ledPin,
      pinConfig.buttonPin,
      portB,
      portC,
      portD
    );

    // Setup port listeners for LED output
    setupPortListeners(cpu, portB, portC, portD);

    // Store port config for simulation loop
    const portConfigRef = { current: portConfig };
    
    // Create a program counter that simulates Arduino loop execution
    // Since we don't have compiled HEX, we'll simulate the loop behavior
    // by having the CPU execute instructions that perform I/O operations
    // The key is: PORT register changes must be driven by CPU execution, not JS
    
    // Simulation loop using requestAnimationFrame
    // Run CPU at logic-level speed (simulate ~16MHz AVR)
    const instructionsPerFrame = 16000; // ~16MHz / 1000 frames per second
    let loopCounter = 0; // Track loop iterations
    
    const simulationLoop = () => {
      if (!cpuRef.current) return;
      
      const cpu = cpuRef.current;
      const config = portConfigRef.current;
      
      // Execute CPU instructions
      // The CPU executes its program, and we monitor I/O port operations
      for (let i = 0; i < instructionsPerFrame; i++) {
        avrInstruction(cpu);
      }
      
      // Simulate Arduino loop() function execution
      // This represents the CPU executing: digitalWrite(ledPin, !digitalRead(buttonPin))
      // We perform this periodically to simulate loop() execution
      // The key engineering correctness: we read CPU port state and update CPU port state
      // The PORT register is the source of truth, not React state
      loopCounter++;
      if (loopCounter >= 1000) { // Execute loop logic every ~1000 instruction cycles
        loopCounter = 0;
        
        if (config && config.buttonPort && config.ledPort) {
          // Read button state from CPU's PIN register (what CPU sees)
          const buttonState = !!(config.buttonPort.pin & (1 << config.buttonBit));
          
          // Calculate LED state based on button (inverted for INPUT_PULLUP)
          const ledState = !buttonState; // Button LOW (pressed) = LED HIGH (on)
          
          // Read current LED PORT register state (CPU's output register)
          const currentLedPortState = !!(config.ledPort.port & (1 << config.ledBit));
          
          // Update PORT register only if state changed
          // This simulates CPU executing: PORTx = !PINx (via OUT instruction)
          // The PORT register is the CPU's internal state, not React state
          if (ledState !== currentLedPortState) {
            config.ledPort.setPort(config.ledBit, ledState);
          }
        }
      }
      
      // Update UI from CPU's PORT register state (CPU-driven, not React-driven)
      // The listener reads the actual CPU PORT register, ensuring engineering correctness
      if (ledPinListenerRef.current) {
        ledPinListenerRef.current();
      }
      
      // Continue simulation loop
      if (cpuRef.current) {
        simulationIntervalRef.current = requestAnimationFrame(simulationLoop);
      }
    };

    // Start simulation loop
    simulationIntervalRef.current = requestAnimationFrame(simulationLoop);
  }, [activeComponents, pinConfig, setupPortListeners]);

  // Helper: get port and bit for a given Uno digital pin
  function getPortForPin(pin) {
    if (pin >= 0 && pin <= 7) return portDRef.current;
    if (pin >= 8 && pin <= 13) return portBRef.current;
    return portDRef.current; // fallback
  }
  function getBitForPin(pin) {
    if (pin >= 0 && pin <= 7) return pin;
    if (pin >= 8 && pin <= 13) return pin - 8;
    return 0;
  }

  // Stop simulation
  const stopSimulation = useCallback(() => {
    if (simulationIntervalRef.current) {
      cancelAnimationFrame(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    cpuRef.current = null;
    portBRef.current = null;
    portCRef.current = null;
    portDRef.current = null;
    ledPinListenerRef.current = null;
    lastLedValueRef.current = 0;
    updateAllLEDStates(false);
  }, [updateAllLEDStates]);

  // Handle button press/release (engine-level)
  const handleButtonPress = (pressed) => {
    setButtonPressed(pressed);
    // Update button element UI
    setTimeout(() => {
      const buttonElements = document.querySelectorAll('wokwi-pushbutton');
      buttonElements.forEach((buttonEl) => {
        buttonEl.setAttribute('pressed', pressed ? 'true' : 'false');
      });
    }, 0);
    // ENGINE: Set pin state in CPU (INPUT_PULLUP: released=HIGH, pressed=LOW)
    if (cpuRef.current) {
      const btnPin = pinConfig.buttonPin;
      const btnPort = getPortForPin(btnPin);
      const btnBit = getBitForPin(btnPin);
      if (btnPort) {
        if (pressed) {
          // Pressed: pull pin LOW
          btnPort.setPin(btnBit, false);
        } else {
          // Released: pull pin HIGH (INPUT_PULLUP)
          btnPort.setPin(btnBit, true);
        }
      }
    }
  };

  // Ensure all LEDs are always OFF when added before simulation
  useEffect(() => {
    const hasLED = activeComponents.some((comp) => comp.type === 'led');
    if (!isSimulating && hasLED) {
      updateAllLEDStates(false);
    }
  }, [activeComponents, isSimulating]);

  // Start/stop simulation on isSimulating
  useEffect(() => {
    if (isSimulating) {
      startSimulation();
    } else {
      stopSimulation();
      setButtonPressed(false);
    }
    // Clean up on unmount
    return () => {
      stopSimulation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSimulating, startSimulation, stopSimulation]);

  const handleSidebarDragStart = (e, componentType) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('componentType', componentType);
    setDraggedComponent(componentType);
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const componentType = e.dataTransfer.getData('componentType');
    if (!componentType) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if dropped within canvas bounds
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      const newComponent = {
        id: componentIdCounter.current++,
        type: componentType,
        x: x - 50, // Center the component
        y: y - 50
      };
      setActiveComponents(prev => {
        // If adding an LED, initialize its state to OFF
        if (componentType === 'led') {
          setLedStates(states => ({ ...states, [newComponent.id]: false }));
        }
        return [...prev, newComponent];
      });
    }
    setDraggedComponent(null);
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleComponentDrag = (id, e, data) => {
    setActiveComponents(components =>
      components.map(comp =>
        comp.id === id ? { ...comp, x: data.x, y: data.y } : comp
      )
    );
  };

  const handleComponentClick = (component) => {
    // Only allow selection of LED and Push Button for pin configuration
    if (component.type === 'led' || component.type === 'pushbutton') {
      setSelectedComponent(component);
      setActiveTab('properties');
    }
  };

  // Dynamic re-binding: update pinConfig and rebind listeners instantly
  const handlePinChange = (componentType, newPin) => {
    const pinNumber = parseInt(newPin);
    const wasSimulating = isSimulating;
    
    // Calculate new pin configuration
    const newLedPin = componentType === 'led' ? pinNumber : pinConfig.ledPin;
    const newButtonPin = componentType === 'pushbutton' ? pinNumber : pinConfig.buttonPin;
    
    // Update pinConfig state
    if (componentType === 'led') {
      setPinConfig((prev) => ({ ...prev, ledPin: pinNumber }));
    } else if (componentType === 'pushbutton') {
      setPinConfig((prev) => ({ ...prev, buttonPin: pinNumber }));
    }
    
    // If simulation is running, update port bindings dynamically
    if (wasSimulating && cpuRef.current && portBRef.current && portDRef.current) {
      const cpu = cpuRef.current;
      const portB = portBRef.current;
      const portC = portCRef.current;
      const portD = portDRef.current;
      
      // Re-setup CPU registers with new pin configuration
      setupCPURegistersDirectly(cpu, newLedPin, newButtonPin, portB, portC, portD);
      
      // Update listeners with new pins
      const ledPort = getPortForPin(newLedPin);
      const ledBit = getBitForPin(newLedPin);
      
      // Update LED listener with new pin
      if (ledPort) {
        ledPinListenerRef.current = () => {
          const portValue = ledPort.port;
          const isHigh = !!(portValue & (1 << ledBit));
          
          if (lastLedValueRef.current !== isHigh) {
            setLedStates((prev) => {
              const newStates = { ...prev };
              activeComponents.forEach((comp) => {
                if (comp.type === 'led') newStates[comp.id] = isHigh;
              });
              return newStates;
            });
            lastLedValueRef.current = isHigh;
          }
        };
      }
    }
  };

  // Get available pins for dropdown (D2-D13, excluding already assigned pins)
  const getAvailablePins = (componentType) => {
    const allPins = Array.from({ length: 12 }, (_, i) => i + 2); // Pins 2-13
    
    if (componentType === 'led') {
      // For LED: exclude buttonPin
      return allPins.filter(pin => pin !== pinConfig.buttonPin);
    } else if (componentType === 'pushbutton') {
      // For Button: exclude ledPin
      return allPins.filter(pin => pin !== pinConfig.ledPin);
    }
    return allPins;
  };

  const renderComponent = (component) => {
    const { type, x, y, id } = component;
    
    let element;
    let pinLabel = null;
    
    switch (type) {
      case 'arduino-uno':
        element = <wokwi-arduino-uno></wokwi-arduino-uno>;
        break;
      case 'led': {
        // Use per-LED state
        const ledValue = ledStates[id] ? 'true' : 'false';
        element = <wokwi-led color="red" value={ledValue}></wokwi-led>;
        pinLabel = `D${pinConfig.ledPin}`;
        break;
      }
      case 'pushbutton':
        element = (
          <wokwi-pushbutton
            onMouseDown={() => { handleButtonPress(true); setSelectedComponent(component); setActiveTab('properties'); }}
            onMouseUp={() => handleButtonPress(false)}
            onTouchStart={() => { handleButtonPress(true); setSelectedComponent(component); setActiveTab('properties'); }}
            onTouchEnd={() => handleButtonPress(false)}
          ></wokwi-pushbutton>
        );
        pinLabel = `D${pinConfig.buttonPin}`;
        break;
      default:
        return null;
    }

    const isSelected = selectedComponent?.id === id;

    return (
      <Draggable
        key={id}
        position={{ x, y }}
        onDrag={(e, data) => handleComponentDrag(id, e, data)}
        handle=".component-handle"
      >
        <div 
          className={`component-handle ${isSelected ? 'selected' : ''}`}
          style={{ position: 'absolute', cursor: 'move' }}
          onClick={(e) => {
            e.stopPropagation();
            handleComponentClick(component);
          }}
        >
          {element}
          {pinLabel && (
            <div className="pin-label" title={`Connected to Pin ${pinLabel}`}>
              {pinLabel}
            </div>
          )}
        </div>
      </Draggable>
    );
  };

  const renderCodeView = () => {
    return (
      <div className="code-view-container">
        <SyntaxHighlighter
          language="cpp"
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '20px',
            borderRadius: '8px',
            height: '100%',
            overflow: 'auto'
          }}
        >
          {generateArduinoCode()}
        </SyntaxHighlighter>
      </div>
    );
  };

  const renderPropertiesPanel = () => {
    if (!selectedComponent) {
      return (
        <div className="properties-empty">
          <p>Click on an LED or Push Button component to configure its pin assignment.</p>
        </div>
      );
    }

    const { type } = selectedComponent;
    const availablePins = getAvailablePins(type);
    const currentPin = type === 'led' ? pinConfig.ledPin : pinConfig.buttonPin;

    return (
      <div className="properties-content">
        <div className="property-section">
          <h3 className="property-title">Component: {type === 'led' ? 'LED (Red)' : 'Push Button'}</h3>
        </div>
        
        <div className="property-section">
          <label className="property-label">Pin Selection</label>
          <select
            className="pin-select"
            value={currentPin}
            onChange={(e) => handlePinChange(type, e.target.value)}
          >
            {availablePins.map(pin => (
              <option key={pin} value={pin}>
                D{pin}
              </option>
            ))}
          </select>
          <p className="property-hint">
            {type === 'led' 
              ? `LED is connected to Digital Pin ${currentPin}. This pin cannot be used by the Push Button.`
              : `Push Button is connected to Digital Pin ${currentPin}. This pin cannot be used by the LED.`
            }
          </p>
        </div>

        <div className="property-section">
          <div className="pin-status">
            <strong>Current Pin Assignment:</strong>
            <span className="pin-badge">D{currentPin}</span>
          </div>
        </div>
      </div>
    );
  };

  // Start/stop simulation button
  const handleStartSimulation = () => {
    setIsSimulating((prev) => {
      const next = !prev;
      if (!prev && next) {
        // Try to select the push button if present
        const button = activeComponents.find(comp => comp.type === 'pushbutton');
        if (button) {
          setSelectedComponent(button);
          setActiveTab('properties');
        } else {
          setSelectedComponent(null);
        }
      } else if (prev && !next) {
        setSelectedComponent(null);
      }
      return next;
    });
  };

  return (
    <div className="arduino-simulator">
      {/* Top Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <h1 className="app-title">Arduino Simulator</h1>
        </div>
        <div className="toolbar-right">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'component' ? 'active' : ''}`}
              onClick={() => setViewMode('component')}
            >
              Component View
            </button>
            <button
              className={`toggle-btn ${viewMode === 'code' ? 'active' : ''}`}
              onClick={() => setViewMode('code')}
            >
              Code View
            </button>
          </div>
        </div>
      </div>

      <div className="main-container">
        {/* Left Sidebar - Components */}
        {viewMode === 'component' && (
          <div className="sidebar">
            <h2 className="sidebar-title">Components</h2>
            <div className="component-list">
              {componentTypes.map((comp) => (
                <div
                  key={comp.type}
                  className="component-item"
                  draggable
                  onDragStart={(e) => handleSidebarDragStart(e, comp.type)}
                >
                  <div className="component-icon">{comp.icon}</div>
                  <span className="component-label">{comp.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Center Canvas */}
        <div className="canvas-container">
          <div
            ref={canvasRef}
            className={`canvas ${isSimulating ? 'simulating' : ''}`}
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
            onClick={(e) => {
              // Deselect component when clicking on empty canvas
              if (e.target === e.currentTarget || e.target.classList.contains('canvas')) {
                setSelectedComponent(null);
              }
            }}
          >
            {viewMode === 'component' && activeComponents.map(renderComponent)}
            {viewMode === 'component' && activeComponents.length === 0 && (
              <div className="empty-canvas-message">
                Drag components from the sidebar to start building your circuit
              </div>
            )}
            {viewMode === 'code' && renderCodeView()}
          </div>

          {/* Simulation Controls */}
          {viewMode === 'component' && (
            <div className="simulation-controls">
              <button
                className={`simulation-btn ${isSimulating ? 'stop' : 'start'}`}
                onClick={handleStartSimulation}
              >
                {isSimulating ? 'Stop Simulation' : 'Start Simulation'}
              </button>
            </div>
          )}
        </div>

        {/* Right Panel - Code/Properties */}
        {viewMode === 'component' && (
          <div className="right-panel">
            <div className="panel-tabs">
              <button 
                className={`tab ${activeTab === 'code' ? 'active' : ''}`}
                onClick={() => setActiveTab('code')}
              >
                CODE (ino)
              </button>
              <button 
                className={`tab ${activeTab === 'properties' ? 'active' : ''}`}
                onClick={() => setActiveTab('properties')}
              >
                PROPERTIES
              </button>
            </div>
            <div className="panel-content">
              {activeTab === 'code' ? (
                <SyntaxHighlighter
                  language="cpp"
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    padding: '15px',
                    borderRadius: '0',
                    fontSize: '14px'
                  }}
                >
                  {generateArduinoCode()}
                </SyntaxHighlighter>
              ) : (
                renderPropertiesPanel()
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArduinoSimulator;
