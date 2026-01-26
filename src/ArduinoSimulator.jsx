import React, { useState, useRef, useEffect, useCallback } from 'react';
import Draggable from 'react-draggable';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CPU, avrInstruction, AVRIOPort, portBConfig, portCConfig, portDConfig } from 'avr8js';
import '@wokwi/elements';   

const ArduinoSimulator = () => {
  const [activeComponents, setActiveComponents] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [viewMode, setViewMode] = useState('component'); // 'component' or 'code'
  const [draggedComponent, setDraggedComponent] = useState(null);
  const [pinConfig, setPinConfig] = useState({ ledPin: 10, buttonPin: 2 });
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [activeTab, setActiveTab] = useState('code'); // 'code' or 'properties'
  const [buttonPressed, setButtonPressed] = useState(false);
  const canvasRef = useRef(null);
  const componentIdCounter = useRef(0);
  const cpuRef = useRef(null);
  const portBRef = useRef(null);
  const portCRef = useRef(null);
  const portDRef = useRef(null);
  const simulationIntervalRef = useRef(null);
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
      loopCode += `  digitalWrite(${pinConfig.ledPin}, digitalRead(${pinConfig.buttonPin}));\n`;
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

  // Initialize CPU and I/O ports for simulation
  const initializeCPU = () => {
    try {
      // Create CPU instance (ATmega328P for Arduino UNO)
      const programMemory = new Uint16Array(0x8000);
      const dataMemory = new Uint8Array(0x10000);
      const cpu = new CPU(programMemory, dataMemory);
      cpuRef.current = cpu;

      // Create I/O ports (Arduino UNO uses PORTB, PORTC, PORTD)
      const portB = new AVRIOPort(cpu, portBConfig);
      const portC = new AVRIOPort(cpu, portCConfig);
      const portD = new AVRIOPort(cpu, portDConfig);

      portBRef.current = portB;
      portCRef.current = portC;
      portDRef.current = portD;

      return { cpu, portB, portC, portD };
    } catch (error) {
      console.error('Error initializing CPU:', error);
      throw error;
    }
  };

  // Convert Arduino pin number to AVR port and bit
  const getPinPortAndBit = (pin) => {
    // Arduino UNO pin mapping
    // Digital pins 0-7: PORTD (bits 0-7)
    // Digital pins 8-13: PORTB (bits 0-5)
    if (pin >= 0 && pin <= 7) {
      return { port: portDRef.current, bit: pin };
    } else if (pin >= 8 && pin <= 13) {
      return { port: portBRef.current, bit: pin - 8 };
    }
    return null;
  };

  // Simulate Arduino code execution
  const simulateArduinoCode = () => {
    if (!cpuRef.current) return;

    const hasLED = activeComponents.some(comp => comp.type === 'led');
    const hasButton = activeComponents.some(comp => comp.type === 'pushbutton');

    if (!hasLED && !hasButton) return;

    // Get pin configurations
    const ledPin = pinConfig.ledPin;
    const buttonPin = pinConfig.buttonPin;

    // Get port and bit for pins
    const ledPinInfo = getPinPortAndBit(ledPin);
    const buttonPinInfo = getPinPortAndBit(buttonPin);
    
    if (!ledPinInfo || !ledPinInfo.port) return;

    // Simulate setup() - configure pins as OUTPUT/INPUT_PULLUP
    // Configure LED pin as OUTPUT
    try {
      const ddrAddr = ledPinInfo.port.portConfig.DDR;
      if (ddrAddr !== undefined && cpuRef.current.data) {
        cpuRef.current.data[ddrAddr] = cpuRef.current.data[ddrAddr] | (1 << ledPinInfo.bit);
      }
    } catch (error) {
      console.error('Error configuring LED pin:', error);
    }

    // Configure button pin as INPUT_PULLUP
    if (hasButton && buttonPinInfo && buttonPinInfo.port) {
      try {
        const ddrAddr = buttonPinInfo.port.portConfig.DDR;
        const portAddr = buttonPinInfo.port.portConfig.PORT;
        if (ddrAddr !== undefined && portAddr !== undefined && cpuRef.current.data) {
          cpuRef.current.data[ddrAddr] = cpuRef.current.data[ddrAddr] & ~(1 << buttonPinInfo.bit);
          cpuRef.current.data[portAddr] = cpuRef.current.data[portAddr] | (1 << buttonPinInfo.bit);
        }
      } catch (error) {
        console.error('Error configuring button pin:', error);
      }
    }

    // Simulate loop() - read button and write to LED
    if (hasLED && hasButton && buttonPinInfo && buttonPinInfo.port) {
      try {
        // Read button state (INPUT_PULLUP: pressed = LOW, not pressed = HIGH)
        const buttonIsPressed = buttonPressed;
        
        // Set button pin input value (inverted for pull-up: pressed = false/LOW)
        buttonPinInfo.port.setPin(buttonPinInfo.bit, !buttonIsPressed);
        
        // Write to LED pin based on button state
        const portAddr = ledPinInfo.port.portConfig.PORT;
        if (portAddr !== undefined && cpuRef.current.data) {
          if (buttonIsPressed) {
            // Button pressed, turn LED on
            cpuRef.current.data[portAddr] = cpuRef.current.data[portAddr] | (1 << ledPinInfo.bit);
            updateLEDState(true);
          } else {
            // Button not pressed, turn LED off
            cpuRef.current.data[portAddr] = cpuRef.current.data[portAddr] & ~(1 << ledPinInfo.bit);
            updateLEDState(false);
          }
        }
      } catch (error) {
        console.error('Error in simulation loop:', error);
      }
    } else if (hasLED) {
      // Just LED, turn it on
      try {
        const portAddr = ledPinInfo.port.portConfig.PORT;
        if (portAddr !== undefined && cpuRef.current.data) {
          cpuRef.current.data[portAddr] = cpuRef.current.data[portAddr] | (1 << ledPinInfo.bit);
          updateLEDState(true);
        }
      } catch (error) {
        console.error('Error turning on LED:', error);
      }
    }

    // Execute CPU instructions to simulate processing (reduced to prevent hanging)
    // Note: We're not actually compiling Arduino code to machine code,
    // so we skip instruction execution to avoid crashes
    // The simulation logic above handles the pin states directly
    // In a full implementation, you would compile the code to HEX and load it here
  };

  // Update LED element state
  const updateLEDState = (isOn) => {
    // Find LED component and update its value attribute
    const ledComponent = activeComponents.find(comp => comp.type === 'led');
    if (ledComponent) {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        const ledElements = document.querySelectorAll('wokwi-led');
        ledElements.forEach((ledEl) => {
          if (ledEl.getAttribute('color') === 'red') {
            ledEl.setAttribute('value', isOn ? 'true' : 'false');
          }
        });
      }, 0);
    }
  };

  // Handle button press/release
  const handleButtonPress = (pressed) => {
    setButtonPressed(pressed);
    
    // Update button element state
    setTimeout(() => {
      const buttonElements = document.querySelectorAll('wokwi-pushbutton');
      buttonElements.forEach((buttonEl) => {
        buttonEl.setAttribute('pressed', pressed ? 'true' : 'false');
      });
    }, 0);
  };

  // Reset simulation
  const resetSimulation = () => {
    try {
      // Clear CPU memory
      if (cpuRef.current) {
        if (cpuRef.current.data) {
          cpuRef.current.data.fill(0);
        }
        if (cpuRef.current.progMem) {
          cpuRef.current.progMem.fill(0);
        }
      }

      // Reset ports
      if (portBRef.current && cpuRef.current && cpuRef.current.data) {
        const portBAddr = portBRef.current.portConfig.PORT;
        const ddrBAddr = portBRef.current.portConfig.DDR;
        if (portBAddr !== undefined) cpuRef.current.data[portBAddr] = 0;
        if (ddrBAddr !== undefined) cpuRef.current.data[ddrBAddr] = 0;
      }
      if (portCRef.current && cpuRef.current && cpuRef.current.data) {
        const portCAddr = portCRef.current.portConfig.PORT;
        const ddrCAddr = portCRef.current.portConfig.DDR;
        if (portCAddr !== undefined) cpuRef.current.data[portCAddr] = 0;
        if (ddrCAddr !== undefined) cpuRef.current.data[ddrCAddr] = 0;
      }
      if (portDRef.current && cpuRef.current && cpuRef.current.data) {
        const portDAddr = portDRef.current.portConfig.PORT;
        const ddrDAddr = portDRef.current.portConfig.DDR;
        if (portDAddr !== undefined) cpuRef.current.data[portDAddr] = 0;
        if (ddrDAddr !== undefined) cpuRef.current.data[ddrDAddr] = 0;
      }

      // Turn off LED
      updateLEDState(false);
      setButtonPressed(false);

      // Reset button element
      setTimeout(() => {
        const buttonElements = document.querySelectorAll('wokwi-pushbutton');
        buttonElements.forEach((buttonEl) => {
          buttonEl.setAttribute('pressed', 'false');
        });
      }, 0);
    } catch (error) {
      console.error('Error resetting simulation:', error);
    }
  };

  // Simulation loop effect
  useEffect(() => {
    if (isSimulating) {
      try {
        // Initialize CPU if not already initialized
        if (!cpuRef.current) {
          initializeCPU();
        }

        // Start simulation loop
        simulationIntervalRef.current = setInterval(() => {
          try {
            simulateArduinoCode();
          } catch (error) {
            console.error('Simulation error:', error);
            // Stop simulation on error
            setIsSimulating(false);
          }
        }, 16); // ~60 FPS

        return () => {
          if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
          }
        };
      } catch (error) {
        console.error('CPU initialization error:', error);
        setIsSimulating(false);
      }
    } else {
      // Stop simulation
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      resetSimulation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSimulating]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);

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
      
      // Auto-wiring: Components are automatically associated with default pins
      // The pinConfig state already has the default pins (ledPin: 10, buttonPin: 2)
      // No need to assign pins here as they're managed globally via pinConfig
      
      setActiveComponents([...activeComponents, newComponent]);
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

  const handlePinChange = (componentType, newPin) => {
    const pinNumber = parseInt(newPin);
    
    if (componentType === 'led') {
      setPinConfig({ ...pinConfig, ledPin: pinNumber });
    } else if (componentType === 'pushbutton') {
      setPinConfig({ ...pinConfig, buttonPin: pinNumber });
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
      case 'led':
        element = <wokwi-led color="red"></wokwi-led>;
        pinLabel = `D${pinConfig.ledPin}`;
        break;
      case 'pushbutton':
        element = (
          <wokwi-pushbutton
            onMouseDown={() => handleButtonPress(true)}
            onMouseUp={() => handleButtonPress(false)}
            onTouchStart={() => handleButtonPress(true)}
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
                onClick={() => {
                  if (isSimulating) {
                    setIsSimulating(false);
                    resetSimulation();
                  } else {
                    setIsSimulating(true);
                  }
                }}
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
